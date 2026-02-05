const express = require("express");
const dotenv = require("dotenv");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
const cors = require("cors");
const httpProxy = require("http-proxy");
const path = require("path");

const proxy = httpProxy.createProxyServer({});

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const authRoute = require("./routes/auth.route");
const deployRoute = require("./routes/deploy.route");
const getRepos = require("./controllers/repos.controller");
const dataRoute = require("./routes/data.route");
const sequelize = require("./config/database");
const User = require("./models/User");

const PORT = 8173;

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://launchly.software/api/auth/login/callback",
      scope: ["read:user", "repo"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        return done(null, { ...profile, accessToken });
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (obj, done) {
  done(null, obj);
});

app.use(
  session({
    name: "launchly",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoute);

app.get("/api/repos", getRepos);

app.use("/api/deploy", deployRoute);

app.use("/api/data", dataRoute);

const BASE_PATH = "https://launchly-yashix.s3.eu-north-1.amazonaws.com/";

app.use("/", (req, res, next) => {
  const hostname = req.hostname;
  const parts = hostname.split(".");
  const subdomain = parts[0];
  const resolvesTo = `${BASE_PATH}/${subdomain}`;

  if (parts.length > 2) {
    console.log("Proxying to:", resolvesTo);
    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
  }
  next();
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  if (req.url === "/") {
    proxyReq.path += "index.html";
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, (req, res) => {
  console.log(`Launchly Backend on PORT ${PORT}`);
});
