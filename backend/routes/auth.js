const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;
    console.log("TOKEN RECEIVED: ", token);

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
    const jwtToken = jwt.sign({ id: existingUser._id }, "secretkey", {
      expiresIn: "7d",
    });
    console.log("SENDING TOKEN:", jwtToken);
    res.json({ user: existingUser, token: jwtToken });
  } catch (err) {
    console.error("GOOGLE ERROR FULL:", err.response?.data);
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
