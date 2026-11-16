const router = require("express").Router();
const limits = require("../middleware/limits");

const STARTED_AT = new Date().toISOString();

const commitFromEnv = (value) =>
  /^[0-9a-f]{7,40}$/i.test(value ?? "")
    ? value.slice(0, 7).toLowerCase()
    : null;

router.get("/version", limits.diagnostic, (req, res) => {
  res.json({
    commit: commitFromEnv(process.env.RENDER_GIT_COMMIT),
    started_at: STARTED_AT,
  });
});

module.exports = router;
