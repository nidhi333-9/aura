const router = require("express").Router();
const limits = require("../middleware/limits");
const Activity = require("../models/Activity");
const { buildLive, LIVE_WINDOW_MINUTES } = require("../services/focus");

// What the dashboard polls: the current focus score/state/app over the last
// LIVE_WINDOW_MINUTES, plus whether the sensor is actually reporting. Computed straight
// from MongoDB (no ML service), so it answers in milliseconds.
router.get("/", limits.authed, async (req, res) => {
  try {
    const now = Date.now();
    const since = new Date(now - LIVE_WINDOW_MINUTES * 60 * 1000);

    const [rows, latest] = await Promise.all([
      Activity.find({ user: req.user.id, timestamp: { $gte: since } })
        .sort({ timestamp: -1 })
        .select("app_name window_title site category timestamp")
        .lean(),
      // Newest sample of any age/category: the sensor's heartbeat.
      Activity.findOne({ user: req.user.id })
        .sort({ timestamp: -1 })
        .select("timestamp")
        .lean(),
    ]);

    res.json(buildLive(rows, latest?.timestamp, now));
  } catch (err) {
    console.error("LIVE ERROR:", err.message);
    res.status(500).json({ error: "Failed to load live data" });
  }
});

module.exports = router;
