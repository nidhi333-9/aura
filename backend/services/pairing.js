// Helpers for pairing a desktop sensor with an account.
//
//   dashboard --(JWT)--> POST /api/devices/pair-code   -> one-time code, 10 min, single use
//   sensor ----(code)--> POST /api/devices/pair        -> long-lived device key
//   sensor ---(key)-----> POST /api/log-activity       -> can ONLY post activity
//
// Nothing secret is stored in clear: the database keeps SHA-256 hashes of both the code and
// the device key. Both are random, so a plain hash (no salt/slow KDF) is appropriate: there
// is nothing guessable to brute-force offline.

const crypto = require("crypto");

// 32 symbols, no I/O/0/1 so a code read off a screen can't be mistyped.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10; // 32^10 = 2^50 possibilities
const DEVICE_KEY_PREFIX = "adk_"; // makes a leaked key recognisable (and greppable)

const generateCode = () => {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
};

// ABCDEFGHJK -> ABCDE-FGHJK (what people see and type)
const formatCode = (raw) => `${raw.slice(0, CODE_LENGTH / 2)}-${raw.slice(CODE_LENGTH / 2)}`;

// Accept what a person might type: any case, with or without the dash, stray spaces.
const normalizeCode = (input) =>
  typeof input === "string" ? input.toUpperCase().replace(/[\s-]/g, "") : "";

const isWellFormedCode = (normalized) =>
  normalized.length === CODE_LENGTH &&
  [...normalized].every((ch) => CODE_ALPHABET.includes(ch));

const generateDeviceKey = () =>
  DEVICE_KEY_PREFIX + crypto.randomBytes(32).toString("base64url");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Free text from a client (device name, OS): no control characters, bounded length.
const cleanText = (value, maxLength) =>
  typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength)
    : "";

module.exports = {
  CODE_ALPHABET,
  CODE_LENGTH,
  DEVICE_KEY_PREFIX,
  generateCode,
  formatCode,
  normalizeCode,
  isWellFormedCode,
  generateDeviceKey,
  sha256,
  cleanText,
};
