const express = require("express");
const router = express.Router();
const fs = require("fs");
const os = require("os");
const path = require("path");

router.post("/save-token", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "No token provided" });
  const filePath = path.join(os.homedir(), ".aura_token");
  fs.writeFileSync(filePath, JSON.stringify({ token }));
  console.log("Token saved to", filePath);
  res.json({ success: true });
});

module.exports = router;
