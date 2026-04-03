import { useNavigate } from "react-router-dom";
import useAuraData from "../hooks/useAuraData";
import SpotifyPlayer from "./SpotifyPlayer";
import FocusChart from "./FocusChart";
import StatCard from "./StatCard";

const Dashboard = () => {
  const navigate = useNavigate();
  const { userData, analytics, loading, focusHistory, video, category } =
    useAuraData();
  const userName = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--aura-light)]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--aura-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--aura-dark)] font-medium italic">
            Syncing your Aura...
          </p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="min-h-screen bg-[var(--aura-light)] bg-grid-mesh p-8">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--aura-dark)]">
            Welcome back, {userName?.name || "User"} 👋
          </h1>
          <p className="text-gray-500">
            Here's your behavioral "Aura" for today.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-sm flex items-center gap-3 border border-white/50">
            <div
              className={`w-3 h-3 rounded-full ${analytics.focus_score > 70 ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`}
            ></div>
            <span className="font-semibold text-sm">
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
          value={`${analytics?.focus_score || 0}%`}
          icon="🧠"
          color="var(--aura-blue)"
        />
        <StatCard
          title="Current App"
          value={analytics?.current_app || "Detecting..."}
          icon="🖥️"
          color="var(--aura-dark)"
        />
        <StatCard
          title="Most Used"
          value={analytics?.most_used || "Analyzing..."}
          icon="📊"
          color="var(--aura-green)"
        />
      </div>

      {/* 3. Main Trends Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Focus Chart Container (Spans 2/3) */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-md p-8 rounded-[32px] border border-white/20 shadow-xl min-h-[400px] flex flex-col">
          <h3 className="text-lg font-bold mb-6 text-[var(--aura-dark)]">
            Focus Trends
          </h3>
          <div className="flex-grow flex items-center justify-center w-full">
            {focusHistory && focusHistory.length > 0 ? (
              <div className="h-[300px] w-full">
                <FocusChart data={focusHistory} />
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-[var(--aura-blue)] rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm">Mapping focus patterns...</p>
              </div>
            )}
          </div>
        </div>

        {/* Mood Analysis Card (Spans 1/3) */}
        <div className="bg-[#1a1a1a] p-8 rounded-[32px] text-white shadow-2xl flex flex-col justify-between h-full">
          <div>
            <h3 className="text-lg font-bold mb-2">Mood Analysis</h3>
            <p className="text-gray-400 text-sm">
              Based on activity in {analytics.current_app}.
            </p>
          </div>
          <div className="text-center py-6">
            <span className="text-6xl mb-4 block">🧘</span>
            <h4 className="text-2xl font-bold italic">Calm & Productive</h4>
          </div>
          <button className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-2xl transition text-sm font-medium">
            View Insights
          </button>
        </div>
      </div>

      {/* 4. Spotify Row (New Full-Width Row) */}
      <div className="mb-10">
        <SpotifyPlayer focusScore={analytics.focus_score} />
      </div>

      {/* 5. Recommendation Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[var(--aura-dark)]">
            Curated for your Focus
          </h3>
          <span className="text-xs font-medium text-gray-400 bg-white/50 px-3 py-1 rounded-full border border-white/20">
            Based on {analytics.current_app}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {video ? (
            <div className="lg:col-span-2 bg-white/40 backdrop-blur-xl p-4 rounded-[32px] border border-white/40 shadow-2xl transition-all hover:shadow-lg">
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-inner">
                <iframe
                  src={`https://www.youtube.com/embed/${video.id}?autoplay=0&rel=0`}
                  className="absolute top-0 left-0 w-full h-full"
                  allowFullScreen
                  title="Aura Recommendation"
                ></iframe>
              </div>
              <div className="mt-4 px-2 flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-[var(--aura-blue)] uppercase tracking-widest">
                    Now Playing • {category} Mode
                  </p>
                  <h4 className="text-lg font-bold text-[var(--aura-dark)] line-clamp-1">
                    {video.title}
                  </h4>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white/20 border-2 border-dashed border-gray-300 rounded-[32px] flex items-center justify-center min-h-[350px]">
              <p className="text-gray-400 font-medium">
                Finding the perfect vibe...
              </p>
            </div>
          )}

          <div className="bg-gradient-to-br from-[var(--aura-blue)] to-[#6366f1] p-8 rounded-[32px] text-white shadow-xl flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            <h3 className="text-xl font-bold mb-4 relative z-10">
              Why this video?
            </h3>
            <p className="text-white/80 text-sm leading-relaxed mb-6 relative z-10">
              Your current activity suggests a <b>{category}</b> state. This
              track is selected to maintain your {analytics.focus_score}% focus
              level.
            </p>
            <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 relative z-10">
              <span className="text-[10px] uppercase font-black opacity-60">
                Insight
              </span>
              <p className="text-xs font-medium">
                Users in {category} mode finish tasks 22% faster with low-lyric
                audio.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
