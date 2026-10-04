const express = require("express");
const axios = require("axios");
const limits = require("../middleware/limits");
const router = express.Router();

// One entry per known type, refreshed at most once an hour. Every search costs 100 of the daily
// YouTube quota, so nobody may trigger more than three of them an hour (see the type check below).
const cache = {};
const lastFetch = {};

const API_KEY = process.env.YOUTUBE_API_KEY;

const queries = {
  focus: "deep focus music",
  relax: "relaxing jazz instrumental",
  boost: "motivation music",
};

// Signed-in people only, and only the three known types: an unknown type used to cost a search
// (and a cache entry that was never freed) for every distinct value anyone made up.
router.get("/youtube-recommendation", limits.authed, async (req, res) => {
  const { type } = req.query;
  if (typeof type !== "string" || !Object.hasOwn(queries, type)) {
    return res.status(400).json({ error: "type must be focus, relax or boost" });
  }

  // 1. Check Cache First
  if (cache[type] && Date.now() - lastFetch[type] < 3600000) {
    return res.json(cache[type]);
  }

  try {
    const response = await axios.get(
      "https://youtube.googleapis.com/youtube/v3/search",
      {
        params: {
          part: "snippet",
          q: queries[type],
          type: "video",
          maxResults: 3,
          key: API_KEY,
        },
      },
    );

    const videos = response.data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
    }));

    cache[type] = videos;
    lastFetch[type] = Date.now();
    res.json(videos);
  } catch (err) {
    console.error("YouTube Quota Exceeded. Using Fallback Data.");

    // 2. Fallback Data: The UI stays beautiful even without the API
    const fallbacks = {
      focus: [
        { id: "jfKfPfyJRdk", title: "Lofi Hip Hop - Beats to Relax/Study to" },
        { id: "DWcJFNfaw9c", title: "Deep Focus Music for Coding" },
      ],
      relax: [
        { id: "5qap5aO4i9A", title: "Relaxing Jazz Instrumental" },
        { id: "tur8X2p79Gg", title: "Ambient Study Music" },
      ],
      boost: [
        { id: "7NOSDKb0HlU", title: "Best Motivational Speech" },
        { id: "mU6K6S7S66I", title: "Upbeat Productivity Mix" },
      ],
    };

    res.json(fallbacks[type]);
  }
});

module.exports = router;
