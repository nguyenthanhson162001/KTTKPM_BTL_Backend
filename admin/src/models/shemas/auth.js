const mongoose = require("mongoose");

const authSchema = new mongoose.Schema(
  {
    password: {
      type: String,
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    remainingTime: {
      type: Date,
      default: undefined,
      index: { expireAfterSeconds: 60 * 60 * 24 * 7 },
    },
    isAdmin: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    _id: false,
    autoCreate: false,
  }
);

module.exports = authSchema;
