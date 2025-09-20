const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  username: {
    type: DataTypes.STRING,
    unique: true,
  },
  githubId: {
    type: DataTypes.STRING,
    unique: true,
  },
  provider: {
    type: DataTypes.STRING,
    defaultValue: "github",
  },
});

module.exports = User;
