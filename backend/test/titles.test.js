const test = require("node:test");
const assert = require("node:assert/strict");
const { buildLive } = require("../services/focus");

const NOW = Date.parse("2026-10-04T12:00:00Z");
const row = (app_name, window_title, i = 0) => ({
  app_name,
  window_title,
  timestamp: new Date(NOW - i * 10_000),
});
const many = (n, app, title) => Array.from({ length: n }, (_, i) => row(app, title, i));
const flag = (rows) => buildLive(rows, NOW, NOW).sensor.titles_unreadable;

test("titles_unreadable: every title 'Unknown' while the app is known -> flagged", () => {
  assert.equal(flag(many(10, "Google Chrome", "Unknown")), true);
  assert.equal(flag([...many(5, "Terminal", "Unknown"), ...many(5, "Google Chrome", "Unknown")]), true);
});

test("titles_unreadable: readable titles -> not flagged", () => {
  assert.equal(flag(many(10, "Google Chrome", "Feed | LinkedIn - Google Chrome")), false);
});

test("titles_unreadable: needs enough samples to say anything", () => {
  assert.equal(flag(many(5, "Google Chrome", "Unknown")), false);
  assert.equal(flag(many(6, "Google Chrome", "Unknown")), true);
  assert.equal(flag([]), false);
});

test("titles_unreadable: a few unreadable titles among readable ones is normal", () => {
  const rows = (unknown, readable) => [
    ...many(unknown, "Google Chrome", "Unknown"),
    ...many(readable, "Google Chrome", "GitHub - aura"),
  ];
  assert.equal(flag(rows(9, 1)), true); // 90%
  assert.equal(flag(rows(8, 2)), true); // 80%
  assert.equal(flag(rows(7, 3)), false); // 70%
  assert.equal(flag(rows(2, 18)), false);
});

test("titles_unreadable: apps that have no title anyway are not evidence", () => {
  assert.equal(flag(many(30, "Finder", "Unknown")), false);
  assert.equal(flag(many(30, "explorer.exe", "")), false);
  assert.equal(flag(many(30, "Desktop", "Home")), false);
  assert.equal(flag(many(30, "Unknown", "Unknown")), false);
  assert.equal(flag(many(30, "LockApp.exe", "Windows Default Lock Screen")), false);
  // ...and they don't dilute real evidence either
  assert.equal(flag([...many(30, "Finder", "Unknown"), ...many(8, "Google Chrome", "Unknown")]), true);
});

test("titles_unreadable: empty titles count like 'Unknown'; rows with no title field say nothing", () => {
  assert.equal(flag(many(10, "Google Chrome", "")), true);
  assert.equal(flag(many(10, "Google Chrome", "  UNKNOWN ")), true);
  const legacy = Array.from({ length: 10 }, (_, i) => ({ app_name: "Google Chrome", timestamp: new Date(NOW - i * 1000) }));
  assert.equal(flag(legacy), false);
});

test("titles_unreadable does not disturb the rest of the live payload", () => {
  const live = buildLive(many(10, "Terminal", "Unknown"), NOW, NOW);
  assert.equal(live.sensor.online, true);
  assert.equal(live.focus_score, 100);
  assert.deepEqual(Object.keys(live.sensor).sort(), ["last_seen", "online", "titles_unreadable"]);
});
