// "Today" and every day/hour bucket is the user's own, so the API is told which IANA
// time zone that is (e.g. "Asia/Kolkata"). Falls back to UTC if the browser won't say.
export const browserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
