const mongoose = require("mongoose");

const dailyStatSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true },
  slots: { type: mongoose.Schema.Types.Mixed, default: {} },
});

dailyStatSchema.index({ user: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("DailyStat", dailyStatSchema, "daily_stats");
