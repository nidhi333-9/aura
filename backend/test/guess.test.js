const test = require("node:test");
const assert = require("node:assert/strict");
const { guessFromApp, guessFromHost, guessFromTitle } = require("../services/guess");
const { classify } = require("../services/classify");

const check = (label, fn, cases) => {
  for (const [input, expected] of cases) {
    test(`${label}: ${JSON.stringify(input)} -> ${expected}`, () => {
      assert.equal(fn(input), expected);
    });
  }
};

check("app", guessFromApp, [
  // Names the keyword lists recognise.
  ["Adobe Photoshop 2024", "Productive"],
  ["PyCharm Community Edition", "Productive"],
  ["pycharm64.exe", "Productive"],
  ["JetBrains Toolbox", "Productive"],
  ["Docker Desktop", "Productive"],
  ["DBeaver", "Productive"],
  ["Windows PowerShell ISE", "Productive"],
  ["RobloxPlayerBeta.exe", "Distraction"],
  ["EpicGamesLauncher.exe", "Distraction"],
  ["Minecraft Launcher", "Distraction"],
  ["Genshin Impact", "Distraction"],
  ["Counter Strike 2 Games", "Distraction"],
  ["valorant-win64-shipping.exe", "Distraction"],

  // Nothing telling: stays Neutral, the safe default.
  ["Calculator", "Neutral"],
  ["Slack", "Neutral"],
  ["Discord", "Neutral"],
  ["Microsoft Teams", "Neutral"],
  ["Preview", "Neutral"],
  ["SystemSettings.exe", "Neutral"],
  ["ms-teams.exe", "Neutral"], //          runs together as "msteams", which contains "steam"
  ["Microsoft Teams", "Neutral"],
  ["Studio Display Manager", "Neutral"], // "studio" alone is weak
  ["OBS Studio", "Neutral"],
  ["steam.exe", "Distraction"], //         but Steam itself is still found as a whole word
  ["steamwebhelper.exe", "Distraction"],
  ["RStudio", "Productive"],
  ["ShellExperienceHost.exe", "Neutral"], // contains "shell" but not as a word
  ["QR Code Reader", "Neutral"], //          "code" alone is weak evidence
  ["", "Neutral"],
  [null, "Neutral"],
]);

check("host", (host) => guessFromHost(host), [
  // Documentation, learning, developer sites.
  ["docs.python.org", "Productive"],
  ["developer.apple.com", "Productive"],
  ["www.tutorialspoint.com", "Productive"],
  ["scholar.google.com", "Productive"],
  ["classroom.google.com", "Productive"],
  ["cs.stanford.edu", "Productive"],
  ["iitb.ac.in", "Productive"],
  ["unimelb.edu.au", "Productive"],
  ["localhost", "Productive"],
  ["app.localhost", "Productive"],
  ["127.0.0.1", "Productive"],

  // Games, films, gambling, adult.
  ["miniclip-games.com", "Distraction"],
  ["9anime.to", "Distraction"],
  ["moviesda.com", "Distraction"],
  ["freemovies.tv", "Distraction"],
  ["play.casino", "Distraction"],
  ["example.xxx", "Distraction"],
  ["poker.example.com", "Distraction"],

  // Not enough evidence, or evidence on both sides.
  ["example.com", "Neutral"],
  ["prabhupada.world", "Neutral"],
  ["192.168.0.10", "Neutral"],
  ["someone.vercel.app", "Neutral"],
  ["gemini.google.com", "Neutral"],
  ["alphabet.com", "Neutral"], //         "bet" is not a word here
  ["gamedev.net", "Neutral"], //          nothing whole-word, and game *development* is work
  ["python-and-games.com", "Neutral"], //   one strong word on each side: tie
  ["news.bbc.co.uk", "Neutral"],
  ["learn.example.com", "Neutral"], //    one weak word
  ["tv.example.com", "Neutral"],
  ["example.tv", "Neutral"], //           ".tv" is Tuvalu, not a clue
]);

check("title", guessFromTitle, [
  ["java online test & quiz", "Productive"],
  ["coding contests & challenges", "Productive"],
  ["dsa, system design & ai bootcamp", "Productive"],
  ["identify incorrect syntax - problems", "Productive"],
  ["react documentation", "Productive"],
  ["free movies online", "Distraction"],
  ["top 10 funny memes", "Distraction"],
  ["best games of 2025", "Distraction"],

  ["", "Neutral"],
  [undefined, "Neutral"],
  ["frontend", "Neutral"], //                              one weak word
  ["courses · some site", "Neutral"], //                    one weak word
  ["time to focus!", "Neutral"],
  ["megatron explained", "Neutral"],
  ["unity game development tutorial", "Neutral"], //        both sides: tie
  ["monty python's flying circus", "Productive"], //        known weakness of a word list, kept visible here on purpose
]);

