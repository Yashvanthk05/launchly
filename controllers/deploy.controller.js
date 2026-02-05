const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { generateSlug } = require("random-word-slugs");
const { exec } = require("child_process");
const fs = require("fs");
const mime = require("mime-types");
const simpleGit = require("simple-git");
const path = require("path");

const { promisify } = require("util");
const execPromise = promisify(exec);

const {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  AddPermissionCommand,
} = require("@aws-sdk/client-lambda");
const {
  CreateApiCommand,
  CreateIntegrationCommand,
  CreateRouteCommand,
  CreateStageCommand,
  ApiGatewayV2Client,
} = require("@aws-sdk/client-apigatewayv2");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const awsConfig = {
  region: process.env.AWS_REGION,
  maxAttempts: 3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

const s3Client = new S3Client(awsConfig);
const lambdaClient = new LambdaClient(awsConfig);
const apiClient = new ApiGatewayV2Client(awsConfig);
const ddbClient = new DynamoDBClient(awsConfig);
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const PROJECTS_TABLE =
  process.env.DYNAMODB_PROJECTS_TABLE || "ProjectsMetadata";
const LOG_TABLE = process.env.DYNAMODB_LOG_TABLE || "DeploymentLogs";

async function logProjectMetadata(projectID, metadata) {
  try {
    const cmd = new PutCommand({
      TableName: PROJECTS_TABLE,
      Item: {
        UserID: metadata.userID,
        ProjectID: projectID,
        GitURL: metadata.gitUrl,
        Type: metadata.type,
        LastDeployment: new Date().toISOString(),
        DeployedURL: metadata.deployedUrl,
      },
    });
    await ddbDocClient.send(cmd);
    console.log(
      `DynamoDB: Project metadata logged for ${projectID} under UserID ${metadata.userID}`
    );
  } catch (err) {
    console.error("DynamoDB Error (Project Metadata):", err);
  }
}

async function logDeploymentAttempt(projectID, userID, status, details) {
  try {
    const command = new PutCommand({
      TableName: LOG_TABLE,
      Item: {
        DeploymentID: `${projectID}-${Date.now()}`,
        ProjectID: projectID,
        UserID: userID,
        Status: status,
        Timestamp: new Date().toISOString(),
        Details: details,
      },
    });
    await ddbDocClient.send(command);
    console.log(`DynamoDB: Deployment log stored with status: ${status}`);
  } catch (dbError) {
    console.error("DynamoDB ERROR: Failed to log deployment attempt:", dbError);
  }
}

async function createZipArchive(sourcePath, projectID, executableName = null) {
  const zipPath = path.join(__dirname, "..", "__outputs", `${projectID}.zip`);
  const archiver = require("archiver");
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(output);

  if (executableName) {
    archive.file(path.join(sourcePath, executableName), {
      name: executableName,
      mode: 0o755,
    });
  } else {
    archive.directory(sourcePath, false);
  }

  await new Promise((resolve, reject) => {
    output.on("close", resolve);
    archive.on("error", reject);
    archive.finalize();
  });
  console.log("Zipping complete.");
  return zipPath;
}

async function uploadTOS3(projectID, zipPath) {
  console.log("Uploading ZIP to S3...");

  const cmd = new PutObjectCommand({
    Bucket: "launchly-yashix",
    Key: `${projectID}.zip`,
    Body: fs.createReadStream(zipPath),
  });

  try {
    await s3Client.send(cmd);
  } catch (err) {
    console.error("S3 Upload Error:", err);
    return res.status(500).json({
      message: "S3 upload failed",
      code: err.Code,
      requestId: err.$metadata?.requestId,
    });
  }

  console.log("Uploaded ZIP to S3");
}

async function createOrUpdateLambda(functionName, projectID, runtime, handler) {
  const lambdaParams = {
    FunctionName: functionName,
    Runtime: runtime,
    Role: process.env.AWS_LAMBDA_ROLE_ARN,
    Handler: handler,
    Code: {
      S3Bucket: "launchly-yashix",
      S3Key: `${projectID}.zip`,
    },
  };
  try {
    await lambdaClient.send(new CreateFunctionCommand(lambdaParams));
    console.log(`Lambda function ${functionName} created.`);
  } catch (err) {
    if (err.name === "ResourceConflictException") {
      console.log(
        `Lambda function ${functionName} already exists. Updating code...`
      );
      await lambdaClient.send(
        new UpdateFunctionCodeCommand({
          FunctionName: functionName,
          S3Bucket: "launchly-yashix",
          S3Key: `${projectID}.zip`,
        })
      );
    } else {
      throw err;
    }
  }
}

async function createApiGateway(projectID) {
  const api = await apiClient.send(
    new CreateApiCommand({
      Name: `${projectID}-api`,
      ProtocolType: "HTTP",
    })
  );
  console.log(`API Gateway ${api.ApiId} created.`);
  return api;
}

async function configureAPIGateway(api, functionName, projectID) {
  await lambdaClient.send(
    new AddPermissionCommand({
      FunctionName: functionName,
      StatementId: `apigateway-${projectID}-invoke`,
      Action: "lambda:InvokeFunction",
      Principal: "apigateway.amazonaws.com",
      SourceArn: `arn:aws:execute-api:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:${api.ApiId}/*`,
    })
  );

  const integration = await apiClient.send(
    new CreateIntegrationCommand({
      ApiId: api.ApiId,
      IntegrationType: "AWS_PROXY",
      PayloadFormatVersion: "2.0",
      IntegrationUri: `arn:aws:apigateway:${process.env.AWS_REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:function:${functionName}/invocations`,
    })
  );

  await apiClient.send(
    new CreateRouteCommand({
      ApiId: api.ApiId,
      RouteKey: "ANY /{proxy+}",
      Target: `integrations/${integration.IntegrationId}`,
    })
  );

  await apiClient.send(
    new CreateStageCommand({
      ApiId: api.ApiId,
      StageName: "$default",
      AutoDeploy: true,
    })
  );

  console.log(
    `Backend deployed at: https://${api.ApiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/`
  );
}

async function deployNodeJSBackend(clonePath, framework, projectID) {
  try {
    const installCommand = `cd ${clonePath} && npm install --production && npm install serverless-http --save`;
    const installResult = await execPromise(installCommand);
    console.log("NPM Install Output:", installResult.stdout.trim());
  } catch (e) {
    console.error("FATAL: Dependency Installation Failed:", e.stderr);
    throw new Error(
      "Dependency installation failed. Check repository package.json and permissions."
    );
  }
  const handlerPath = path.join(clonePath, "handler.js");
  if (!fs.existsSync(handlerPath)) {
    const handlerCode = `const serverless = require("serverless-http");
const express = require("express");
const app = require("./index.js");
module.exports.handler = serverless(app);`;
    fs.writeFileSync(handlerPath, handlerCode.trim());
    console.log("Created handler.js file");
  }
  const zipPath = await createZipArchive(clonePath, projectID);
  await uploadTOS3(projectID, zipPath);
  const functionName = `launchly-${projectID}`;
  await createOrUpdateLambda(
    functionName,
    projectID,
    "nodejs18.x",
    "handler.handler"
  );
  const api = await createApiGateway(projectID);
  await configureAPIGateway(api, functionName, projectID);
  return `https://${api.ApiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/prod/`;
}

async function deployPythonBackend(clonePath, framework, projectID) {
  const requirementsPath = path.join(clonePath, "requirements.txt");
  console.log(`Preparing Python backend for framework: ${framework}`);
  let adapterpackage;
  let handlerCode;
  if (framework === "flask") {
    adapterpackage = "serverless-wsgi";
    handlerCode = `import serverless_wsgi
from main import app
def handler(event, context):
  return serverless_wsgi.handle_request(app, event, context)
`;
  } else if (framework === "fastapi") {
    adapterpackage = "mangum\npydantic<2.0\nexceptiongroup";
    handlerCode = `from mangum import Mangum
from main import app
handler = Mangum(app)`;
  }

  if (fs.existsSync(requirementsPath)) {
    const requirements = fs.readFileSync(requirementsPath, "utf-8");
    if (!requirements.includes(adapterpackage)) {
      fs.appendFileSync(requirementsPath, `\n${adapterpackage}`);
    } else {
      console.log(`${adapterpackage} already present in requirements.txt`);
    }
  } else {
    fs.writeFileSync(requirementsPath, adapterpackage);
  }
  const handlerPath = path.join(clonePath, "handler.py");
  const installCommand = `cd ${clonePath} && pip install -r requirements.txt -t .`;
  await execPromise(installCommand);
  console.log("Python dependencies installed.");
  fs.writeFileSync(handlerPath, handlerCode.trim());
  const zipPath = await createZipArchive(clonePath, projectID);
  await uploadTOS3(projectID, zipPath);
  const functionName = `launchly-${projectID}`;
  await createOrUpdateLambda(
    functionName,
    projectID,
    "python3.9",
    "handler.handler"
  );
  const api = await createApiGateway(projectID);
  await configureAPIGateway(api, functionName, projectID);
  return `https://${api.ApiId}.execute-api.${process.env.AWS_REGION}.amazonaws.com/prod/`;
}

async function deployRepo(req, res) {
  const { gitUrl, userID, rootDir, type, framework } = req.body;
  console.log(req.body);
  let projectID = req.body.projectID.toLowerCase();
  const clonePath = path.join(__dirname, "..", "__outputs", projectID);
  let deployedUrl = "";

  try {
    console.log("Cloning Repo...");
    await simpleGit().clone(gitUrl, clonePath);

    if (type === "frontend") {
      console.log("Installing Dependencies....");
      console.log("Building Website....");
      try {
        const buildResult = await execPromise(
          `cd ${clonePath} && npm install && npm run build`
        );
        console.log(buildResult.stdout);
        console.error(buildResult.stderr);
      } catch (err) {
        console.error("Build failed:", err.stderr || err);
        await logDeploymentAttempt(
          projectID,
          userID,
          "FAILURE",
          `Frontend build failed: ${err.message}`
        );
        throw err;
      }

      const pkg = require(path.join(clonePath, "package.json"));
      let buildOutput = "dist";

      if (pkg.scripts?.build?.includes("react-scripts")) buildOutput = "build";
      if (pkg.scripts?.build?.includes("next")) buildOutput = ".next";
      if (pkg.scripts?.build?.includes("angular")) buildOutput = "dist";
      if (pkg.scripts?.build?.includes("vite")) buildOutput = "dist";

      const distFolderPath = path.join(clonePath, buildOutput);
      if (!fs.existsSync(distFolderPath)) {
        throw new Error(`Build folder not found: ${distFolderPath}`);
      }
      const distFolderContents = fs.readdirSync(distFolderPath, {
        recursive: true,
      });
      for (const file of distFolderContents) {
        const filepath = path.join(distFolderPath, file);
        const relativePath = path
          .relative(distFolderPath, filepath)
          .replace(/\\/g, "/");
        if (fs.lstatSync(filepath).isDirectory()) continue;
        console.log("Uploading", filepath);
        const cmd = new PutObjectCommand({
          Bucket: "launchly-yashix",
          Key: `${projectID}/${relativePath}`,
          Body: fs.createReadStream(filepath),
          ContentType: mime.lookup(filepath),
        });
        await s3Client.send(cmd);
        console.log("Uploaded", filepath);
      }
      deployedUrl = `${projectID}.launchly.software`;
      await logProjectMetadata(projectID, {
        userID,
        gitUrl,
        type,
        rootDir,
        deployedUrl,
      });
      await logDeploymentAttempt(
        projectID,
        userID,
        "SUCCESS",
        `Deployment successful for ${type} project.`
      );
    } else if (type === "backend") {
      console.log("Starting Backend Deployment....");
      console.log("Installing Dependencies....");

      if (framework === "express") {
        deployedUrl = await deployNodeJSBackend(
          clonePath,
          framework,
          projectID
        );
      } else if (framework === "fastapi" || framework === "flask") {
        deployedUrl = await deployPythonBackend(
          clonePath,
          framework,
          projectID
        );
      } else {
        throw new Error("Unsupported backend framework");
      }

      await logProjectMetadata(projectID, {
        userID,
        gitUrl,
        type,
        rootDir,
        deployedUrl,
      });

      await logDeploymentAttempt(
        projectID,
        userID,
        "SUCCESS",
        `Deployment successful for ${type} project.`
      );

      try {
        await fs.promises.rm(clonePath, { recursive: true, force: true });
        if (type === "backend") {
          await fs.promises.rm(`../__outputs/${projectID}.zip`, { force: true });
        }
        console.log(
          `Successfully cleaned up temporary files for ${projectID}.`
        );
      } catch (cleanupErr) {
        console.error(
          "WARNING: Failed to delete temporary files/folder:",
          cleanupErr
        );
      }
      return res.status(201).json({ message: "Success" });
    }
  } catch (err) {
    console.error(err);
    await logDeploymentAttempt(
      projectID,
      userID,
      "FAILURE",
      `Deployment failed: ${errorMessage}`
    );
    try {
      await fs.promises.rm(clonePath, { recursive: true, force: true });
      if (type === "backend") {
        await fs.promises.rm(zipPath, { force: true });
      }
      console.log(
        `Cleaned up temp files after failed deployment for ${projectID}.`
      );
    } catch (cleanupErr) {
      console.error("Cleanup after failure also failed:", cleanupErr);
    }
    return res.status(500).json({
      message: err.message,
      code: err.Code || null,
      requestId: err.$metadata?.requestId || null,
    });
  }
}

module.exports = deployRepo;
