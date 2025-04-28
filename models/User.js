const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: { 
      type: String, 
      required: false,
      select: false // This ensures password is not returned in queries by default
    },
    googleId: { 
      type: String, 
      sparse: true, 
      unique: true, 
      required: false,
      index: true
    },
    googleAccessToken: {
      type: String,
      required: false,
      select: false
    },
    googleRefreshToken: {
      type: String,
      required: false,
      select: false
    },
    googleTokenExpiry: {
      type: Date,
      required: false
    },
    googleScopes: [{
      type: String,
      required: false
    }],
    githubId: {
      type: String,
      sparse: true,
      unique: true,
      required: false,
      index: true
    },
    onedriveId: {
      type: String,
      sparse: true,
      unique: true,
      required: false,
      index: true
    },
    dropboxId: {
      type: String,
      sparse: true,
      unique: true,
      required: false,
      index: true
    },
    dropboxAccessToken: {
      type: String,
      required: false,
      select: false
    },
    dropboxRefreshToken: {
      type: String,
      required: false,
      select: false
    },
    dropboxTokenExpiry: {
      type: Date,
      required: false
    },
    onedriveAccessToken: {
      type: String,
      required: false,
      select: false
    },
    onedriveRefreshToken: {
      type: String,
      required: false,
      select: false
    },
    onedriveTokenExpiry: {
      type: Date,
      required: false
    },
    picture: {
      type: String,
      required: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date,
      default: Date.now
    },
    authMethods: [{
      type: String,
      enum: ["local", "google", "github", "onedrive", "dropbox"],
      default: ["local"]
    }],
    projects: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project'
    }]
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for getting user's full profile URL
UserSchema.virtual('profileUrl').get(function() {
  return `/api/v1/users/${this._id}`;
});

module.exports = mongoose.model("User", UserSchema);
