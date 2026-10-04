// Loads environment files, safest-first, for the server and every script:
//
//   1. real environment variables   what Render/your shell provides: always win
//   2. .env.local                   your local-development overrides (git-ignored)
//   3. .env                         shared values (on a developer machine these are often the
//                                   PRODUCTION ones, which is exactly why .env.local exists)
//
// dotenv never replaces a variable that is already set, so listing .env.local before .env is
// all it takes for local settings to win. In production neither file normally exists and
// nothing changes. To develop locally without touching production data, create
// backend/.env.local (see backend/.env.example).

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const loadEnv = (root = path.join(__dirname, "..")) => {
  const files = [".env.local", ".env"].map((name) => path.join(root, name));
  dotenv.config({ path: files, quiet: true });
  return { loaded: files.filter((file) => fs.existsSync(file)).map((file) => path.basename(file)) };
};

module.exports = loadEnv;
