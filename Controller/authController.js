const axios = require("axios");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const oauth2Client = require("../utils/oauth2client");
const User = require("../models/User");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_TIMEOUT,
  });
};
// Create and send Cookie ->
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + +process.env.JWT_COOKIE_EXPIRES_IN),
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  };

  user.password = undefined;

  res.cookie("jwt", token, cookieOptions);

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};
/* GET Google Authentication API. */
exports.googleAuth = catchAsync(async (req, res, next) => {
  const { credential } = req.body;

  if (!credential) {
    return next(new AppError("No credential provided", 400));
  }

  try {
    const decoded = jwt.decode(credential);
    const { email, name, picture, sub: googleId } = decoded;

    let user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = await User.create({
        name,
        email,
        googleId,
        picture,
        authMethods: ["google"]
      });
    } else {
      // Update existing user
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.authMethods.includes("google")) {
        user.authMethods.push("google");
      }
      if (!user.picture) {
        user.picture = picture;
      }
      await user.save();
    }

    createSendToken(user, 200, res);
  } catch (error) {
    console.error("Google auth error:", error);
    return next(new AppError("Google authentication failed", 401));
  }
});

exports.githubAuth = async (req, res) => {
  try {
    const { code } = req.body;

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

    const { login, name, email, id: githubId, avatar_url: picture } = userResponse.data;

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

    // Check if user already exists
    let user = await User.findOne({ email: userEmail });

    if (!user) {
      // Create new user
      user = await User.create({
        name: name || login,
        email: userEmail,
        githubId,
        picture,
        authMethods: ["github"]
      });
    } else {
      // Update existing user
      if (!user.githubId) {
        user.githubId = githubId;
      }
      if (!user.authMethods.includes("github")) {
        user.authMethods.push("github");
      }
      if (!user.picture) {
        user.picture = picture;
      }
      await user.save();
    }

    createSendToken(user, 200, res);
  } catch (error) {
    console.error("GitHub authentication error:", error);
    res.status(500).json({
      success: false,
      error: "GitHub authentication failed",
    });
  }
};
