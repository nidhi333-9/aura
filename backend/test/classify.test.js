const test = require("node:test");
const assert = require("node:assert/strict");
const { classify } = require("../services/classify");

// [app, window title, expected site, expected category]. Titles are real ones the sensor sent.
const CASES = [
  // The site name sits at the end of the title.
  ["Google Chrome", "Feed | LinkedIn - Google Chrome – Techy", "LinkedIn", "Neutral"],
  ["Google Chrome", "Log in | MongoDB - Google Chrome – Techy", "MongoDB", "Productive"],
  ["Google Chrome", "Clusters | Cloud: MongoDB Cloud - Google Chrome – Techy", "MongoDB", "Productive"],
  ["Google Chrome", "aura-backend ・ Web Service ・ Render Dashboard - Google Chrome – Techy", "Render", "Productive"],
  ["Google Chrome", "Your projects - Overleaf, Online LaTeX Editor - Google Chrome – Techy", "Overleaf", "Productive"],
  ["Google Chrome", "Home - Google Drive - Google Chrome – Techy", "Google Drive", "Neutral"],
  ["Google Chrome", "Vercel - Google Chrome – Techy", "Vercel", "Productive"],
  ["Google Chrome", "CodeChef User | CodeChef - Google Chrome – Techy", "CodeChef", "Productive"],

  // Chrome's tab notes and unread counts are not part of the page.
  ["Google Chrome", "Feed | LinkedIn - High memory usage - 1.6 GB - Google Chrome – Techy", "LinkedIn", "Neutral"],
  ["Google Chrome", "Feed | LinkedIn – Audio playing - High memory usage - 2.6 GB - Google Chrome – Techy", "LinkedIn", "Neutral"],
  ["Google Chrome", "(3) Inbox (12) - me@example.com - Gmail - Google Chrome", "Gmail", "Neutral"],
  ["Google Chrome", "frontend – Audio playing - Google Chrome – Techy", "Other website", "Neutral"],

  // A search is a search; a video is a video, whatever else the title mentions.
  ["Google Chrome", "claude pricing - Google Search - Google Chrome – Techy", "Google Search", "Neutral"],
  ["Google Chrome", "mongodb atlas - Google Search - Google Chrome – Techy", "Google Search", "Neutral"],
  ["Google Chrome", "Don't Pay for Claude Pro! Use This Free Trick Instead! - YouTube - Google Chrome", "YouTube", "Distraction"],
  ["Google Chrome", "How I use GitHub Copilot - YouTube - Google Chrome – Techy", "YouTube", "Distraction"],

  // GitHub pages that never say "GitHub", and a repo named after another site.
  ["Google Chrome", "black-shadows/Cracking-the-Coding-Interview: Learn how to uncover the hints - Google Chrome", "GitHub", "Productive"],
  ["Google Chrome", "aura/tracker at main · nidhi333-9/aura - Google Chrome – Techy", "GitHub", "Productive"],
  ["Google Chrome", "src/app at main · someone/youtube-clone - Google Chrome", "GitHub", "Productive"],
  ["Google Chrome", "GitHub - ytdl-org/youtube-dl: Command-line program to download videos from YouTube.com", "GitHub", "Productive"],

  // The browser's and profile's own names must not take part in matching.
  ["Google Chrome", "Aura - Google Chrome – GitHub", "Other website", "Neutral"],
  ["Google Chrome", "Some blog - Google Chrome – Claude", "Other website", "Neutral"],

  // Whole words only; short names only where the site name sits.
  ["Google Chrome", "Megatron explained", "Other website", "Neutral"],
  ["Google Chrome", "Notional value of a derivative", "Other website", "Neutral"],
  ["Google Chrome", "Download - MEGA 52% - Google Chrome – Techy", "MEGA", "Neutral"],
  ["Google Chrome", "53.81 MB file on MEGA - Google Chrome – Techy", "MEGA", "Neutral"],
  ["Google Chrome", "Home / X - Google Chrome", "Twitter/X", "Distraction"],
  ["Google Chrome", "Algebra: solve for x", "Other website", "Neutral"],
  ["Google Chrome", "(1) New Tab - Google Chrome – Techy", "New tab", "Neutral"],
  ["Google Chrome", "New Incognito Tab - Google Chrome", "New tab", "Neutral"],

  // Other browsers and Windows process names reach the same rules.
  ["chrome.exe", "(78) WhatsApp - Google Chrome", "WhatsApp", "Neutral"],
  ["brave.exe", "mern-chat-app/backend at master · piyush-eon/mern-chat-app · GitHub - Brave", "GitHub", "Productive"],
  ["Brave Browser", "Feed | LinkedIn - Brave", "LinkedIn", "Neutral"],
  ["msedge.exe", "Home - Google Drive - Microsoft​ Edge", "Google Drive", "Neutral"],
  ["Firefox", "Feed | LinkedIn — Mozilla Firefox", "LinkedIn", "Neutral"],
  ["Safari", "Feed | LinkedIn", "LinkedIn", "Neutral"],
  ["chrome.exe", "Aura - Google Chrome", "Other website", "Neutral"],

  // Desktop apps, Windows included.
  ["Code.exe", "BinaryString.cpp - CPP - Visual Studio Code", "VS Code", "Productive"],
  ["WindowsTerminal.exe", "Windows PowerShell", "Terminal", "Productive"],
  ["IntelliJ IDEA", "Main.java", "IntelliJ", "Productive"],
  ["explorer.exe", "Downloads", "File Explorer", "Neutral"],
  ["LockApp.exe", "Windows Default Lock Screen", "Idle", "Idle"],
  ["loginwindow", "", "Idle", "Idle"],
  ["notepad.exe", "notes.txt", "notepad", "Neutral"],
];

