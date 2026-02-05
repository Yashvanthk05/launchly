const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

async function deployer(req, res) {
  const { gitUrl, userID, projectID, rootDir, deployBackend } = req.body;
  const payload = { gitUrl, userID, projectID, rootDir, deployBackend };
  try {
    const command = new InvokeCommand({
      FunctionName: "launchlydeployer",
      Payload: Buffer.from(JSON.stringify(payload)),
      InvocationType: "RequestResponse",
    });
    const response = await lambdaClient.send(command);
    const lambdaResponse = JSON.parse(Buffer.from(response.Payload).toString());
    console.log(lambdaResponse)
    res.status(200).json(lambdaResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Deployment Failed", error: err.message });
  }
}

module.exports = deployer;
