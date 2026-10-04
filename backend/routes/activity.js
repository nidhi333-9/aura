const express = require("express");
const router = express.Router();
const ingestAuth = require("../middleware/ingestAuth"); // device key (or legacy session token)
const Activity = require("../models/Activity");
const { classify, normalizeDomain } = require("../services/classify");
const { redactTitle } = require("../services/privacy");
const { recordSample } = require("../services/rollups");

const MAX_APP_NAME = 200;
const MAX_WINDOW_TITLE = 500;
// The sensor stamps each sample with its own clock. Trust it only if it's close to the
// server's; a machine with a wrong clock would otherwise scatter samples across days.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const sampleTime = (clientTimestamp) => {
  const t = new Date(clientTimestamp);
  if (Number.isNaN(t.getTime()) || Math.abs(t.getTime() - Date.now()) > MAX_CLOCK_SKEW_MS) {
    return new Date();
  }
  return t;
};

router.post("/log-activity", ingestAuth, async (req, res) => {
  const { app_name, window_title, timestamp, domain: reportedDomain } = req.body || {};

  if (typeof app_name !== "string" || !app_name.trim()) {
    return res.status(400).json({ error: "app_name is required" });
  }
  const appName = app_name.trim().slice(0, MAX_APP_NAME);
  // Addresses in titles carry login tokens and codes: hide those before anything is classified or
  // stored (services/privacy.js), whichever sensor version sent it.
  const title = redactTitle(typeof window_title === "string" ? window_title : "").slice(
    0,
    MAX_WINDOW_TITLE,
  );
  // The host name of the active browser tab, sent by newer sensors (never a full address).
  // Anything that isn't a plain host name is ignored rather than rejected: the sample is still good.
  const domain = normalizeDomain(reportedDomain);
  const { site, category } = classify(appName, title, domain);
  const sampledAt = sampleTime(timestamp);

  try {
    // The raw row is the source of truth: once it is stored the sample is safe.
    await Activity.create({
      user: req.user.id,
      app_name: appName,
      window_title: title,
      ...(domain && { domain }),
      site,
      category,
      timestamp: sampledAt,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error during sync" });
  }

  // The rollup is derived data. If counting it fails, the sample must not be reported as
  // failed (the sensor would only print an error: it never resends) and nothing is lost: the
  // raw row exists, and scripts/rebuild-rollups.js repairs any drift.
  try {
    await recordSample(req.user.id, sampledAt, category);
  } catch (err) {
    console.error("ROLLUP ERROR (sample is stored; run rebuild-rollups to repair):", err.message);
  }

  res.status(200).send("Sync successful");
});

module.exports = router;