for (const [app, title, site, category] of CASES) {
  test(`classify ${app} | ${title.slice(0, 60)}`, () => {
    assert.deepEqual(classify(app, title), { site, category });
  });
}

test("classify never throws on odd input", () => {
  for (const [app, title] of [
    [undefined, undefined],
    [null, null],
    ["Google Chrome", 42],
    ["Google Chrome", "x".repeat(5000)],
    ["Google Chrome", " - ".repeat(500)],
    ["Google Chrome", "(((((" + " - High memory usage".repeat(200)],
  ]) {
    const result = classify(app, title);
    assert.equal(typeof result.site, "string");
    assert.ok(["Productive", "Neutral", "Distraction", "Idle"].includes(result.category));
  }
});

test("classify stays fast on long, repetitive titles", () => {
  const nasty = "Feed | " + "a - ".repeat(120) + " - High memory usage".repeat(120) + " - Google Chrome";
  const start = process.hrtime.bigint();
  for (let i = 0; i < 200; i++) classify("Google Chrome", nasty);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 1000, `200 classifications took ${ms.toFixed(0)} ms`);
});

// ---------------------------------------------------------------- domains (sent by newer sensors)
const { normalizeDomain, SITE_DOMAINS, WEBSITE_RULES } = require("../services/classify");

