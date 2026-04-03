const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware"); // Protect it!
const Activity = require("../models/Activity");
// Import your Activity/Log Model here
// const Activity = require("../models/Activity");

router.post("/log-activity", authMiddleware, async (req, res) => {
  try {
    const newLog = new Activity({
      user: req.user.id,
      app_name: req.body.app_name,
      window_title: req.body.window_title,
      timestamp: req.body.timestamp,
    });
    await newLog.save();
    res.status(200).send("Sync successful");
  } catch (err) {
    res.status(500).json({ error: "Server error during sync" });
  }
});

module.exports = router;
