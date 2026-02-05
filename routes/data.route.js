const express = require("express");
const getProfileData = require("../controllers/getProfileData");

const router = express.Router();

router.post("/profile", getProfileData);

module.exports = router;
