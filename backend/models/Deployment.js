const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./User");

const Deployment = sequelize.define("Deployment", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: "pending",
  },
});

Deployment.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Deployment, { foreignKey: "userId" });

module.exports = Deployment;
