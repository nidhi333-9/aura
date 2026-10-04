const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const limits = require("../middleware/limits");

router.post("/google", limits.login, limits.loginFails, async (req, res) => {
  try {
    const { token } = req.body;

    const response = await axios.get(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
    );
    const user = response.data;

    const userData = {
      googleId: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
    //Save in Database
    let existingUser = await User.findOne({ googleId: user.sub });
    if (!existingUser) {
      existingUser = await User.create({
        googleId: user.sub,
        email: user.email,
        name: user.name,
        picture: user.picture,
      });
    }
    const jwtToken = jwt.sign({ id: existingUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ user: existingUser, token: jwtToken });
  } catch (err) {
    console.error("GOOGLE ERROR FULL:", err.response?.data);
    res.status(401).json({ error: "Invalid token" });
  }
});

// Lightweight token check for the sensor and landing page: 200 if the token is
// valid and the user still exists, 401 otherwise. Replaces using GET /dashboard
// (which returns up to 500 activity rows) just to validate a token.
router.get("/me", limits.authed, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Failed to load user" });
  }
});

module.exports = router;
