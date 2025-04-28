const express = require("express");
const User = require("../models/User");
const UserConnection = require("../models/UserConnection");
const mongoose = require("mongoose");
const axios = require("axios");

const router = express.Router();

// Get user's connected accounts
router.get("/:userId/connections", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const connections = await UserConnection.findOne({ userId });
    
    // Check which accounts are connected
    const connectedAccounts = {
      github: !!connections?.githubId,
      google: !!connections?.googleId,
      dropbox: !!connections?.dropboxId
    };

    res.json({ connections: connectedAccounts });
  } catch (error) {
    console.error("Error fetching user connections:", error);
    res.status(500).json({ error: "Error fetching user connections" });
  }
});

// OAuth callback handler
router.get("/oauth2callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: "No code received from Google" });
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URL,
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info from Google
    const userInfo = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    // Redirect to frontend with success message
    res.redirect(
      `http://localhost:3000/settings?google_connected=true&user_id=${userInfo.data.sub}`
    );
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    res.redirect(
      `http://localhost:3000/settings?error=${encodeURIComponent(
        "Failed to connect Google account"
      )}`
    );
  }
});

// Connect Google account
router.post("/:userId/connect/google", async (req, res) => {
  try {
    const { userId } = req.params;
    const { code } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URL,
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info from Google
    const userInfo = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // Update user's Google connection
    user.googleId = userInfo.data.sub;
    if (!user.authMethods.includes("google")) {
      user.authMethods.push("google");
    }
    await user.save();

    // Update or create user connection
    await UserConnection.findOneAndUpdate(
      { userId },
      {
        googleId: userInfo.data.sub,
        googleAccessToken: access_token,
        googleRefreshToken: refresh_token,
        googleTokenExpiry: new Date(Date.now() + expires_in * 1000),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Google account connected successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        googleId: user.googleId,
      },
    });
  } catch (error) {
    console.error("Error connecting Google account:", error);
    console.error("Error details:", error.response?.data);
    res.status(500).json({
      success: false,
      error: "Error connecting Google account",
      details: error.response?.data,
    });
  }
});

// Connect GitHub account
router.post("/:userId/connect/github", async (req, res) => {
  try {
    const { userId } = req.params;
    const { code } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user data from GitHub
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    // Update user's GitHub connection
    user.githubId = userResponse.data.id;
    if (!user.authMethods.includes("github")) {
      user.authMethods.push("github");
    }
    await user.save();

    // Update or create user connection
    await UserConnection.findOneAndUpdate(
      { userId },
      {
        githubId: userResponse.data.id,
        githubAccessToken: access_token,
        githubTokenExpiry: new Date(Date.now() + 3600 * 1000),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "GitHub account connected successfully",
    });
  } catch (error) {
    console.error("Error connecting GitHub account:", error);
    res.status(500).json({ error: "Error connecting GitHub account" });
  }
});

module.exports = router;
