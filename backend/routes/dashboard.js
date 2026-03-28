const authMiddleware = require("../middleware/authMiddleware");

const router = require("express").Router();

router.get("/", authMiddleware, (req, res) => {
  res.json({ message: "DashBoard Data" });
});

module.exports = router;
