const express = require("express");
const dotenv = require("dotenv");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
const cors = require("cors");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const authRoute = require("./routes/auth.route");
const deployRoute = require("./routes/deploy.route");
const getRepos = require("./controllers/repos.controller");
const sequelize = require("./config/database");
const User = require("./models/User");


const PORT = 5000;

// (async () => {
//   try {
//     await sequelize.authenticate();
//     console.log("Database Connected");
//     await sequelize.sync({ alter: true });
//     console.log("Tables Synced");
//   } catch (err) {
//     console.error(err);
//   }
// })();

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:5000/api/auth/login/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // let user = await User.findOne({ where: { githubId: profile.id } });
        // if (!user) {
        //   user = await User.create({
        //     githubId: profile.id,
        //     usermame: profile.username,
        //     provider: "github",
        //   });
        // }
        return done(null, { ...profile, accessToken });
      } catch (err) {
        return done(err, null);
      }
    }
  )
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
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoute);

app.get("/api/repos", getRepos);

app.use("/api/deploy", deployRoute);

app.listen(PORT, (req, res) => {
  console.log(`Launchly Backend on PORT ${PORT}`);
});
