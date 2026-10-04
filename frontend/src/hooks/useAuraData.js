import { useEffect, useState } from "react";
import { api } from "../api/client";
import { browserTimeZone } from "../utils/timezone";
import useResource from "./useResource";

const LIVE_INTERVAL_MS = 10_000;
const TREND_INTERVAL_MS = 60_000;

// The server computes the state once; this only maps it to a YouTube query type.
// No state (nothing tracked in the live window) behaves like a score of 0.
const VIDEO_TYPE_BY_STATE = {
  deep_focus: "focus",
  calm_flow: "relax",
  low_energy: "boost",
};

// `trendEnabled`: today's hourly chart is only on screen in the Today view, so the Week and
// Month tabs don't need to keep re-querying it.
const useAuraData = ({ trendEnabled = true } = {}) => {
  // "Today" is the user's day, not UTC, so tell the server which time zone that is.
  const live = useResource("/api/live", LIVE_INTERVAL_MS);
  const trend = useResource(
    `/api/analytics/daily-trend?tz=${encodeURIComponent(browserTimeZone())}`,
    TREND_INTERVAL_MS,
    { enabled: trendEnabled },
  );

  const [video, setVideo] = useState(null);
  const category = live.data
    ? (VIDEO_TYPE_BY_STATE[live.data.state?.key] ?? "boost")
    : null;

  useEffect(() => {
    if (!category) return undefined;
    let cancelled = false;
    api
      .get("/api/youtube-recommendation", { params: { type: category } })
      .then((res) => {
        if (cancelled || !res.data?.length) return;
        setVideo(res.data[Math.floor(Math.random() * res.data.length)]);
      })
      .catch(() => {}); // the recommendation is decoration; never break the page for it
    return () => {
      cancelled = true;
    };
  }, [category]);

  return { live, trend, video, category };
};

export default useAuraData;
