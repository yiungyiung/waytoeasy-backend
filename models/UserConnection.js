const mongoose = require("mongoose");

const UserConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      required: false,
      index: true,
    },
    googleAccessToken: {
      type: String,
      required: false,
      select: false,
    },
    googleRefreshToken: {
      type: String,
      required: false,
      select: false,
    },
    googleTokenExpiry: {
      type: Date,
      required: false,
    },
    googleScopes: [
      {
        type: String,
        required: false,
      },
    ],
    githubId: {
      type: String,
      sparse: true,
      unique: true,
      required: false,
      index: true,
    },
    githubAccessToken: {
      type: String,
      required: false,
      select: false,
    },
    githubRefreshToken: {
      type: String,
      required: false,
      select: false,
    },
    githubTokenExpiry: {
      type: Date,
      required: false,
    },
    // Dropbox Connection
    dropboxId: {
      type: String,
      sparse: true,
      unique: true,
      required: false,
      index: true,
    },
    dropboxAccessToken: {
      type: String,
      required: false,
      select: false,
    },
    dropboxRefreshToken: {
      type: String,
      required: false,
      select: false,
    },
    dropboxTokenExpiry: {
      type: Date,
      required: false,
    }
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
UserConnectionSchema.index({ userId: 1 });

module.exports = mongoose.model("UserConnection", UserConnectionSchema);
