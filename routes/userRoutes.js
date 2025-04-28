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

    // Check which accounts are connected based on UserConnection existence
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

// OAuth callback handler for Google (Backend receives redirect from Google)
router.get("/oauth2callback", async (req, res) => {
  try {
    const { code, state, error: googleError } = req.query; // Get code, state, and potential Google error

    if (googleError) {
         console.error("Google OAuth error received:", googleError);
         // Redirect back to frontend settings with the error
         return res.redirect(
             `http://localhost:3000/settings?error=${encodeURIComponent(
                 `Google OAuth Error: ${googleError}`
             )}`
         );
     }

    if (!code) {
      // This case should ideally be covered by googleError check, but as a fallback:
      console.error("No code received from Google callback");
      return res.redirect(
        `http://localhost:3000/settings?error=${encodeURIComponent(
          "Failed to receive authorization code from Google"
        )}`
      );
    }

    if (!state) {
         console.error("No state parameter received in Google callback");
         return res.redirect(
             `http://localhost:3000/settings?error=${encodeURIComponent(
                 "Missing state parameter in Google callback"
             )}`
         );
     }

    const userId = state; // Extract userId from state
     if (!mongoose.Types.ObjectId.isValid(userId)) {
         console.error("Invalid userId in state parameter:", userId);
         return res.redirect(
             `http://localhost:3000/settings?error=${encodeURIComponent(
                 "Invalid user ID in callback state"
             )}`
         );
     }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        // IMPORTANT: redirect_uri here must exactly match the one used to generate the auth URL
        // It points to THIS backend route.
        redirect_uri: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/users/oauth2callback` : "http://localhost:5000/users/oauth2callback",
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info from Google (to get googleId)
    const userInfo = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const googleId = userInfo.data.sub;

    // Find the local user to ensure they exist (optional, but good practice)
    const user = await User.findById(userId);
     if (!user) {
        console.error("User not found for userId from state:", userId);
         return res.redirect(
             `http://localhost:3000/settings?error=${encodeURIComponent(
                 "Associated user not found."
             )}`
         );
     }


    // Update or create user connection document to store tokens and Google ID
    await UserConnection.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) }, // Ensure userId is ObjectId
      {
        googleId: googleId,
        googleAccessToken: access_token,
        // Only update refresh token if provided (it's not always returned after the first time)
        ...(refresh_token && { googleRefreshToken: refresh_token }),
        googleTokenExpiry: new Date(Date.now() + expires_in * 1000),
      },
      { upsert: true, new: true } // Create if not exists, return updated doc
    );

    // Update the main User model with googleId and auth method if not already present
     if (!user.googleId) {
       user.googleId = googleId;
     }
     if (!user.authMethods.includes("google")) {
       user.authMethods.push("google");
     }
     await user.save();


    // Redirect back to frontend settings page with success flag
    res.redirect(
      `http://localhost:3000/settings?google_connected=true` // Remove user_id param
    );
  } catch (error) {
    console.error("Error in Google OAuth callback handler:", error);
    // Redirect back to frontend settings with an error message
    res.redirect(
      `http://localhost:3000/settings?error=${encodeURIComponent(
        "Failed to connect Google account. Please try again."
      )}`
    );
  }
});

// The POST /:userId/connect/google route is no longer used by the Settings page
// because the GET /oauth2callback handles the initial code exchange and token storage.
// You can keep it if it's used elsewhere (e.g., by a different callback flow),
// or remove it if /oauth2callback is the standard for connections from settings.
// If keeping, ensure its logic is consistent or adapted.
// router.post("/:userId/connect/google", async (req, res) => { /* ... */ });


// Connect GitHub account (Keep as is, assuming this is a separate flow)
// If connecting from settings, this POST route might be triggered by a frontend callback
// that receives the GitHub code and sends it here.
router.post("/:userId/connect/github", async (req, res) => {
    // ... (existing GitHub connect logic)
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

        if (!access_token) {
            throw new Error("No access token received from GitHub");
        }

        // Get user data from GitHub
        const userResponse = await axios.get("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const {
            login,
            name,
            email,
            id: githubId,
            avatar_url: picture,
        } = userResponse.data;

        // Get user's email if not provided in the initial response
        let userEmail = email;
        if (!userEmail) {
            const emailResponse = await axios.get(
                "https://api.github.com/user/emails",
                {
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                    },
                }
            );
            const primaryEmail = emailResponse.data.find((email) => email.primary);
            userEmail = primaryEmail ? primaryEmail.email : null;
        }

        // Find the user by local ID to ensure they exist
        // Note: The AuthPage handles finding/creating user by email for initial login.
        // This route assumes the user exists and is being *connected* via settings.
        // The user should already have an email from their primary auth method.
        // Ensure the user ID from the request params matches a valid logged-in user.
        // (Authentication middleware should handle this before this route is hit).

        // Update user's GitHub connection
        user.githubId = githubId;
        if (!user.authMethods.includes("github")) {
            user.authMethods.push("github");
        }
        await user.save();

        // Update or create user connection
        await UserConnection.findOneAndUpdate(
            { userId: new mongoose.Types.ObjectId(userId) },
            {
                githubId: githubId,
                githubAccessToken: access_token,
                 // Note: GitHub access tokens typically don't have a refresh token
                 // and a fixed expiry (e.g., 8 hours or none depending on flow).
                 // You might need to adjust expiry handling or store just the access token.
                 // This expiry calculation might be inaccurate for GitHub.
                // githubTokenExpiry: new Date(Date.now() + 3600 * 1000), // Example: 1 hour expiry (adjust as per GitHub docs)
                // If no refresh token, you might need to guide the user to re-connect later
            },
            { upsert: true, new: true }
        );

        res.json({
            success: true,
            message: "GitHub account connected successfully",
        });
    } catch (error) {
        console.error("Error connecting GitHub account:", error);
         // Log specific details for debugging
         if (error.response) {
             console.error("Error response data:", error.response.data);
             console.error("Error response status:", error.response.status);
             console.error("Error response headers:", error.response.headers);
         } else if (error.request) {
             console.error("Error request data:", error.request);
         } else {
             console.error("Error message:", error.message);
         }
        res.status(500).json({ error: "Error connecting GitHub account" });
    }
});

module.exports = router;