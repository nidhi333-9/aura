// Best-effort category for an app, website or page that no rule in classify.js knows.
//
// No AI and no network: it looks for telling words in the app name, the website's host name and the
// page title ("docs", "python", "game", "movie"...) and adds up the evidence.
//
// The rule is cautious on purpose. A wrong "Neutral" costs a little accuracy; a wrong "Productive"
// or "Distraction" moves the focus score. So a category needs a STRONG word, or two WEAK ones, and
// must beat the other side. Mixed or thin evidence ("game development tutorial") stays Neutral.
//
// Only classify.js calls this, and only after every known rule has failed.

const STRONG = 2; // enough on its own
const WEAK = 1; //   needs company
const NEEDED = STRONG;

// Lower-case, everything that is not a letter or digit becomes one space, padded so that
// `includes(" docs ")` is a whole-word test: "docs.python.org" -> " docs python org ".
const spaced = (text) => ` ${String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
const glued = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// "a, b, c d" -> [[" a ", weight], [" b ", weight], [" c d ", weight]]
const terms = (weight, commaSeparated) =>
  commaSeparated.split(",").map((term) => [spaced(term), weight]);
// Same, but matched inside a glued-together name ("epicgameslauncher"): only for long, distinctive stems.
const stems = (weight, commaSeparated) =>
  commaSeparated.split(",").map((term) => [glued(term), weight]);

// ---- words that mean something anywhere: host names and page titles --------------------------
const WORDS = {
  Productive: [
    ...terms(
      STRONG,
      "python, java, javascript, typescript, golang, kotlin, php, sql, mysql, postgres, postgresql, " +
        "mongodb, nosql, redis, graphql, html, css, react, angular, nodejs, node js, express js, " +
        "django, flask, fastapi, spring boot, docker, kubernetes, devops, github, gitlab, bitbucket, " +
        "npm, pypi, api, apis, sdk, coding, programming, programmer, developer, developers, " +
        "software engineering, algorithm, algorithms, data structures, dsa, system design, " +
        "machine learning, deep learning, neural network, tensorflow, pytorch, compiler, syntax, " +
        "debugging, command line, localhost, bootcamp, tutorial, tutorials, lecture, lectures, " +
        "syllabus, curriculum, documentation, docs, textbook, homework, thesis, dissertation, " +
        "research paper, scholar, latex, pomodoro, classroom",
    ),
    ...terms(
      WEAK,
      "course, courses, learn, learning, lesson, lessons, study, exam, exams, quiz, mcq, " +
        "assignment, assignments, academy, university, college, institute, research, training, " +
        "workshop, frontend, backend, server, terminal, console, focus",
    ),
  ],
  Distraction: [
    ...terms(
      STRONG,
      "game, games, gaming, gamer, gamers, esports, arcade, casino, poker, betting, lottery, " +
        "jackpot, porn, xxx, nsfw, hentai, movie, movies, anime, manga, webtoon, meme, memes, " +
        "funny, gossip, celebrity, celebrities, horoscope, dating, livescore, live score, sitcom",
    ),
    ...terms(
      WEAK,
      "watch, episode, episodes, trailer, stream, streaming, play online, wallpaper, wallpapers, " +
        "sports, cricket, fantasy",
    ),
  ],
};

// A host or app name often runs words together ("9anime", "moviesda"). These long stems are safe to
// find inside it; short ones ("bet", "game") are not ("alphabet", "gamedev") and stay whole-word only.
const HOST_STEMS = {
  Productive: [...stems(STRONG, "coding, tutorial, developer, programming"), ...stems(WEAK, "academy, university")],
  Distraction: [...stems(STRONG, "anime, movie, porn, casino, hentai, gaming, esports, betting")],
};

// Top-level domains that say what the site is for.
const DISTRACTION_TLDS = new Set(["xxx", "porn", "sex", "adult", "casino", "bet", "poker", "game", "games", "bingo"]);
const EDUCATION_SECOND_LEVELS = new Set(["edu", "ac"]); // cs.stanford.edu, iitb.ac.in, unimelb.edu.au
const OTHER_SECOND_LEVELS = new Set(["co", "com", "org", "net", "gov"]);

// ---- words that mean something only in an app's name ------------------------------------------
const APP_WORDS = {
  Productive: [
    ...terms(
      STRONG,
      "ide, terminal, shell, powershell, bash, zsh, git, docker, sql, database, compiler, " +
        "debugger, jupyter, matlab, vim, emacs, eclipse, netbeans, sublime, excel, powerpoint, " +
        "libreoffice, openoffice, acrobat, latex, zotero, mendeley, anki, obsidian, figma, photoshop, " +
        "illustrator, premiere, indesign, lightroom, autocad, solidworks, postman, insomnia, dbeaver",
    ),
    // "studio" alone says little: Android Studio is work, "Studio Display Manager" and OBS Studio are not.
    ...terms(WEAK, "code, editor, notebook, pdf, studio"),
  ],
  Distraction: [
    ...terms(
      STRONG,
      "game, games, gaming, steam, epic games, minecraft, fortnite, valorant, roblox, dota, csgo, " +
        "league of legends, genshin, pubg, overwatch, playstation, xbox, ubisoft, battle net, " +
        "netflix, hulu, disney, twitch, tiktok, instagram, snapchat, facebook, reddit, tinder, bumble",
    ),
  ],
};
// Windows process names are lower-case and run together: "epicgameslauncher", "pycharm64".
const APP_STEMS = {
  Productive: [
    ...stems(
      STRONG,
      "photoshop, illustrator, premiere, indesign, lightroom, autocad, solidworks, postman, dbeaver, " +
        "libreoffice, openoffice, jetbrains, pycharm, webstorm, intellij, clion, goland, phpstorm, " +
        "datagrip, rubymine, devenv, vscode, androidstudio, rstudio, texstudio, texshop, texmaker, windsurf",
    ),
  ],
  Distraction: [
    ...stems(
      STRONG,
      // "steam" is deliberately NOT here: run together it hides inside "msteams". It is matched as a
      // whole word instead (APP_WORDS), and Steam's own process names are listed in full.
      "epicgames, roblox, minecraft, fortnite, valorant, genshin, leagueoflegends, steamwebhelper, " +
        "playstation, battlenet, ubisoft, netflix",
    ),
  ],
};

// ---- scoring ----------------------------------------------------------------------------------
const noEvidence = () => ({ Productive: 0, Distraction: 0 });

const addScores = (evidence, text, wordTables, stemTables, gluedText) => {
  for (const category of Object.keys(evidence)) {
    for (const [needle, weight] of wordTables[category] ?? []) {
      if (text.includes(needle)) evidence[category] += weight;
    }
    for (const [stem, weight] of stemTables?.[category] ?? []) {
      if (gluedText.includes(stem)) evidence[category] += weight;
    }
  }
  return evidence;
};

const decide = ({ Productive, Distraction }) => {
  if (Productive >= NEEDED && Productive > Distraction) return "Productive";
  if (Distraction >= NEEDED && Distraction > Productive) return "Distraction";
  return "Neutral";
};

const titleEvidence = (title, evidence = noEvidence()) =>
  addScores(evidence, spaced(title), WORDS, null, "");

const hostEvidence = (host) => {
  const evidence = noEvidence();
  // A page served from this very computer is somebody's project.
  if (host === "localhost" || host.endsWith(".localhost") || /^127(\.\d+){3}$/.test(host)) {
    evidence.Productive += STRONG;
    return evidence;
  }

  const labels = host.split(".");
  const tld = labels.at(-1);
  const second = labels.at(-2);
  let nameLabels = labels.slice(0, -1);
  if (tld === "edu") {
    evidence.Productive += STRONG;
  } else if (tld.length === 2 && EDUCATION_SECOND_LEVELS.has(second)) {
    evidence.Productive += STRONG;
    nameLabels = labels.slice(0, -2);
  } else if (tld.length === 2 && OTHER_SECOND_LEVELS.has(second)) {
    nameLabels = labels.slice(0, -2); // "example.co.in" -> "example"
  }
  if (DISTRACTION_TLDS.has(tld)) evidence.Distraction += STRONG;

  // The part before the top-level domain is the site's name: "docs.python" in "docs.python.org".
  return addScores(evidence, spaced(nameLabels.join(" ")), WORDS, HOST_STEMS, glued(nameLabels.join("")));
};

// ---- what classify.js calls -------------------------------------------------------------------
// Each returns "Productive", "Distraction" or "Neutral".

// A desktop app nothing else recognised ("Xcode", "RobloxPlayerBeta.exe").
const guessFromApp = (appName) => {
  const name = String(appName ?? "").replace(/\.exe$/i, "");
  return decide(addScores(noEvidence(), spaced(name), APP_WORDS, APP_STEMS, glued(name)));
};

// A website whose host name no rule knows. The page title can add to what the host says.
const guessFromHost = (host, title = "") => {
  const evidence = hostEvidence(host);
  return decide(titleEvidence(title, evidence));
};

// A browser tab with no host name and no site found in its title.
const guessFromTitle = (title) => decide(titleEvidence(title));

module.exports = { guessFromApp, guessFromHost, guessFromTitle };
