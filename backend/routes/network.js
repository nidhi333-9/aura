const router = require("express").Router();
const limits = require("../middleware/limits");

// Tells the caller which address the server believes they have. It is how TRUST_PROXY_HOPS is
// checked against the real host: `ip` must be the caller's own public address, and an
// X-Forwarded-For the caller invents must never come back as `ip`.
// It shows only that, how many addresses the header held, and the setting in force. The header
// itself is not echoed: it contains the host's internal addresses, which nobody needs.
router.get("/network-check", limits.diagnostic, (req, res) => {
  const header = req.headers["x-forwarded-for"];
  res.json({
    ip: req.ip,
    forwarded_for_entries: header ? String(header).split(",").length : 0,
    trusted_proxy_hops: req.app.get("trust proxy"),
  });
});

module.exports = router;
