const getRepos = async (req, res) => {
  if (!req.user || !req.user.accessToken) {
    return res
      .status(401)
      .json({ message: "User not authenticated", success: false });
  }
  try {
    const result = await fetch("https://api.github.com/user/repos", {
      headers: {
        Authorization: `token ${req.user.accessToken}`,
      },
    });
    const repos = await result.json();
    res.json(repos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch Repos", success: false });
  }
};

module.exports = getRepos;
