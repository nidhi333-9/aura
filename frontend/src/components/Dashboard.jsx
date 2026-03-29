import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SpotifyPlayer from "./SpotifyPlayer";
const Dashboard = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }
    const fetchAllData = async () => {
      try {
        const [userRes, analyticsRes] = await Promise.all([
          axios.get("http://localhost:8080/dashboard", {
            headers: { Authorization: token },
          }),
          axios.get("http://localhost:8080/analytics", {
            headers: { Authorization: token },
          }),
        ]);
        setUserData(userRes.data);
        setAnalytics(analyticsRes.data);
      } catch (err) {
        console.error("Dashboard Error:", err);
        // Logic: If the token is expired (401) or invalid, clean up and kick to landing
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/", { replace: true });
        }
      } finally {
        setLoading(false); // Stop the loading screen whether success or failure
      }
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  // Logic: Show a clean loading state while the "Handshake" with the backend happens
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--aura-light)]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--aura-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--aura-dark)] font-medium">
            Syncing your Aura...
          </p>
        </div>
      </div>
    );
  }

  // Logic: Prevent rendering the UI if data failed to load
  if (!analytics) return null;

  return (
    <div className="min-h-screen bg-[var(--aura-light)] bg-grid-mesh p-8">
      {/* 1. Header Section */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-[var(--aura-dark)]">
            Welcome back, {userData?.name || "User"} 👋
          </h1>
          <p className="text-gray-500">
            Here's your behavioral "Aura" for today.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-sm flex items-center gap-3 border border-white/50">
            <div className="w-10 h-10 rounded-full bg-[var(--aura-blue)] opacity-20 animate-pulse"></div>
            <span className="font-semibold text-sm">
              Status:{" "}
              {analytics.focus_score > 70 ? "Deep Focus" : "Casual Browsing"}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all border border-red-100 shadow-sm"
          >
            Logout 🚪
          </button>
        </div>
      </div>

      {/* 2. Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard
          title="Focus Score"
          value={`${analytics.focus_score}%`}
          icon="🧠"
          color="var(--aura-blue)"
        />
        <StatCard
          title="Current App"
          value={analytics.current_app}
          icon="🖥️"
          color="var(--aura-dark)"
        />
        <StatCard
          title="Most Used"
          value={analytics.most_used}
          icon="📊"
          color="var(--aura-green)"
        />
      </div>

      {/* 3. Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-xl h-[400px]">
          <h3 className="text-lg font-bold mb-6">Focus Trends</h3>
          <div className="w-full h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
            Chart Visualization Area
          </div>
        </div>

        <div className="bg-[#1a1a1a] p-8 rounded-[32px] text-white shadow-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2">Mood Analysis</h3>
            <p className="text-gray-400 text-sm">
              Based on {analytics.current_app} patterns.
            </p>
          </div>
          <div className="text-center py-10">
            <span className="text-7xl mb-4 block">🧘</span>
            <h4 className="text-2xl font-bold italic">Calm & Productive</h4>
          </div>
          <button className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-2xl transition text-sm font-medium">
            View Suggestions
          </button>
        </div>
        <SpotifyPlayer spotifyUri="spotify:playlist:37i9dQZF1DX8NTLIssmsS6" />
      </div>
      {/* 4. Recommendation Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[var(--aura-dark)]">
            Curated for your Focus
          </h3>
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            Based on your {analytics.current_app} usage
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* This data would ideally come from your backend/API */}
          {[
            {
              id: "jfKfPfyJRdk",
              title: "Lofi Hip Hop - Beats to Relax/Study to",
              duration: "LIVE",
              context: "Acoustic Environment",
            },
            {
              id: "5qap5aO4i9A",
              title: "How to Minimize Distractions",
              duration: "10:24",
              context: "Behavioral Tip",
            },
            // ... more items
          ].map((video) => (
            <RecommendationCard key={video.id} video={video} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Simple reusable component for stats
const StatCard = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl shadow-md border border-white/50 flex items-center gap-5">
    <div className="text-3xl p-3 bg-gray-50 rounded-2xl">{icon}</div>
    <div>
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
        {title}
      </p>
      <h2 className="text-2xl font-bold" style={{ color }}>
        {value}
      </h2>
    </div>
  </div>
);

// Add this helper component at the bottom with your StatCard
const RecommendationCard = ({ video }) => (
  <div className="group bg-white/50 hover:bg-white p-4 rounded-3xl border border-white/20 transition-all duration-300 shadow-sm hover:shadow-md">
    <div className="relative mb-4 overflow-hidden rounded-2xl">
      {/* High-quality YouTube Thumbnail */}
      <img
        src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
        alt={video.title}
        className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-lg font-bold">
        {video.duration}
      </div>
    </div>

    <div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--aura-blue)] mb-1 block">
        {video.context || "Recommended for Focus"}
      </span>
      <h4 className="text-sm font-bold text-[var(--aura-dark)] line-clamp-2 mb-3">
        {video.title}
      </h4>

      <a
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-[var(--aura-blue)] transition-colors"
      >
        Watch on YouTube <span className="text-lg">↗</span>
      </a>
    </div>
  </div>
);
export default Dashboard;
