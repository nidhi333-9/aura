import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
const API_URL = import.meta.env.VITE_API_URL;

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

  // 1. Initial load
  useEffect(() => {
    if (!token) return navigate("/", { replace: true });

    const initLoad = async () => {
      try {
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const [userRes, trendRes] = await Promise.all([
          axios.get(`${API_URL}/dashboard`, auth),
          axios.get(`${API_URL}/api/analytics/daily-trend`, auth),
        ]);

        setData((prev) => ({
          ...prev,
          userData: userRes.data,
          focusHistory: trendRes.data,
          loading: false,
        }));
      } catch (err) {
        if (err.response?.status === 401) navigate("/");
        setData((prev) => ({ ...prev, loading: false }));
      }
    };
    initLoad();
  }, [token, navigate]);

  // 2. Live stat cards — every 5s
  useEffect(() => {
    if (!token || data.loading) return;

    const fetchLiveStats = async () => {
      try {
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(`${API_URL}/api/analytics`, auth);
        setData((prev) => ({ ...prev, analytics: res.data }));
      } catch (err) {
        console.error("Live fetch error", err);
      }
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 5000);
    return () => clearInterval(interval);
  }, [token, data.loading]);

  // 3. Refresh the chart — every 30s, replaces the series wholesale so it's always one consistent timeline
  useEffect(() => {
    if (!token || data.loading) return;

    const fetchTrend = async () => {
      try {
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const res = await axios.get(
          `${API_URL}/api/analytics/daily-trend`,
          auth,
        );
        setData((prev) => ({ ...prev, focusHistory: res.data }));
      } catch (err) {
        console.error("Trend fetch error", err);
      }
    };

    const interval = setInterval(fetchTrend, 30000);
    return () => clearInterval(interval);
  }, [token, data.loading]);

  // 4. YouTube recommendations
  useEffect(() => {
    if (!data.analytics) return;
    const score = data.analytics.focus_score;
    const newCat = score > 70 ? "focus" : score > 40 ? "relax" : "boost";
    if (newCat !== data.category) {
      axios
        .get(`${API_URL}/api/youtube-recommendation?type=${newCat}`)
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
