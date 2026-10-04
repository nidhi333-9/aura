// Describes WHERE a MongoDB connection string points without ever returning (or logging) its
// credentials, so the server can tell a developer "you are about to use a remote database".

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

// mongodb://user:pw@h1:27017,h2:27017/dbname?opts  ->  { kind: "remote", db: "dbname" }
const describeMongoTarget = (uri) => {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/.exec(String(uri || ""));
  if (!match) return { kind: "unknown", db: "" };

  const hosts = match[1].split(",").map((host) => {
    // An IPv6 literal is bracketed, and its own colons must not be mistaken for a port:
    // "[::1]:27017" -> "::1" (stripping ":\d+" from "::1" would leave ":").
    const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(host);
    if (bracketed) return bracketed[1].toLowerCase();
    return host.replace(/:\d+$/, "").toLowerCase(); // host:27017 -> host
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
