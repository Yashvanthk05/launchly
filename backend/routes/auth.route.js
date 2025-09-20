const express = require("express");
const passport = require("passport");
const {
  login,
  logout,
  loginSuccess,
  loginFailed,
  loginCallback,
} = require("../controllers/auth.controller.js");

const router = express.Router();

router.get("/login", login);

router.get("/logout", logout);

router.get("/login/success", loginSuccess);

router.get("/login/failed", loginFailed);

router.get(
  "/login/callback",
  loginCallback
);

module.exports = router;
