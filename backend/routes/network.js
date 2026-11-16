const router = require("express").Router();
const limits = require("../middleware/limits");

router.get("/network-check", limits.diagnostic, (req, res) => {
  const header = req.headers["x-forwarded-for"];
  res.json({
    ip: req.ip,
    forwarded_for_entries: header ? String(header).split(",").length : 0,
    trusted_proxy_hops: req.app.get("trust proxy"),
  });
});

module.exports = router;
