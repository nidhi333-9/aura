const router = require("express").Router();
const limits = require("../middleware/limits");

// Which commit is this server running, and since when? Render tells every service its commit in
// RENDER_GIT_COMMIT, so "is the live site up to date?" is one request instead of detective work
// (see scripts/check-deploy.js). It reveals nothing private: the commit is public in the repository.
const STARTED_AT = new Date().toISOString();

// Only a plain commit id is ever shown, never whatever the environment happens to contain.
const commitFromEnv = (value) => (/^[0-9a-f]{7,40}$/i.test(value ?? "") ? value.slice(0, 7).toLowerCase() : null);

router.get("/version", limits.diagnostic, (req, res) => {
  res.json({ commit: commitFromEnv(process.env.RENDER_GIT_COMMIT), started_at: STARTED_AT });
});

module.exports = router;
