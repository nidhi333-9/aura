const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const axios = require("axios");

process.env.JWT_SECRET = "unit-test-secret";

const youtubeRouter = require("../routes/youtube");

const app = express();
app.use("/api", youtubeRouter);

let server;
let base;
const REAL_GET = axios.get;
test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  axios.get = REAL_GET; // axios is shared by the whole process: always put it back
  server.close();
});

const auth = { Authorization: `Bearer ${jwt.sign({ id: "6ac2400000000000000000aa" }, process.env.JWT_SECRET)}` };
const get = (query, headers = auth) => fetch(`${base}/api/youtube-recommendation${query}`, { headers });

let upstreamCalls;
const stubYouTube = (impl) => {
  upstreamCalls = [];
  axios.get = async (url, config) => { upstreamCalls.push({ url, config }); return impl(); };
};
const videos = (n) => ({ data: { items: Array.from({ length: n }, (_, i) => ({ id: { videoId: `v${i}` }, snippet: { title: `Video ${i}` } })) } });

test("it needs a login", async () => {
  stubYouTube(() => videos(1));
  assert.equal((await get("?type=focus", {})).status, 401);
  assert.equal((await get("?type=focus", { Authorization: "Bearer nope" })).status, 401);
  assert.equal(upstreamCalls.length, 0, "an anonymous caller must never cost a YouTube search");
});

test("only the three real types are accepted; anything else costs nothing", async () => {
  stubYouTube(() => videos(1));
  for (const query of ["", "?type=", "?type=made-up", "?type=FOCUS", "?type=__proto__", "?type=constructor", "?type=hasOwnProperty", "?type[]=focus", "?type=focus&type=relax", `?type=${"x".repeat(5000)}`]) {
    const res = await get(query);
    assert.equal(res.status, 400, `query ${query.slice(0, 40)}`);
    assert.match((await res.json()).error, /focus, relax or boost/);
  }
  assert.equal(upstreamCalls.length, 0, "no search may be spent on an invalid type");
});

test("a known type is searched once, then served from the cache", async () => {
  stubYouTube(() => videos(3));
  const first = await get("?type=focus");
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), [
    { id: "v0", title: "Video 0" },
    { id: "v1", title: "Video 1" },
    { id: "v2", title: "Video 2" },
  ]);
  const second = await get("?type=focus");
  assert.equal(second.status, 200);
  assert.equal((await second.json()).length, 3);
  assert.equal(upstreamCalls.length, 1, "the second request is answered from memory");
  assert.equal(upstreamCalls[0].config.params.q, "deep focus music");
});

test("if YouTube fails, the dashboard still gets that type's fallback list", async () => {
  stubYouTube(() => { throw new Error("quota exceeded"); });
  const res = await get("?type=relax");
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.ok(Array.isArray(list) && list.length >= 1);
  assert.ok(list.every((v) => typeof v.id === "string" && typeof v.title === "string"));
  assert.match(list[0].title, /Jazz|Ambient/i, "the relax fallback, not the focus one");
});
