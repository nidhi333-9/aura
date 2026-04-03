const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  app_name: { type: String, required: true },
  window_title: { type: String },
  timestamp: { type: Date, default: Date.now },
});

// Ensure the first argument matches your variable name in the route
module.exports = mongoose.model("Activity", activitySchema);
