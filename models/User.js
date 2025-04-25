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
    authMethod: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },
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
