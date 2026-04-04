const express = require("express");
const cors = require("cors");

const app = express();

require("dotenv").config();
app.use(cors());
app.use(express.json());

const connectDB = require("./config/db");
connectDB();
app.use("/auth", require("./routes/auth"));
app.use("/", require("./routes/saveToken.js"));
const analyticsRoutes = require("./routes/analytics");
app.use("/dashboard", require("./routes/dashboard"));
app.use("/api/analytics", analyticsRoutes);
app.use("/api", require("./routes/activity"));
app.use("/api", require("./routes/spotify.js"));
app.use("/api", require("./routes/youtube"));
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

connectDB()
  .then(() => {
    app.listen(8080, () => console.log("Server is running on port 8080"));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
  });
