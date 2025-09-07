import { createRequire } from "module";
const require = createRequire(import.meta.url);

const dotenv = require("dotenv");
dotenv.config();
import session from "express-session";
const express = require("express");
const path = require("path");
const { fileURLToPath } = require("url");
const passport = require("passport");
const launchlyRoute = require("./routes/launchly.route.cjs");
const authRoute = require("./routes/auth.cjs");
const cors = require("cors");
const httpProxy = require("http-proxy");

const passportSetup = require("./passport.cjs");
const proxy = httpProxy.createProxy();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const BASE_PATH =
  "https://launchly-yashix.s3.eu-north-1.amazonaws.com/__outputs";

app.use(
  session({
    name: "launchly-session",
    secret: "launchly@1234",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  })
);

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/launchly/auth", authRoute);

app.use("/launchly/api", launchlyRoute);

app.use("/", (req, res,next) => {
  const hostname = req.hostname;
  const parts = hostname.split(".");
  const subdomain = parts[0];
  const resolvesTo = `${BASE_PATH}/${subdomain}`;

  if (parts.length >= 2) {
    console.log("Proxying to:", resolvesTo);
    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
  }
  next()
});

app.use(express.static(path.join(__dirname, "dist")));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  if (req.url === "/") {
    proxyReq.path += "index.html";
  }
});

app.listen(PORT, () => {
  console.log(`Launchly API on ${PORT}`);
});
