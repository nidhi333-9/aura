const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const describeMongoTarget = (uri) => {
  const match =
    /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/.exec(
      String(uri || ""),
    );
  if (!match) return { kind: "unknown", db: "" };

  const hosts = match[1].split(",").map((host) => {
    const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(host);
    if (bracketed) return bracketed[1].toLowerCase();
    return host.replace(/:\d+$/, "").toLowerCase();
  });

  let db = "";
  try {
    db = decodeURIComponent(match[2] || "");
  } catch {
    db = match[2] || "";
  }

  return {
    kind: hosts.every((host) => LOCAL_HOSTS.has(host)) ? "local" : "remote",
    db: db || "(default)",
  };
};

module.exports = { describeMongoTarget };
