const crypto = require("crypto");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;
const DEVICE_KEY_PREFIX = "adk_";

const generateCode = () => {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
};

const formatCode = (raw) =>
  `${raw.slice(0, CODE_LENGTH / 2)}-${raw.slice(CODE_LENGTH / 2)}`;

const normalizeCode = (input) =>
  typeof input === "string" ? input.toUpperCase().replace(/[\s-]/g, "") : "";

const isWellFormedCode = (normalized) =>
  normalized.length === CODE_LENGTH &&
  [...normalized].every((ch) => CODE_ALPHABET.includes(ch));

const generateDeviceKey = () =>
  DEVICE_KEY_PREFIX + crypto.randomBytes(32).toString("base64url");

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const cleanText = (value, maxLength) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, maxLength)
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
