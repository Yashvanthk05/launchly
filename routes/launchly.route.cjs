const deployRepo = require("../controllers/deploy.controller.cjs");

const router = require("express").Router();

router.post("/deploy", deployRepo);

router.get("/repos", async (req, res) => {
  if (!req.user || !req.user.accessToken) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  try {
    const response = await fetch("https://api.github.com/user/repos", {
      headers: {
        Authorization: `token ${req.user.accessToken}`,
      },
    });
    const repos = await response.json();
    res.json(repos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error Fetching repos" });
  }
});

module.exports = router;
