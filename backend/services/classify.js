// Single source of truth for turning a raw (app_name, window_title) sample into a
// { site, category } label. Runs once at ingest and the result is stored on the row.
//
// Originally ported from ml-service/core/processor.py (classify_activity). The rules here have
// since moved on (more sites, Windows app names, title cleaning); that file is no longer the reference.
//
// A browser tab is recognised in two ways:
//   1. By its domain, when the sensor could read it ("linkedin.com"). This is exact, and a domain
//      the table doesn't know is shown as itself ("prabhupada.world") rather than hidden.
//   2. By its window title ("Feed | LinkedIn - Google Chrome - Techy") when there is no domain
//      (Firefox, Windows, an older sensor, no permission). Titles only sometimes name the site,
//      so what is left stays "Other website".

const { guessFromApp, guessFromHost, guessFromTitle } = require("./guess");

const CATEGORIES = ["Productive", "Neutral", "Distraction", "Idle"];

// ---- apps -------------------------------------------------------------------------------
// macOS reports an app's display name ("Brave Browser"), Windows the process name ("brave.exe").
// Both are compared lower-cased and without ".exe" so they reach the same entry.
const appKey = (name) => String(name ?? "").trim().toLowerCase().replace(/\.exe$/, "");

const BROWSERS = new Set([
  "google chrome",
  "chrome",
  "chromium",
  "brave",
  "brave browser",
  "microsoft edge",
  "msedge",
  "firefox",
  "safari",
  "opera",
  "vivaldi",
  "arc",
]);

// appKey -> [site, category]
const DESKTOP_SITE_MAP = new Map([
  ["visual studio code", ["VS Code", "Productive"]],
  ["code", ["VS Code", "Productive"]],
  ["cursor", ["Cursor", "Productive"]],
  ["terminal", ["Terminal", "Productive"]],
  ["iterm2", ["Terminal", "Productive"]],
  ["iterm", ["Terminal", "Productive"]],
  ["windowsterminal", ["Terminal", "Productive"]],
  ["powershell", ["Terminal", "Productive"]],
  ["pwsh", ["Terminal", "Productive"]],
  ["cmd", ["Terminal", "Productive"]],
  ["warp", ["Terminal", "Productive"]],
  ["alacritty", ["Terminal", "Productive"]],
  ["wezterm", ["Terminal", "Productive"]],
  ["postman", ["Postman", "Productive"]],
  ["intellij", ["IntelliJ", "Productive"]],
  ["intellij idea", ["IntelliJ", "Productive"]],
  ["pycharm", ["PyCharm", "Productive"]],
  ["webstorm", ["WebStorm", "Productive"]],
  ["claude", ["Claude", "Productive"]],
  ["chatgpt", ["ChatGPT", "Productive"]],
  // Mainstream apps whose names are too ambiguous (or too glued together) for the keyword guess in
  // services/guess.js. Everything not listed here is guessed from its name instead.
  ["xcode", ["Xcode", "Productive"]],
  ["android studio", ["Android Studio", "Productive"]],
  ["studio64", ["Android Studio", "Productive"]],
  ["visual studio", ["Visual Studio", "Productive"]],
  ["devenv", ["Visual Studio", "Productive"]],
  ["idea64", ["IntelliJ", "Productive"]],
  ["pycharm64", ["PyCharm", "Productive"]],
  ["webstorm64", ["WebStorm", "Productive"]],
  ["rider", ["Rider", "Productive"]],
  ["rider64", ["Rider", "Productive"]],
  ["zed", ["Zed", "Productive"]],
  ["sublime text", ["Sublime Text", "Productive"]],
  ["notepad++", ["Notepad++", "Productive"]],
  ["obsidian", ["Obsidian", "Productive"]],
  ["notion", ["Notion", "Productive"]],
  ["figma", ["Figma", "Productive"]],
  ["microsoft word", ["Word", "Productive"]],
  ["winword", ["Word", "Productive"]],
  ["microsoft excel", ["Excel", "Productive"]],
  ["excel", ["Excel", "Productive"]],
  ["microsoft powerpoint", ["PowerPoint", "Productive"]],
  ["powerpnt", ["PowerPoint", "Productive"]],
  ["microsoft onenote", ["OneNote", "Productive"]],
  ["onenote", ["OneNote", "Productive"]],
  ["pages", ["Pages", "Productive"]],
  ["numbers", ["Numbers", "Productive"]],
  ["keynote", ["Keynote", "Productive"]],
  ["docker desktop", ["Docker", "Productive"]],
  ["github desktop", ["GitHub Desktop", "Productive"]],
  ["anki", ["Anki", "Productive"]],
  ["apnacollege", ["ApnaCollege", "Productive"]],
  ["steam", ["Steam", "Distraction"]],
  ["epicgameslauncher", ["Epic Games", "Distraction"]],
  ["epic games launcher", ["Epic Games", "Distraction"]],
  ["netflix", ["Netflix", "Distraction"]],
  // Chat and meetings: neither helps nor hurts the score (the user's call). Listed so they are fixed
  // by name and the keyword guess is never consulted for them.
  ["microsoft teams", ["Microsoft Teams", "Neutral"]],
  ["teams", ["Microsoft Teams", "Neutral"]],
  ["ms-teams", ["Microsoft Teams", "Neutral"]],
  ["slack", ["Slack", "Neutral"]],
  ["zoom.us", ["Zoom", "Neutral"]],
  ["zoom", ["Zoom", "Neutral"]],
  ["discord", ["Discord", "Neutral"]],
  ["spotify", ["Spotify", "Neutral"]],
  ["finder", ["Finder", "Neutral"]],
  ["explorer", ["File Explorer", "Neutral"]],
  // Nothing is being used: the desktop itself, a lock screen, or no window at all.
  ["desktop", ["Idle", "Idle"]],
  ["unknown", ["Idle", "Idle"]],
  ["lockapp", ["Idle", "Idle"]],
  ["loginwindow", ["Idle", "Idle"]],
]);

