const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
} = require("../services/pairing");

test("generated codes use only the unambiguous alphabet and are well formed", () => {
  for (let i = 0; i < 500; i += 1) {
    const code = generateCode();
    assert.equal(code.length, CODE_LENGTH);
    assert.ok([...code].every((ch) => CODE_ALPHABET.includes(ch)), code);
    assert.ok(isWellFormedCode(code));
  }
  assert.ok(!/[IO01]/.test(CODE_ALPHABET), "look-alike characters must not be in the alphabet");
});

test("codes are not repeated across many draws", () => {
  const seen = new Set(Array.from({ length: 2000 }, generateCode));
  assert.equal(seen.size, 2000);
});

test("formatCode groups the code and normalizeCode undoes any human formatting", () => {
  assert.equal(formatCode("ABCDEFGHJK"), "ABCDE-FGHJK");
  for (const typed of ["ABCDE-FGHJK", "abcde-fghjk", "ABCDEFGHJK", " abcde fghjk ", "ABCDE - FGHJK"]) {
    assert.equal(normalizeCode(typed), "ABCDEFGHJK", typed);
  }
});

test("normalizeCode and isWellFormedCode reject junk without throwing", () => {
  for (const bad of [undefined, null, 123, {}, [], "", "short", "ABCDEFGHJKLMN"]) {
    assert.equal(isWellFormedCode(normalizeCode(bad)), false, String(bad));
  }
  // right length but contains characters outside the alphabet (I, O, 0, 1)
  for (const bad of ["ABCDEFGHI0", "OOOOOOOOOO", "1111111111", "ABCDE_FGHJ"]) {
    assert.equal(isWellFormedCode(normalizeCode(bad)), false, bad);
  }
});

test("device keys are prefixed, long, url-safe and unique", () => {
  const keys = Array.from({ length: 200 }, generateDeviceKey);
  assert.equal(new Set(keys).size, 200);
  for (const key of keys) {
    assert.ok(key.startsWith(DEVICE_KEY_PREFIX));
    assert.match(key.slice(DEVICE_KEY_PREFIX.length), /^[A-Za-z0-9_-]{43}$/); // 32 bytes of base64url
  }
});

test("sha256 is the standard hex digest", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("cleanText strips control characters, trims and bounds length", () => {
  assert.equal(cleanText("  Nidhi's MacBook\u0000\u001b[31m  ", 60), "Nidhi's MacBook[31m");
  assert.equal(cleanText("x".repeat(100), 60).length, 60);
  assert.equal(cleanText("line1\nline2", 60), "line1line2");
  for (const bad of [undefined, null, 5, {}, []]) assert.equal(cleanText(bad, 60), "");
});
