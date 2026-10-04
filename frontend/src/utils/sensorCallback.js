// LEGACY: sensors from before device pairing sign in by opening the site with
// ?callback=http://localhost:<port>. Current sensors pair with a one-time code instead (see
// SensorSetup.jsx) and never use this. Keep it until those old installs are gone, then delete
// this file and the `callback` handling in App.jsx and hooks/useAuth.js.
//
// The old sensor opens the site with ?callback=http://localhost:<port> and expects
// the login token back on that URL. Only ever send the token to a loopback
// address: honouring an arbitrary callback would let a crafted link hand a
// logged-in user's token to any website.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Returns the URL to redirect to (callback + ?token=...), or null if the
// callback is missing or isn't a plain http loopback address.
export const buildSensorCallbackUrl = (rawCallback, token) => {
  if (!rawCallback || !token) return null;

  let url;
  try {
    url = new URL(rawCallback);
  } catch {
    return null;
  }

  if (url.protocol !== "http:") return null;
  if (!LOOPBACK_HOSTS.has(url.hostname)) return null;
  if (url.username || url.password) return null;

  url.searchParams.set("token", token);
  return url.toString();
};