// ---- browser tabs -----------------------------------------------------------------------
// [site, category, ...needles]. The first rule with a matching needle wins, so order matters.
// A needle is a lower-case phrase matched on word boundaries (so "mega" does not hit "megatron"),
// or a RegExp that describes the shape of a whole title. For names too short or too common to
// trust anywhere in a title, the last part of the title (where the site name sits: "... | MEGA")
// is the only place looked at:
//   "$mega"     the last part ENDS with the phrase (optionally followed by a count, "MEGA 52%")
//   "=new tab"  the last part IS exactly the phrase
const GITHUB_REPO_PAGE = /^[\w.-]+\/[\w.-]+: /; //                "owner/repo: description"
const GITHUB_FILE_PAGE = / at [\w./-]+ · [\w.-]+\/[\w.-]+$/; //  "path/file at main · owner/repo"

const WEBSITE_RULES = [
  // Search first: "claude pricing - Google Search" is a search, not time spent in Claude.
  ["Google Search", "Neutral", "google search"],

  ["ChatGPT", "Productive", "chatgpt"],
  ["Claude", "Productive", "claude"],
  ["GitHub", "Productive", "github", GITHUB_REPO_PAGE, GITHUB_FILE_PAGE],
  ["Stack Overflow", "Productive", "stack overflow", "stackoverflow"],
  ["LeetCode", "Productive", "leetcode"],
  ["GeeksforGeeks", "Productive", "geeksforgeeks"],
  ["HackerRank", "Productive", "hackerrank"],
  ["Codeforces", "Productive", "codeforces"],
  ["CodeChef", "Productive", "codechef"],
  ["Coursera", "Productive", "coursera"],
  ["Udemy", "Productive", "udemy"],
  ["W3Schools", "Productive", "w3schools"],
  ["MDN Docs", "Productive", "developer.mozilla", "mdn web docs"],
  ["freeCodeCamp", "Productive", "freecodecamp"],
  ["Kaggle", "Productive", "kaggle"],
  ["Notion", "Productive", "notion"],
  ["Overleaf", "Productive", "overleaf"],
  ["Figma", "Productive", "figma"],
  ["Google Docs", "Productive", "google docs", "google sheets", "google slides"],
  ["Jira", "Productive", "jira"],
  ["Render", "Productive", "render dashboard"],
  ["MongoDB", "Productive", "mongodb"],
  ["Vercel", "Productive", "vercel"],
  ["Netlify", "Productive", "netlify"],
  ["Monkeytype", "Productive", "monkeytype"],
  // Office in the browser counts like desktop Excel/Word/PowerPoint. "$excel" only at the END of the
  // title ("Book1 - Excel"): the word is far too common to trust anywhere in one.
  ["Microsoft 365", "Productive", "microsoft 365", "$excel", "$powerpoint"],

  ["Hotstar", "Distraction", "hotstar"],
  ["Netflix", "Distraction", "netflix"],
  ["Prime Video", "Distraction", "prime video"],
  ["Instagram", "Distraction", "instagram"],
  ["Facebook", "Distraction", "facebook"],
  ["Twitter/X", "Distraction", "twitter", "=x"],
  ["Reddit", "Distraction", "reddit"],
  ["Twitch", "Distraction", "twitch"],
  ["Pinterest", "Distraction", "pinterest"],
  ["Snapchat", "Distraction", "snapchat"],
  ["TikTok", "Distraction", "tiktok"],
  ["YouTube", "Distraction", "youtube"],

  // Named so they stop hiding in "Other website"; neither helps nor hurts the focus score.
  ["LinkedIn", "Neutral", "linkedin"],
  ["Gmail", "Neutral", "gmail"],
  ["Google Drive", "Neutral", "google drive"],
  ["Google Calendar", "Neutral", "google calendar"],
  ["Google Meet", "Neutral", "google meet"],
  ["WhatsApp", "Neutral", "whatsapp"],
  ["Microsoft Teams", "Neutral", "microsoft teams"],
  ["Slack", "Neutral", "$slack"],
  ["Zoom", "Neutral", "$zoom"],
  ["Canva", "Neutral", "canva"],
  ["Wikipedia", "Neutral", "wikipedia"],
  ["Medium", "Neutral", "$medium"],
  ["Hugging Face", "Productive", "hugging face"],
  ["Google Colab", "Productive", "$colab"],
  ["MEGA", "Neutral", "$mega"],
  ["New tab", "Neutral", "=new tab", "=new incognito tab"],
];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const AFTER_PHRASE = "(?![a-z0-9])";

