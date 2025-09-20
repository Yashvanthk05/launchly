const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  "launchly-db",
  process.env.RDS_USER,
  process.env.RDS_PASSWORD,
  {
    host: process.env.RDS_ENDPOINT,
    dialect: "postgres",
    logging: false,
  }
);

module.exports = sequelize;
