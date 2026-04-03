import { useState, useEffect, useCallback } from "react";
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

        setData((prev) => ({
          ...prev,
          userData: userRes.data,
          focusHistory: trendRes.data,
          loading: false,
        }));
      } catch (err) {
        if (err.response?.status === 401) navigate("/");
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

        setData((prev) => ({
          ...prev,
          analytics: res.data,
          // We don't push to focusHistory here anymore because
          // the "Daily Trend" is handled by the backend aggregation.
          // However, if you want the graph to move in real-time:
          focusHistory: prev.focusHistory.map((point, index) =>
            // Update the very last point with the latest score
            index === prev.focusHistory.length - 1
              ? { ...point, score: res.data.focus_score }
              : point,
          ),
        }));
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
  }, [data.analytics?.focus_score]); // Only run when score changes

  return data;
};

export default useAuraData;
