const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      required: false,
      index: true,
    },
    githubId: {
      type: String,
      sparse: true,
      unique: true,
      required: false,
      index: true,
    },
    picture: {
      type: String,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    authMethods: [
      {
        type: String,
        enum: ["google", "github", "dropbox"],
        required: true,
      },
    ],
    projects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for getting user's full profile URL
UserSchema.virtual("profileUrl").get(function () {
  return `/api/v1/users/${this._id}`;
});

module.exports = mongoose.model("User", UserSchema);
