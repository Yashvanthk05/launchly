const express = require("express");
const deployController = require("../controllers/deploy.controller");

const router = express.Router();

router.post("/", deployController);

module.exports = router;
