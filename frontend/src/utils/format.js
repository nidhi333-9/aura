// Display helpers for the history charts. Dates from the API are calendar dates
// ("2026-10-02") with no zone, so they are always formatted in UTC to avoid shifting a day.

export const DOW_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // index = ISO dow - 1
export const DOW_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const asUtcDate = (ymd) => new Date(`${ymd}T00:00:00Z`);

export const formatDay = (ymd, options) =>
  asUtcDate(ymd).toLocaleDateString(undefined, { timeZone: "UTC", ...options });

export const formatHour = (h) => {
  if (h === 0) return "12 am";
  if (h < 12) return `${h} am`;
  if (h === 12) return "12 pm";
  return `${h - 12} pm`;
};

export const formatHourRange = (h) => `${formatHour(h)}–${formatHour((h + 1) % 24)}`;

// 45 -> "45 min", 192 -> "3 h 12 min", 180 -> "3 h"
export const formatDuration = (minutes) => {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

// "just now", "5 min ago", "3 h ago", "2 days ago"
export const timeAgo = (iso) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};
