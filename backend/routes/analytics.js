const express = require("express");
const router = express.Router();
const Activity = require("../models/Activity");
const limits = require("../middleware/limits");
const { buildHourlyTrend } = require("../services/focus");
const { isValidTimeZone, localDate, zonedToUtc } = require("../services/tz");

// Today's focus by hour in the caller's time zone (?tz=Asia/Kolkata, default UTC for
// older clients). Computed from MongoDB with the same rules as /api/live, so the chart
// and the score card can't disagree. Hours with no activity are `null`, not 0.
router.get("/daily-trend", limits.authed, async (req, res) => {
  const tz = req.query.tz === undefined ? "UTC" : req.query.tz;
  if (!isValidTimeZone(tz)) {
    return res.status(400).json({ error: "Invalid timezone" });
  }

  try {
    const now = new Date();
    const { y, m, d } = localDate(now, tz);
    const startOfLocalDay = zonedToUtc(y, m, d, 0, tz);

    const rows = await Activity.find({
      user: req.user.id,
      timestamp: { $gte: startOfLocalDay },
    })
      .select("app_name window_title site category timestamp")
      .lean();

    res.json(buildHourlyTrend(rows, tz, now));
  } catch (err) {
    console.error("DAILY TREND ERROR:", err.message);
    res.status(500).json({ error: "Could not fetch history" });
  }
});

module.exports = router;
