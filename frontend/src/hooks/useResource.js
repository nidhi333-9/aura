import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

const SLOW_LOAD_MS = 6_000; // after this, tell the user the server is probably waking up

// Fetches `path` now and then every `intervalMs`, independently of every other card.
//  - pauses while the tab is hidden and refreshes the moment it becomes visible again
//  - never starts a request while the previous one is still running (no pile-up when the
//    server is slow)
//  - on failure keeps the last good data and exposes `error`
//  - a 401 means the session is gone: drop the token and go back to the landing page
//  - when `path` changes, the previous data stays available (`refreshing` is true) so a
//    chart can dim instead of flashing a skeleton while the new slice loads
//  - `retry()` forces an immediate reload
//  - `enabled: false` stops all fetching (e.g. a card that isn't on screen); the last data stays
//  - `errorIntervalMs`: poll at this (usually shorter) interval while the last attempt failed, so
//    a card recovers on its own soon after the cause is fixed instead of waiting a full interval
const useResource = (path, intervalMs, { enabled = true, errorIntervalMs = null } = {}) => {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({
    data: null,
    settledPath: null, // the path the current data/error belongs to
    error: null,
    errorStatus: null, // HTTP status of that error, when the server answered at all
    slow: false,
  });

  const failing = state.settledPath === path && state.error !== null;
  const pollMs = failing && errorIntervalMs ? errorIntervalMs : intervalMs;

  useEffect(() => {
    if (!enabled) return undefined;
    if (!localStorage.getItem("token")) {
      navigate("/", { replace: true });
      return undefined;
    }

    let cancelled = false;
    let inFlight = false;

    const load = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      // Only a request that is actually slow (not one that hasn't started because the
      // tab is in the background) should say "the server is waking up".
      const slowTimer = setTimeout(() => {
        if (!cancelled) {
          setState((prev) => (prev.settledPath !== path ? { ...prev, slow: true } : prev));
        }
      }, SLOW_LOAD_MS);
      try {
        const res = await api.get(path);
        if (!cancelled) {
          setState({ data: res.data, settledPath: path, error: null, errorStatus: null, slow: false });
        }
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/", { replace: true });
          return;
        }
        setState((prev) => ({
          ...prev,
          settledPath: path,
          slow: false,
          error: err.response?.data?.error || err.message || "Request failed",
          errorStatus: err.response?.status ?? null,
        }));
      } finally {
        clearTimeout(slowTimer);
        inFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) load();
    };

    load();
    const timer = setInterval(load, pollMs);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [path, pollMs, navigate, reloadKey, enabled]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const settled = state.settledPath === path;
  return {
    data: state.data,
    loading: !settled,
    refreshing: !settled && state.data !== null,
    error: settled ? state.error : null,
    errorStatus: settled ? state.errorStatus : null,
    slow: !settled && state.slow,
    retry,
  };
};

export default useResource;
