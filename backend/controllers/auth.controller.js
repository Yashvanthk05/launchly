const passport = require("passport");

const login = passport.authenticate("github", { scope: ["profile"] });

const logout = (req, res) => {
  req.logOut(function (err) {
    if (err) {
      return next(err);
    }
  });
  res.redirect(process.env.CLIENT_URL);
};

const loginCallback = passport.authenticate("github", {
  successRedirect: "http://localhost:5173",
  failureRedirect: "api/auth/login/failed",
});

const loginSuccess = (req, res) => {
  if (req.user) {
    res.status(200).json({
      success: true,
      message: "successfull",
      user: req.user,
    });
  } else {
    res.status(401).json({ success: false, message: "Not authenticated" });
  }
};

const loginFailed = (req, res) => {
  res.status(401).json({
    success: false,
    message: "failure",
  });
};

module.exports = { login, logout, loginCallback, loginSuccess, loginFailed };
