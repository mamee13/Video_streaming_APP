const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Warning = require("./warningModel.js"); // import Warning model

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    pic: {
      type: String,
      required: true,
      default:
        "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },

    isAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },

    businessProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessProfile",
      default: null,
    },
    userProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserProfile",
      default: null,
    },

    status: {
      type: String,
      enum: ["Active", "Banned"],
      default: "Active",
    },
    warnings: {
      type: Number,
      default: 0,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Update warnings count automatically whenever user is loaded
userSchema.methods.updateWarningsCount = async function () {
  const count = await Warning.countDocuments({ user: this._id });
  this.warnings = count;
  await this.save();
  return this.warnings;
};

// Optional: virtual field for warnings (read-only)
userSchema.virtual("warningsCount").get(async function () {
  return await Warning.countDocuments({ user: this._id });
});

const User = mongoose.model("User", userSchema);

module.exports = User;