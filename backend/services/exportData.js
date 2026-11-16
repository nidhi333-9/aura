const FORMAT_VERSION = 1;
const FLUSH_AT_CHARS = 64 * 1024;
const DB_BATCH = 1000;

const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const profileOf = (user) => ({
  name: user.name ?? null,
  email: user.email ?? null,
  picture: user.picture ?? null,
  google_id: user.googleId ?? null,
  created_at: iso(user.createdAt),
});

const deviceOf = (device) => ({
  name: device.name ?? null,
  os: device.os ?? null,
  paired_at: iso(device.createdAt),
  last_seen: iso(device.lastSeen),
  removed_at: iso(device.revokedAt),
});

const dayOf = (stat) => ({ day: stat.day, slots: stat.slots ?? {} });

const sampleOf = (activity) => ({
  timestamp: iso(activity.timestamp),
  app_name: activity.app_name ?? null,
  window_title: activity.window_title ?? null,
  domain: activity.domain ?? null,
  site: activity.site ?? null,
  category: activity.category ?? null,
});

const ABOUT = {
  format: FORMAT_VERSION,
  made_by: "Aura",
  what_this_is: "Everything Aura holds about you.",
  notes: [
    "samples: one row about every 10 seconds while the sensor ran. They include window titles, so keep this file private. Samples are deleted automatically after a while (see the privacy page).",
    "daily_summaries: counts per day in 15-minute slots (slot 0 is 00:00 to 00:15 UTC; p = Productive, n = Neutral, d = Distraction). They hold no titles and are kept until you delete them.",
    "devices: your paired sensors. Their secret keys are not stored by Aura and are not in this file.",
  ],
};

async function* rowsAsJson(rows, toRow, tally) {
  let first = true;
  let pending = "";
  try {
    for await (const doc of rows) {
      pending += (first ? "" : ",") + JSON.stringify(toRow(doc));
      first = false;
      tally.n += 1;
      if (pending.length >= FLUSH_AT_CHARS) {
        yield pending;
        pending = "";
      }
    }
  } finally {
    await Promise.resolve(rows.close?.()).catch(() => {});
  }
  if (pending) yield pending;
}

async function* exportPieces({
  profile,
  devices,
  days,
  samples,
  now = new Date(),
}) {
  const dayTally = { n: 0 };
  const sampleTally = { n: 0 };
  let carry =
    `{"about":${JSON.stringify({ ...ABOUT, generated_at: now.toISOString() })}` +
    `,"account":${JSON.stringify(profileOf(profile))}` +
    `,"devices":${JSON.stringify(devices.map(deviceOf))}` +
    `,"daily_summaries":[`;
  try {
    for await (const piece of rowsAsJson(days, dayOf, dayTally)) {
      yield carry + piece;
      carry = "";
    }
    carry += `],"samples":[`;
    for await (const piece of rowsAsJson(samples, sampleOf, sampleTally)) {
      yield carry + piece;
      carry = "";
    }
    carry += `],"counts":{"daily_summaries":${dayTally.n},"samples":${sampleTally.n}}}\n`;
    yield carry;
  } finally {
    await Promise.all(
      [days, samples].map((c) => Promise.resolve(c.close?.()).catch(() => {})),
    );
  }
}

module.exports = {
  exportPieces,
  profileOf,
  deviceOf,
  dayOf,
  sampleOf,
  FORMAT_VERSION,
  DB_BATCH,
};
