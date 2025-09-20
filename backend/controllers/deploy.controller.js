const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { generateSlug } = require("random-word-slugs");
const { exec } = require("child_process");
const fs = require("fs");
const mime = require("mime-types");
const simpleGit = require("simple-git");
const path = require("path");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function deployRepo(req, res) {
  const gitUrl = req.body.gitUrl;
  var projectID = req.body.projectID || generateSlug();
  projectID = projectID.toLowerCase();
  const clonePath = path.join(__dirname, "..", "__outputs", projectID);
  try {
    console.log("Cloning Repo...");
    await simpleGit().clone(gitUrl, clonePath);

    console.log("Building Website....");

    const p = exec(`cd ${clonePath} && npm install && npm run build`);

    p.stdout.on("data", (data) => {
      console.log(data.toString());
    });

    p.stdout.on("error", (error) => {
      console.log("Error", error.toString());
    });

    p.on("close", async function () {
      console.log("Build.....");
      const distFolderPath = path.join(clonePath, "dist");
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
          Key: `__outputs/${projectID}/${relativePath}`,
          Body: fs.createReadStream(filepath),
          ContentType: mime.lookup(filepath),
        });
        await s3Client.send(cmd);
        console.log("Uploaded", filepath);
      }
    });

    return res.status(201).json({ message: "Success" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err });
  }
}

module.exports = deployRepo;
