const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const loadEnv = (root = path.join(__dirname, "..")) => {
  const files = [".env.local", ".env"].map((name) => path.join(root, name));
  dotenv.config({ path: files, quiet: true });
  return {
    loaded: files
      .filter((file) => fs.existsSync(file))
      .map((file) => path.basename(file)),
  };
};

module.exports = loadEnv;