// The pattern a needle becomes (see the notes above WEBSITE_RULES for the three forms).
const needleRegExp = (needle) => {
  if (needle.startsWith("=")) return new RegExp(`^${escapeRegExp(needle.slice(1))}$`);
  if (needle.startsWith("$")) {
    return new RegExp(`(?<![a-z0-9])${escapeRegExp(needle.slice(1))}(?:\\s+\\d+%?)?$`);
  }
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(needle)}${AFTER_PHRASE}`);
};

const COMPILED_RULES = WEBSITE_RULES.map(([site, category, ...needles]) => {
  const shapes = needles.filter((n) => n instanceof RegExp); // checked on the whole title, first
  const phrases = needles.filter((n) => typeof n === "string");
  return {
    site,
    category,
    shapes,
    everywhere: phrases.filter((p) => !/^[=$]/.test(p)).map(needleRegExp),
    trailing: phrases.map(needleRegExp),
  };
});

// ---- domains ----------------------------------------------------------------------------
// The sensor sends only the host name of the active tab ("www.linkedin.com" -> "linkedin.com"),
// never the path or query. A domain matches itself and every subdomain ("old.reddit.com").
// Every site named here must also exist in WEBSITE_RULES, which is where its category comes from.
const SITE_DOMAINS = new Map(
  Object.entries({
    "LinkedIn": ["linkedin.com"],
    "ChatGPT": ["chatgpt.com", "chat.openai.com"],
    "Claude": ["claude.ai"],
    "GitHub": ["github.com"],
    "Stack Overflow": ["stackoverflow.com"],
    "LeetCode": ["leetcode.com"],
    "GeeksforGeeks": ["geeksforgeeks.org"],
    "HackerRank": ["hackerrank.com"],
    "Codeforces": ["codeforces.com"],
    "CodeChef": ["codechef.com"],
    "Coursera": ["coursera.org"],
    "Udemy": ["udemy.com"],
    "W3Schools": ["w3schools.com"],
    "MDN Docs": ["developer.mozilla.org"],
    "freeCodeCamp": ["freecodecamp.org"],
    "Kaggle": ["kaggle.com"],
    "Notion": ["notion.so", "notion.site"],
    "Overleaf": ["overleaf.com"],
    "Figma": ["figma.com"],
    "Google Docs": ["docs.google.com"],
    "Render": ["render.com"],
    "MongoDB": ["mongodb.com"],
    "Vercel": ["vercel.com"],
    "Netlify": ["netlify.com"],
    "Monkeytype": ["monkeytype.com"],
    "Microsoft 365": ["office.com", "office365.com", "microsoft365.com"],
    "Microsoft Teams": ["teams.microsoft.com", "teams.live.com"],
    "Hugging Face": ["huggingface.co"],
    "Google Colab": ["colab.research.google.com"],
    "Hotstar": ["hotstar.com"],
    "Netflix": ["netflix.com"],
    "Prime Video": ["primevideo.com"],
    "Instagram": ["instagram.com"],
    "Facebook": ["facebook.com"],
    "Twitter/X": ["twitter.com", "x.com"],
    "Reddit": ["reddit.com"],
    "Twitch": ["twitch.tv"],
    "Pinterest": ["pinterest.com"],
    "Snapchat": ["snapchat.com"],
    "TikTok": ["tiktok.com"],
    "YouTube": ["youtube.com", "youtu.be"],
    "Gmail": ["mail.google.com"],
    "Google Drive": ["drive.google.com"],
    "Google Calendar": ["calendar.google.com"],
    "Google Meet": ["meet.google.com"],
    "WhatsApp": ["whatsapp.com"],
    "Slack": ["slack.com"],
    "Zoom": ["zoom.us"],
    "Canva": ["canva.com"],
    "Wikipedia": ["wikipedia.org"],
    "Medium": ["medium.com"],
    "MEGA": ["mega.nz", "mega.io"],
  }).flatMap(([site, domains]) => domains.map((domain) => [domain, site])),
);

const CATEGORY_OF_SITE = new Map(WEBSITE_RULES.map(([site, category]) => [site, category]));

const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// A host name as the sensor sends it, or null when it isn't one. Accepts a leading "www.".
const normalizeDomain = (value) => {
  if (typeof value !== "string") return null;
  const host = value.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (!host || host.length > 253) return null;
  return host.split(".").every((label) => DOMAIN_LABEL.test(label)) ? host : null;
};

const siteOfDomain = (host) => {
  const labels = host.split(".");
  // Most specific first ("colab.research.google.com" before "google.com"), never the bare TLD.
  for (let i = 0; i < labels.length - 1; i++) {
    const site = SITE_DOMAINS.get(labels.slice(i).join("."));
    if (site) return site;
  }
  return null;
};

// What to call a domain the table doesn't know. Normally the registrable part ("mail.example.com"
// -> "example.com"), but hosts that serve many unrelated sites keep their subdomain
// ("gemini.google.com", "someone.vercel.app") because the parent says nothing.
const SECOND_LEVEL_LABELS = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);
const MULTI_TENANT_DOMAINS = new Set([
  "google.com",
  "microsoft.com",
  "amazon.com",
  "apple.com",
  "atlassian.net",
  "github.io",
  "vercel.app",
  "netlify.app",
  "herokuapp.com",
  "onrender.com",
  "pages.dev",
  "web.app",
  "firebaseapp.com",
]);

const labelOfDomain = (host) => {
  const labels = host.split(".");
  if (labels.length <= 2 || /^\d+(\.\d+){3}$/.test(host)) return host; // "localhost", an IPv4 address
  const keep = labels.at(-1).length === 2 && SECOND_LEVEL_LABELS.has(labels.at(-2)) ? 3 : 2;
  const registrable = labels.slice(-keep).join(".");
  return MULTI_TENANT_DOMAINS.has(registrable) ? host : registrable;
};

// ---- titles -----------------------------------------------------------------------------
// Chrome-style window titles are "<page title> - Google Chrome - <profile>". Only the page title
// says anything about the site; the browser and profile names must not take part in matching.
const BROWSER_SUFFIX =
  /\s[-–—]\s(?:google chrome|brave|microsoft\W*edge|mozilla firefox|chromium|vivaldi|opera)\b.*$/i;
// Status notes Chrome adds to a tab: "Audio playing", "High memory usage - 1.6 GB".
const TAB_STATUS =
  /(?:\s[-–—]\s(?:audio playing|high memory usage(?:\s[-–—]\s[\d.,]+\s?[kmg]b)?|using camera|using microphone))+$/i;
const UNREAD_COUNT = /^\(\d+\)\s*/; // "(3) Inbox"

const cleanTitle = (title) =>
  String(title ?? "")
    .replace(BROWSER_SUFFIX, "")
    .replace(TAB_STATUS, "")
    .replace(UNREAD_COUNT, "")
    .trim()
    .toLowerCase();

const TITLE_SEPARATOR = /\s[-–—|·・/]\s/; // " - ", " – ", " — ", " | ", " · ", " ・ ", " / "
const MAX_SITE_NAME_LENGTH = 40; // a longer last part is a description or page title, not a site name

const siteOfTitle = (title) => {
  // 0. A page's overall shape ("owner/repo: description") beats any word inside it: a repo
  //    called "youtube-clone" is still a GitHub page.
  for (const rule of COMPILED_RULES) {
    if (rule.shapes.some((re) => re.test(title))) return rule;
  }
  const last = title.split(TITLE_SEPARATOR).pop().trim();
  // 1. The site name at the end of the title is the most reliable signal.
  //    "Cracking the Coding Interview - YouTube" is YouTube, whatever else the title mentions.
  if (last.length <= MAX_SITE_NAME_LENGTH) {
    for (const rule of COMPILED_RULES) {
      if (rule.trailing.some((re) => re.test(last))) return rule;
    }
  }
  // 2. Otherwise look anywhere in the title.
  for (const rule of COMPILED_RULES) {
    if (rule.everywhere.some((re) => re.test(title))) return rule;
  }
  return null;
};

// `domain` is optional: the host name of the active browser tab, when the sensor could read it.
//
// Order: a known website (by host, then by title), a known desktop app, and only then a guess from
// the words in the name (services/guess.js). The guess changes the CATEGORY of a name no rule knows;
// the site label stays what the sensor reported ("prabhupada.world", "Other website", the app name).
const classify = (appName, windowTitle = "", domain = null) => {
  const key = appKey(appName);

  if (BROWSERS.has(key)) {
    const title = cleanTitle(windowTitle);
    const host = normalizeDomain(domain);
    if (host) {
      const site = siteOfDomain(host);
      if (site) return { site, category: CATEGORY_OF_SITE.get(site) };
      // google.com is search results, Maps, Translate...: only its titles can tell search apart.
      if (/^google\.[a-z.]+$/.test(host)) {
        const rule = siteOfTitle(title);
        if (rule?.site === "Google Search") return { site: rule.site, category: rule.category };
      }
      return { site: labelOfDomain(host), category: guessFromHost(host, title) };
    }

    const rule = siteOfTitle(title);
    return rule
      ? { site: rule.site, category: rule.category }
      : { site: "Other website", category: guessFromTitle(title) };
  }

  if (DESKTOP_SITE_MAP.has(key)) {
    const [site, category] = DESKTOP_SITE_MAP.get(key);
    return { site, category };
  }

  return { site: String(appName ?? "").replace(/\.exe$/i, ""), category: guessFromApp(appName) };
};

module.exports = { classify, normalizeDomain, appKey, CATEGORIES, SITE_DOMAINS, WEBSITE_RULES };
