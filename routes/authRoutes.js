const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authController = require("../Controller/authController");

const router = express.Router();

// Google OAuth routes
router.post("/google", authController.googleAuth);

// GitHub Authentication Routes
router.get("/github", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  const scope = "user:email";

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(githubAuthUrl);
});

router.post("/github", authController.githubAuth);

module.exports = router;
