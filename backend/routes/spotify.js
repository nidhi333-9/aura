const express = require("express");
const axios = require("axios");

const router = express.Router();

let cachedToken = null;
let tokenExpiry = 0;

// 🔥 Reusable token function
const getSpotifyToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({
      grant_type: "client_credentials",
    }),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID +
              ":" +
              process.env.SPOTIFY_CLIENT_SECRET,
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + response.data.expires_in * 1000;

  return cachedToken;
};

// 🎵 Token route
router.get("/spotify-token", async (req, res) => {
  try {
    const token = await getSpotifyToken();
    res.json({ token });
  } catch (err) {
    console.error(err.response?.data);
    res.status(500).send("Spotify token error");
  }
});

// 🎧 Playlist route
router.get("/playlist/:id", async (req, res) => {
  try {
    const token = await getSpotifyToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${req.params.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data);
    res.status(500).send("Playlist fetch error");
  }
});

module.exports = router;
