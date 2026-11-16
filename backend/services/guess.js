const STRONG = 2;
const WEAK = 1;
const NEEDED = STRONG;

const spaced = (text) =>
  ` ${String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
const glued = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const terms = (weight, commaSeparated) =>
  commaSeparated.split(",").map((term) => [spaced(term), weight]);

const stems = (weight, commaSeparated) =>
  commaSeparated.split(",").map((term) => [glued(term), weight]);

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

const HOST_STEMS = {
  Productive: [
    ...stems(STRONG, "coding, tutorial, developer, programming"),
    ...stems(WEAK, "academy, university"),
  ],
  Distraction: [
    ...stems(
      STRONG,
      "anime, movie, porn, casino, hentai, gaming, esports, betting",
    ),
  ],
};

const DISTRACTION_TLDS = new Set([
  "xxx",
  "porn",
  "sex",
  "adult",
  "casino",
  "bet",
  "poker",
  "game",
  "games",
  "bingo",
]);
const EDUCATION_SECOND_LEVELS = new Set(["edu", "ac"]);
const OTHER_SECOND_LEVELS = new Set(["co", "com", "org", "net", "gov"]);

const APP_WORDS = {
  Productive: [
    ...terms(
      STRONG,
      "ide, terminal, shell, powershell, bash, zsh, git, docker, sql, database, compiler, " +
        "debugger, jupyter, matlab, vim, emacs, eclipse, netbeans, sublime, excel, powerpoint, " +
        "libreoffice, openoffice, acrobat, latex, zotero, mendeley, anki, obsidian, figma, photoshop, " +
        "illustrator, premiere, indesign, lightroom, autocad, solidworks, postman, insomnia, dbeaver",
    ),

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

      "epicgames, roblox, minecraft, fortnite, valorant, genshin, leagueoflegends, steamwebhelper, " +
        "playstation, battlenet, ubisoft, netflix",
    ),
  ],
};

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
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^127(\.\d+){3}$/.test(host)
  ) {
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
    nameLabels = labels.slice(0, -2);
  }
  if (DISTRACTION_TLDS.has(tld)) evidence.Distraction += STRONG;

  return addScores(
    evidence,
    spaced(nameLabels.join(" ")),
    WORDS,
    HOST_STEMS,
    glued(nameLabels.join("")),
  );
};

const guessFromApp = (appName) => {
  const name = String(appName ?? "").replace(/\.exe$/i, "");
  return decide(
    addScores(noEvidence(), spaced(name), APP_WORDS, APP_STEMS, glued(name)),
  );
};

const guessFromHost = (host, title = "") => {
  const evidence = hostEvidence(host);
  return decide(titleEvidence(title, evidence));
};

const guessFromTitle = (title) => decide(titleEvidence(title));

module.exports = { guessFromApp, guessFromHost, guessFromTitle };
