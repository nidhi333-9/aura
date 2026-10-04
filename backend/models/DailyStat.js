const mongoose = require("mongoose");

// One document per user per UTC day: how many samples fell in each 15-minute slot, split by
// category. Idle samples are not stored (nothing ever reads them).
//
//   { user, day: "2026-10-02", slots: { "37": { p: 12, n: 3, d: 1 }, "38": { p: 40 } } }
//     slot = (minutes since 00:00 UTC) / 15, so 0..95;  p/n/d = Productive/Neutral/Distraction
//
// 15 minutes because every real time zone's UTC offset is a multiple of 15 minutes, so a slot
// always lies inside exactly one local hour, whichever zone the viewer is in. See
// services/rollups.js. Kept forever (a user-day is a few KB), unlike the raw samples.
//
// Written with native $inc upserts at ingest (see services/rollups.js), which is why the
// schema is loose: it exists for the indexes and for reads.
const dailyStatSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true },
  slots: { type: mongoose.Schema.Types.Mixed, default: {} },
});

dailyStatSchema.index({ user: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("DailyStat", dailyStatSchema, "daily_stats");
