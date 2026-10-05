// Is the live backend running the newest code on GitHub?
//
//   node scripts/check-deploy.js                      checks https://aura-backend-hmq3.onrender.com against the main branch
//   node scripts/check-deploy.js --url https://...    another backend address
//   node scripts/check-deploy.js --repo owner/name    another GitHub repository
//   node scripts/check-deploy.js --commit abc1234     compare with this commit instead of asking GitHub
//   node scripts/check-deploy.js --wait 600           keep checking (every --every seconds, default 10) until the
//                                                     live backend runs the commit, for at most 600 seconds
//
// It asks the backend which commit it runs (GET /api/version) and GitHub which commit main is at, and
// compares them. Exit code: 0 up to date, 1 behind or unknown, 2 could not check.
// It only reads public pages and changes nothing. The CI workflow uses --commit and --wait right after
// it asks Render to deploy, so a deploy that never goes live turns the run red.

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
    return {
      verdict: "UP TO DATE",
      exit: 0,
      text: `The live backend runs ${live.commit}, ${latest.asked ? "the commit it was asked to run" : "the newest commit on GitHub"}.`,
    };
  }
  return {
    verdict: "BEHIND",
    exit: 1,
    text:
      `The live backend runs ${live.commit} but ${latest.asked ? "the expected commit is" : "GitHub has"} ${newest}` +
      `${latest.message ? ` ("${latest.message}")` : ""}. ` +
      "A deploy may still be running: wait 3 to 5 minutes and run this again. " +
      "If it stays behind, look at Events and Settings (Auto-Deploy) of the service in Render.",
  };
};

const optionValue = (argv, name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1] || fallback;
};

const parseArgs = (argv) => {
  const number = (name, fallback, min) => {
    const raw = optionValue(argv, name, null);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min) throw new Error(`${name} needs a number of at least ${min}`);
    return value;
  };
  const commit = optionValue(argv, "--commit", null);
  if (commit !== null && !/^[0-9a-f]{7,40}$/i.test(commit)) throw new Error("--commit needs a commit id (7 to 40 letters and digits)");
  return {
    url: optionValue(argv, "--url", DEFAULT_URL).replace(/\/+$/, ""),
    repo: optionValue(argv, "--repo", DEFAULT_REPO),
    commit,
    waitSeconds: number("--wait", 0, 0),
    everySeconds: number("--every", 10, 0.2),
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What the backend says it runs: an object, null if it has no such page, or throws if unreachable.
const fetchLive = async (url, timeoutMs) => {
  const res = await fetch(`${url}/api/version`, { signal: AbortSignal.timeout(timeoutMs) });
  if (res.ok) return res.json();
  if (res.status === 404 || res.status === 401) return null;
  throw new Error(`the backend answered HTTP ${res.status}`);
};

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(err.message);
    return process.exit(2);
  }

  let latest;
  if (args.commit) {
    latest = { sha: args.commit, message: "", asked: true };
  } else {
    try {
      const res = await fetch(`https://api.github.com/repos/${args.repo}/commits/main`, {
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
  }

  const waiting = args.waitSeconds > 0;
  const deadline = Date.now() + args.waitSeconds * 1000;
  // While waiting, a server that is restarting is normal, so one failed request is not the end.
  const attemptTimeout = waiting ? 30000 : WAKE_UP_ALLOWANCE_MS;
  let live = null;
  let result;
  for (;;) {
    let failure = null;
    try {
      live = await fetchLive(args.url, attemptTimeout);
    } catch (err) {
      failure = err;
    }
    if (failure && !waiting) {
      console.error(`Could not reach ${args.url} (${failure.message}). Nothing was checked.`);
      return process.exit(2);
    }
    result = failure ? { verdict: "UNREACHABLE", exit: 1, text: `Could not reach ${args.url} (${failure.message}).` } : judge(live, latest);
    if (result.exit === 0 || !waiting || Date.now() >= deadline) break;
    const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    console.log(`[waiting, ${left}s left] ${result.verdict}: live runs ${live?.commit ?? "an unknown version"}, expecting ${latest.sha.slice(0, 7)}`);
    await sleep(args.everySeconds * 1000);
  }

  console.log(`${result.verdict}: ${result.text}`);
  if (live?.started_at) console.log(`The live backend last started at ${live.started_at}.`);
  return process.exit(result.exit);
}

if (require.main === module) main();

module.exports = { judge, parseArgs };