test("host and title add up: two weak hints make a strong one", () => {
  assert.equal(guessFromHost("learn.example.com", "Python for beginners"), "Productive");
  assert.equal(guessFromHost("learn.example.com", "Welcome"), "Neutral");
  assert.equal(guessFromHost("example.com", "Full movie online"), "Distraction");
});

test("evidence on both sides cancels out; a stronger side wins", () => {
  assert.equal(guessFromHost("miniclip-games.com", "Python"), "Neutral"); //          2 against 2
  assert.equal(guessFromHost("miniclip-games.com", "Python tutorial"), "Productive"); // 2 against 4
});

// ---- through classify(): the guess only ever fills in what no rule knows -------------------
const CLASSIFY_CASES = [
  // [app, title, domain, expected site, expected category]
  ["Google Chrome", "x", "docs.python.org", "python.org", "Productive"],
  ["Google Chrome", "x", "9anime.to", "9anime.to", "Distraction"],
  ["Google Chrome", "Java Online Test & Quiz - Google Chrome – Techy", null, "Other website", "Productive"],
  ["Google Chrome", "Funny memes - Google Chrome", null, "Other website", "Distraction"],
  ["Xcode", "", null, "Xcode", "Productive"],
  ["Android Studio", "", null, "Android Studio", "Productive"],
  ["studio64.exe", "", null, "Android Studio", "Productive"],
  ["Microsoft Word", "", null, "Word", "Productive"],
  ["WINWORD.EXE", "", null, "Word", "Productive"],
  ["Steam", "", null, "Steam", "Distraction"],
  ["RobloxPlayerBeta.exe", "", null, "RobloxPlayerBeta", "Distraction"],
  ["Discord", "", null, "Discord", "Neutral"],
  ["ms-teams.exe", "", null, "Microsoft Teams", "Neutral"],
  ["Microsoft Teams", "", null, "Microsoft Teams", "Neutral"],
  ["Slack", "", null, "Slack", "Neutral"],
  ["zoom.us", "", null, "Zoom", "Neutral"],
  ["EXCEL.EXE", "", null, "Excel", "Productive"],
  ["Google Chrome", "Monkeytype | A minimalistic, customizable typing test - Google Chrome", "monkeytype.com", "Monkeytype", "Productive"],
  ["Google Chrome", "Monkeytype | A minimalistic, customizable typing test - Google Chrome", null, "Monkeytype", "Productive"],
  ["Google Chrome", "Chat | Microsoft Teams - Google Chrome", "teams.microsoft.com", "Microsoft Teams", "Neutral"],
  ["Google Chrome", "Chat | Microsoft Teams - Google Chrome", null, "Microsoft Teams", "Neutral"],
  ["Google Chrome", "Book1.xlsx - Excel - Google Chrome", null, "Microsoft 365", "Productive"],
  ["Google Chrome", "x", "excel.office.com", "Microsoft 365", "Productive"],
  ["Google Chrome", "How to excel at interviews", null, "Other website", "Neutral"], // the word, not the product
  ["Calculator", "", null, "Calculator", "Neutral"],

  // Known rules still win over any guess, whatever the words in the name say.
  ["Google Chrome", "Funny memes - YouTube", null, "YouTube", "Distraction"],
  ["Google Chrome", "Python tutorial - Instagram", null, "Instagram", "Distraction"],
  ["Google Chrome", "x", "stackoverflow.com", "Stack Overflow", "Productive"],
  ["Google Chrome", "best games - Google Search", "google.com", "Google Search", "Neutral"],
  ["Code", "Funny memes games", null, "VS Code", "Productive"],
  ["Spotify", "", null, "Spotify", "Neutral"],
  ["Desktop", "", null, "Idle", "Idle"],
];

for (const [app, title, domain, site, category] of CLASSIFY_CASES) {
  test(`classify ${app} | ${title} | ${domain}`, () => {
    assert.deepEqual(classify(app, title, domain), { site, category });
  });
}

test("a guess never produces anything outside the four categories", () => {
  for (const app of ["x", "Roblox", "pycharm", "", null]) {
    assert.ok(["Productive", "Neutral", "Distraction"].includes(guessFromApp(app)));
  }
});
