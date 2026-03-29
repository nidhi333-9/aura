const express = require("express");
const router = express.Router();
const axios = require("axios");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, async (req, res) => {
  try {
    const mlData = await axios.get("http://127.0.0.1:5000/analytics");
    // console.log("ML DATA: ", mlData.data);
    res.json(mlData.data);
  } catch (err) {
    console.error("ML ERROR:", err.message);
    res.status(500).json({ error: "ML service failed" });
  }
});

module.exports = router; // 🔥 THIS IS VERY IMPORTANT
