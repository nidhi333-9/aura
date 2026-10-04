const router = require("express").Router();
const limits = require("../middleware/limits");

// Shows the caller the address the server believes they have, and the raw header it came from.
// It is how the right TRUST_PROXY_HOPS is checked against the real host (see the README): call it
// with a made-up X-Forwarded-For and confirm the made-up value does NOT come back as `ip`.
// It reveals nothing but the caller's own connection details.
router.get("/network-check", limits.diagnostic, (req, res) => {
  res.json({
    ip: req.ip,
    forwarded_for: req.headers["x-forwarded-for"] || null,
    trusted_proxy_hops: req.app.get("trust proxy"),
  });
});

module.exports = router;
