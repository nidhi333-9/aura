const mongoose = require("mongoose");
const { CATEGORIES } = require("../services/classify");

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  app_name: { type: String, required: true },
  window_title: { type: String },

  domain: { type: String },

  site: { type: String },
  category: { type: String, enum: CATEGORIES },
  timestamp: { type: Date, default: Date.now },
});

// Every read is "this user's rows in a time range, newest first".
activitySchema.index({ user: 1, timestamp: -1 });

// Ensure the first argument matches your variable name in the route
module.exports = mongoose.model("Activity", activitySchema);