// [app, window title, domain, expected site, expected category]
const DOMAIN_CASES = [
  // Titles that name no site: exactly what titles alone could never get right.
  ["Google Chrome", "Fix Port Conflict", "chatgpt.com", "ChatGPT", "Productive"],
  ["Google Chrome", "Print 1 to 5 - Problems", "codechef.com", "CodeChef", "Productive"],
  ["Google Chrome", "Explain Max Profit Pattern", "chatgpt.com", "ChatGPT", "Productive"],
  ["Google Chrome", "Untitled", "claude.ai", "Claude", "Productive"],

  // Subdomains reach the parent's site; www is ignored.
  ["Google Chrome", "x", "www.linkedin.com", "LinkedIn", "Neutral"],
  ["Google Chrome", "x", "old.reddit.com", "Reddit", "Distraction"],
  ["Google Chrome", "x", "web.whatsapp.com", "WhatsApp", "Neutral"],
  ["Google Chrome", "x", "dashboard.render.com", "Render", "Productive"],
  ["Google Chrome", "x", "gist.github.com", "GitHub", "Productive"],
  ["Google Chrome", "x", "youtu.be", "YouTube", "Distraction"],
  ["Google Chrome", "x", "twitter.com", "Twitter/X", "Distraction"],
  ["Google Chrome", "x", "x.com", "Twitter/X", "Distraction"],

  // Google hosts many things; its subdomains must not all become "Google".
  ["Google Chrome", "x", "mail.google.com", "Gmail", "Neutral"],
  ["Google Chrome", "x", "docs.google.com", "Google Docs", "Productive"],
  ["Google Chrome", "x", "colab.research.google.com", "Google Colab", "Productive"],
  ["Google Chrome", "x", "gemini.google.com", "gemini.google.com", "Neutral"],
  ["Google Chrome", "claude pricing - Google Search - Google Chrome", "google.com", "Google Search", "Neutral"],
  ["Google Chrome", "Google Maps - Google Chrome", "google.com", "google.com", "Neutral"],
  ["Google Chrome", "mongodb atlas - Google Search", "www.google.co.in", "Google Search", "Neutral"],

  // A domain the table doesn't know is shown as itself, not hidden in "Other website".
  ["Google Chrome", "Courses · Prabhupada World", "prabhupada.world", "prabhupada.world", "Neutral"],
  ["Google Chrome", "x", "mail.example.com", "example.com", "Neutral"],
  ["Google Chrome", "x", "news.bbc.co.uk", "bbc.co.uk", "Neutral"],
  ["Google Chrome", "x", "someone.vercel.app", "someone.vercel.app", "Neutral"],
  ["Google Chrome", "x", "localhost", "localhost", "Neutral"],
  ["Google Chrome", "x", "192.168.0.10", "192.168.0.10", "Neutral"],

  // The domain is the truth: words in the title must not override it.
  ["Google Chrome", "How I use Claude every day - my blog", "myblog.dev", "myblog.dev", "Neutral"],
  ["Google Chrome", "GitHub Copilot tutorial", "youtube.com", "YouTube", "Distraction"],

  // Windows/Brave names work the same when a domain is present.
  ["brave.exe", "x", "linkedin.com", "LinkedIn", "Neutral"],
  ["Brave Browser", "x", "leetcode.com", "LeetCode", "Productive"],
];

for (const [app, title, domain, site, category] of DOMAIN_CASES) {
  test(`classify with domain ${domain} | ${title.slice(0, 40)}`, () => {
    assert.deepEqual(classify(app, title, domain), { site, category });
  });
}

test("a bad or missing domain is ignored and the title rules still apply", () => {
  for (const domain of [undefined, null, "", "   ", 42, {}, "not a host", "evil.com/../x", "a..b", "-bad.com", "javascript:alert(1)", "x".repeat(300)]) {
    assert.deepEqual(classify("Google Chrome", "Feed | LinkedIn - Google Chrome", domain), {
      site: "LinkedIn",
      category: "Neutral",
    });
    assert.deepEqual(classify("Google Chrome", "some blog", domain), { site: "Other website", category: "Neutral" });
  }
});

test("a domain is only used for browsers", () => {
  assert.deepEqual(classify("Code", "x", "github.com"), { site: "VS Code", category: "Productive" });
  assert.deepEqual(classify("Slack", "general", "linkedin.com"), { site: "Slack", category: "Neutral" });
});

test("normalizeDomain", () => {
  assert.equal(normalizeDomain("WWW.LinkedIn.com"), "linkedin.com");
  assert.equal(normalizeDomain(" example.com. "), "example.com");
  assert.equal(normalizeDomain("localhost"), "localhost");
  assert.equal(normalizeDomain("xn--80ak6aa92e.com"), "xn--80ak6aa92e.com");
  for (const bad of ["", "a b.com", "a..com", "a_b.com", "-a.com", "a-.com", "http://x.com", "x.com/path", "x.com:80", null, undefined, 7, "a".repeat(64) + ".com", `${"a.".repeat(130)}com`]) {
    assert.equal(normalizeDomain(bad), null, `should reject ${JSON.stringify(bad)?.slice(0, 40)}`);
  }
});

test("every site that has a domain also has a rule (and so a category)", () => {
  const known = new Set(WEBSITE_RULES.map(([site]) => site));
  for (const [domain, site] of SITE_DOMAINS) {
    assert.ok(known.has(site), `${domain} -> "${site}" has no entry in WEBSITE_RULES`);
  }
});
