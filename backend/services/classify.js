// Single source of truth for turning a raw (app_name, window_title) sample into a
// { site, category } label. Runs once at ingest and the result is stored on the row.
//
// Ported from ml-service/core/processor.py (classify_activity); the rules and their
// order are identical. If you change a rule here, that file is no longer the reference.

const CATEGORIES = ["Productive", "Neutral", "Distraction", "Idle"];

const BROWSER_APPS = new Set([
  "Google Chrome",
  "Safari",
  "Firefox",
  "Brave",
  "Microsoft Edge",
]);

// Exact app_name -> [site, category]
const DESKTOP_SITE_MAP = new Map([
  ["Visual Studio Code", ["VS Code", "Productive"]],
  ["Code", ["VS Code", "Productive"]],
  ["Cursor", ["Cursor", "Productive"]],
  ["Terminal", ["Terminal", "Productive"]],
  ["iTerm2", ["Terminal", "Productive"]],
  ["Postman", ["Postman", "Productive"]],
  ["IntelliJ", ["IntelliJ", "Productive"]],
  ["PyCharm", ["PyCharm", "Productive"]],
  ["Claude", ["Claude", "Productive"]],
  ["ChatGPT", ["ChatGPT", "Productive"]],
  ["Spotify", ["Spotify", "Neutral"]],
  ["Finder", ["Finder", "Neutral"]],
  ["Desktop", ["Idle", "Idle"]],
  ["Unknown", ["Idle", "Idle"]],
]);

// Browser tabs: first keyword found in the lower-cased window title wins, so order matters.
const WEBSITE_MAP = [
  ["chatgpt", "ChatGPT", "Productive"],
  ["claude", "Claude", "Productive"],
  ["github", "GitHub", "Productive"],
  ["stackoverflow", "Stack Overflow", "Productive"],
  ["leetcode", "LeetCode", "Productive"],
  ["geeksforgeeks", "GeeksforGeeks", "Productive"],
  ["hackerrank", "HackerRank", "Productive"],
  ["codeforces", "Codeforces", "Productive"],
  ["coursera", "Coursera", "Productive"],
  ["udemy", "Udemy", "Productive"],
  ["w3schools", "W3Schools", "Productive"],
  ["developer.mozilla", "MDN Docs", "Productive"],
  ["notion", "Notion", "Productive"],
  ["hotstar", "Hotstar", "Distraction"],
  ["netflix", "Netflix", "Distraction"],
  ["prime video", "Prime Video", "Distraction"],
  ["instagram", "Instagram", "Distraction"],
  ["facebook", "Facebook", "Distraction"],
  ["twitter", "Twitter/X", "Distraction"],
  ["reddit", "Reddit", "Distraction"],
  ["youtube", "YouTube", "Distraction"],
];

const classify = (appName, windowTitle = "") => {
  const title = String(windowTitle ?? "").toLowerCase();

  if (BROWSER_APPS.has(appName)) {
    for (const [keyword, site, category] of WEBSITE_MAP) {
      if (title.includes(keyword)) return { site, category };
    }
    return { site: "Other website", category: "Neutral" };
  }

  if (DESKTOP_SITE_MAP.has(appName)) {
    const [site, category] = DESKTOP_SITE_MAP.get(appName);
    return { site, category };
  }

  return { site: appName, category: "Neutral" };
};

module.exports = { classify, CATEGORIES };
