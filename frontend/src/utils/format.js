export const DOW_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // index = ISO dow - 1
export const DOW_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const asUtcDate = (ymd) => new Date(`${ymd}T00:00:00Z`);

export const formatDay = (ymd, options) =>
  asUtcDate(ymd).toLocaleDateString(undefined, { timeZone: "UTC", ...options });

export const formatHour = (h) => {
  if (h === 0) return "12 am";
  if (h < 12) return `${h} am`;
  if (h === 12) return "12 pm";
  return `${h - 12} pm`;
};

export const formatHourRange = (h) =>
  `${formatHour(h)}–${formatHour((h + 1) % 24)}`;

export const formatDuration = (minutes) => {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const timeAgo = (iso) => {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};
