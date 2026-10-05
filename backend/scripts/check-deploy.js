// Is the live backend running the newest code on GitHub?
//
//   node scripts/check-deploy.js                      checks https://aura-backend-hmq3.onrender.com against the main branch
//   node scripts/check-deploy.js --url https://...    another backend address
//   node scripts/check-deploy.js --repo owner/name    another GitHub repository
//
// It asks the backend which commit it runs (GET /api/version) and GitHub which commit main is at, and
// compares them. Exit code: 0 up to date, 1 behind or unknown, 2 could not check.
// It only reads two public pages and changes nothing.

const DEFAULT_URL = "https://aura-backend-hmq3.onrender.com";
const DEFAULT_REPO = "nidhi333-9/aura";
const WAKE_UP_ALLOWANCE_MS = 90 * 1000; // a sleeping free-tier server can take about a minute

// live: what /api/version said (or null if it has no such page); latest: { sha, message } from GitHub.
const judge = (live, latest) => {
  const newest = latest.sha.slice(0, 7);
  if (!live || typeof live.commit !== "string") {
    return {
      verdict: "UNKNOWN",
      exit: 1,
      text:
        "The live backend does not say which version it runs. That means it is an older version than " +
        `${newest} (the /api/version page is new), or it was started somewhere that does not report it.`,
    };
  }
  if (live.commit === newest) {
    return { verdict: "UP TO DATE", exit: 0, text: `The live backend runs ${live.commit}, the newest commit on GitHub.` };
  }
  return {
    verdict: "BEHIND",
    exit: 1,
    text:
      `The live backend runs ${live.commit} but GitHub has ${newest}` +
      `${latest.message ? ` ("${latest.message}")` : ""}. ` +
      "A deploy may still be running: wait 3 to 5 minutes and run this again. " +
      "If it stays behind, look at Events and Settings (Auto-Deploy) of the service in Render.",
  };
};

const optionValue = (argv, name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1] || fallback;
};

async function main() {
  const argv = process.argv;
  const url = optionValue(argv, "--url", DEFAULT_URL).replace(/\/+$/, "");
  const repo = optionValue(argv, "--repo", DEFAULT_REPO);

  let latest;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/main`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "aura-check-deploy" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`GitHub answered HTTP ${res.status}`);
    const body = await res.json();
    latest = { sha: body.sha, message: String(body.commit?.message ?? "").split("\n")[0].slice(0, 70) };
  } catch (err) {
    console.error(`Could not ask GitHub (${err.message}). Nothing was checked.`);
    return process.exit(2);
  }

  let live = null;
  try {
    const res = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(WAKE_UP_ALLOWANCE_MS) });
    if (res.ok) live = await res.json();
    else if (res.status !== 404 && res.status !== 401) throw new Error(`the backend answered HTTP ${res.status}`);
  } catch (err) {
    console.error(`Could not reach ${url} (${err.message}). Nothing was checked.`);
    return process.exit(2);
  }

  const result = judge(live, latest);
  console.log(`${result.verdict}: ${result.text}`);
  if (live?.started_at) console.log(`The live backend last started at ${live.started_at}.`);
  return process.exit(result.exit);
}

if (require.main === module) main();

module.exports = { judge };
