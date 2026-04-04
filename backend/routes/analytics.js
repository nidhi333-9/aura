const express = require("express");
const router = express.Router();
const axios = require("axios");
const Activity = require("../models/Activity");
const authMiddleware = require("../middleware/authMiddleware");
const mongoose = require("mongoose");

router.get("/", authMiddleware, async (req, res) => {
  console.log("req.user:", req.user);
  try {
    const mlData = await axios.get(
      "https://pacific-surprise-production-0ae5.up.railway.app/analytics",
      {
        timeout: 10000,
        headers: { Connection: "keep-alive" },
      },
    );
    const { current_app, window_title, focus_score } = mlData.data;
    if (current_app && current_app != "No activity yet") {
      await Activity.create({
        user: req.user.id,
        app_name: current_app,
        window_title: window_title || "",
        timestamp: new Date(),
      }).catch((err) => console.error("Activity save error:", err.message));
    }
    res.json(mlData.data);
  } catch (err) {
    console.error("ML ERROR:", err.message);

    // Fallback: query MongoDB directly if ML service is down
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const activities = await Activity.find({
        user: req.user._id,
        timestamp: { $gte: since },
      }).sort({ timestamp: -1 });

      if (!activities.length) {
        return res.json({
          focus_score: 0,
          current_app: "No activity yet",
          most_used: "No activity yet",
        });
      }

      const current_app = activities[0].app_name;

      const appCount = {};
      activities.forEach(({ app_name }) => {
        appCount[app_name] = (appCount[app_name] || 0) + 1;
      });
      const most_used = Object.entries(appCount).sort(
        (a, b) => b[1] - a[1],
      )[0][0];

      const productiveApps = [
        "Visual Studio Code",
        "Cursor",
        "Terminal",
        "Code",
        "Postman",
      ];
      const focus_score = Math.round(
        (activities.filter((a) => productiveApps.includes(a.app_name)).length /
          activities.length) *
          100,
      );

      res.json({ focus_score, current_app, most_used });
    } catch (fallbackErr) {
      console.error("FALLBACK ERROR:", fallbackErr.message);
      res.status(500).json({ error: "Both ML service and DB fallback failed" });
    }
  }
});

router.get("/daily-trend", authMiddleware, async (req, res) => {
  console.log("HIT: Daily Trend route reached!");
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const activities = await Activity.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          timestamp: { $gte: startOfDay },
        },
      },
      {
        $group: {
          _id: { $hour: "$timestamp" },
          focusPoints: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$app_name",
                    [
                      "Visual Studio Code",
                      "Cursor",
                      "Terminal",
                      "Postman",
                      "IntelliJ",
                    ],
                  ],
                },
                10,
                2,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formattedData = activities.map((item) => ({
      time: `${item._id}:00`,
      score: Math.min(Math.max(Math.round(item.focusPoints / 5), 20), 100),
    }));

    res.json(formattedData);
  } catch (err) {
    console.error("DB AGGREGATION ERROR:", err.message);
    res.status(500).json({ error: "Could not fetch history" });
  }
});

module.exports = router;
