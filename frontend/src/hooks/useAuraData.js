import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const useAuraData = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({
    userData: null,
    analytics: null,
    focusHistory: [],
    video: null,
    category: null,
    loading: true,
  });

  const token = localStorage.getItem("token");

  // 1. Initial Load: User Info + Full Day Trend
  useEffect(() => {
    if (!token) return navigate("/", { replace: true });

    const initLoad = async () => {
      try {
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const [userRes, trendRes] = await Promise.all([
          axios.get("http://localhost:8080/dashboard", auth),
          axios.get("http://localhost:8080/api/analytics/daily-trend", auth),
        ]);

        // 👇 Clean initial load — just set what the backend returns
        setData((prev) => ({
          ...prev,
          userData: userRes.data,
          focusHistory: trendRes.data, // use real data from DB
          loading: false,
        }));
      } catch (err) {
        if (err.response?.status === 401) navigate("/");
        setData((prev) => ({ ...prev, loading: false }));
      }
    };
    initLoad();
  }, [token, navigate]);

  // 2. Live Polling: Fetch Current Analytics every 5s
  useEffect(() => {
    if (!token || data.loading) return;

    const fetchLiveStats = async () => {
      try {
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(
          "http://localhost:8080/api/analytics",
          auth,
        );

        // 👇 Append new time points here (the fix goes HERE, not in initLoad)
        setData((prev) => {
          const now = new Date();
          const timeLabel = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

          const newPoint = { time: timeLabel, score: res.data.focus_score };
          const alreadyExists = prev.focusHistory.some(
            (p) => p.time === timeLabel,
          );

          return {
            ...prev,
            analytics: res.data,
            focusHistory: alreadyExists
              ? prev.focusHistory.map((p) =>
                  p.time === timeLabel
                    ? { ...p, score: res.data.focus_score }
                    : p,
                )
              : [...prev.focusHistory, newPoint],
          };
        });
      } catch (err) {
        console.error("Live fetch error", err);
      }
    };

    const interval = setInterval(fetchLiveStats, 5000);
    return () => clearInterval(interval);
  }, [token, data.loading]);

  // 3. YouTube Recommendations (Triggered by score change)
  useEffect(() => {
    if (!data.analytics) return;

    const score = data.analytics.focus_score;
    const newCat = score > 70 ? "focus" : score > 40 ? "relax" : "boost";

    if (newCat !== data.category) {
      axios
        .get(`http://localhost:8080/api/youtube-recommendation?type=${newCat}`)
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setData((prev) => ({
              ...prev,
              category: newCat,
              video: res.data[Math.floor(Math.random() * res.data.length)],
            }));
          }
        });
    }
  }, [data.analytics?.focus_score]);

  return data;
};

export default useAuraData;
