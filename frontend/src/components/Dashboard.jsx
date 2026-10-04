import { useNavigate, useSearchParams } from "react-router-dom";
import useAuraData from "../hooks/useAuraData";
import SpotifyPlayer from "./SpotifyPlayer";
import FocusChart from "./FocusChart";
import StatCard from "./StatCard";
import { useState } from "react";
import {
  LogOut,
  LayoutDashboard,
  Zap,
  Target,
  Activity,
} from "lucide-react";
import TopSites from "./TopSites";
import StatusBanner from "./StatusBanner";
import SensorSetup from "./SensorSetup";
import DataControls from "./DataControls";
import HistoryView from "./history/HistoryView";

const VIEWS = [
  ["today", "Today"],
  ["week", "Week"],
  ["month", "Month"],
  ["quarter", "3 months"],
];
const RANGE_BY_VIEW = { week: "7d", month: "30d", quarter: "90d" };

const MOOD_EMOJI = { deep_focus: "🔥", calm_flow: "🧘", low_energy: "😴" };

const Dashboard = () => {
  const navigate = useNavigate();
  // Today / Week / Month lives in the URL (?view=week) so a refresh or a shared link
  // lands on the same tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const view = Object.hasOwn(RANGE_BY_VIEW, searchParams.get("view"))
    ? searchParams.get("view")
    : "today";
  const setView = (next) =>
    setSearchParams(next === "today" ? {} : { view: next }, { replace: true });
  const { live, trend, video } = useAuraData({ trendEnabled: view === "today" });
  // The page renders immediately; each card handles its own "not loaded yet" state.
  const analytics = live.data;
  const score = analytics?.focus_score ?? null; // null = nothing tracked recently
  const state = analytics?.state ?? null; // { key, label } decided by the server
  const hasTrendData = trend.data?.some((p) => p.score !== null) ?? false;
  const userName = JSON.parse(localStorage.getItem("user"));
  const [showInsights, setShowInsights] = useState(false);

  const scrollToInstall = () => {
    document
      .getElementById("connect-sensor")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToPermissions = () => {
    document
      .getElementById("mac-permissions")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[var(--aura-light)] bg-grid-mesh relative overflow-hidden flex flex-col font-sans">
      {/* BACKGROUND DECORATIVE GLOWS (Matching Landing Page) */}
      <div className="absolute w-[500px] h-[500px] bg-[var(--aura-blue)] opacity-5 blur-[120px] rounded-full -top-24 -left-24 pointer-events-none"></div>
      <div className="absolute w-[400px] h-[400px] bg-[var(--aura-green)] opacity-5 blur-[120px] rounded-full bottom-0 right-0 pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto w-full p-6 md:p-12">
        <StatusBanner
          live={live}
          onInstallClick={scrollToInstall}
          onPermissionsClick={scrollToPermissions}
        />

        {/* 1. NAVBAR / HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
          <div>
            <h1 className="text-4xl font-extrabold text-[var(--aura-dark)] tracking-tight">
              Welcome,{" "}
              <span className="text-[var(--aura-blue)]">
                {userName?.name || "User"}
              </span>{" "}
              👋
            </h1>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Activity size={16} /> Dashboard Overview •{" "}
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
            {/* <p className="text-gray-500 font-medium mt-1">
              Your behavioral story for{" "}
              <span className="text-[var(--aura-dark)] font-bold">Today</span>.
            </p> */}
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white/70 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-sm flex items-center gap-3 border border-white/40">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  state?.key === "deep_focus"
                    ? "bg-green-500 animate-pulse"
                    : state
                      ? "bg-yellow-500"
                      : "bg-gray-300"
                }`}
              ></div>
              <span className="font-bold text-xs uppercase tracking-widest text-[var(--aura-dark)]">
                {state?.label ?? (live.loading ? "Loading…" : "No recent activity")}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="bg-[var(--aura-dark)] text-white hover:bg-red-600 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg flex items-center gap-2 group"
            >
              <LogOut
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
              Logout
            </button>
          </div>
        </div>

        {/* VIEW SWITCH: one row above everything it scopes */}
        <div
          role="tablist"
          aria-label="Time range"
          className="inline-flex bg-white/70 backdrop-blur-md p-1 rounded-2xl border border-white/40 shadow-sm mb-10"
        >
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                view === key
                  ? "bg-[var(--aura-dark)] text-white shadow"
                  : "text-slate-500 hover:text-[var(--aura-dark)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "today" ? (
          <>
            {/* 2. TOP STATS (Clean White Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <StatCard
                title="Focus Score"
                value={score === null ? "—" : `${score}%`}
                icon={<Zap className="text-[var(--aura-blue)]" />}
                color="var(--aura-blue)"
              />
              <StatCard
                title="Current App"
                value={analytics?.current_app || "—"}
                icon={<Target className="text-purple-500" />}
                color="#a855f7"
              />
              <StatCard
                title="Active State"
                value={state?.label ?? "—"}
                icon={<Activity className="text-[var(--aura-green)]" />}
                color="var(--aura-green)"
              />
            </div>
            {/* TOP APPS & SITES */}
            <div className="mb-12">
              <TopSites
                topSites={analytics?.top_sites}
                loading={live.loading}
                onInstallClick={scrollToInstall}
              />
            </div>
            {/* 3. MAIN CONTENT STACK */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
              {/* Focus Trends - Glass Card */}
              <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl p-8 rounded-[40px] border border-white/40 shadow-xl flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-xl font-extrabold text-[var(--aura-dark)] tracking-tight">
                    Focus Trends
                  </h3>
                  <div className="h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--aura-blue)]"
                      style={{ width: "60%" }}
                    ></div>
                  </div>
                </div>

                <div className="flex-grow w-full">
                  {hasTrendData ? (
                    <div className="h-[300px] w-full min-h-[300px] min-w-0">
                      <FocusChart data={trend.data} liveScore={score} />
                    </div>
                  ) : trend.error && !trend.data ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                      <p className="text-sm font-medium">
                        Couldn't load today's trend. Retrying automatically…
                      </p>
                    </div>
                  ) : trend.data ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                      <p className="text-sm font-medium">
                        No activity recorded yet today.
                      </p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <div className="w-8 h-8 border-2 border-gray-200 border-t-[var(--aura-blue)] rounded-full animate-spin mb-4"></div>
                      <p className="text-sm font-medium text-center">
                        {trend.slow
                          ? "Waking up the server — this can take up to a minute…"
                          : "Mapping patterns..."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Mood Analysis - Dark Card (Matching Landing Page Stats Bar) */}
              <div className="bg-[#1a1a1a] p-10 rounded-[40px] text-white shadow-2xl flex flex-col justify-between border border-white/5 relative group overflow-hidden">
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-[var(--aura-blue)] opacity-0 group-hover:opacity-10 blur-[60px] transition-opacity duration-500 rounded-[40px] -z-10"></div>

                <div>
                  <p className="text-[var(--aura-blue)] font-black text-xs uppercase tracking-[0.2em] mb-2">
                    Real-time Insight
                  </p>
                  <h3 className="text-2xl font-bold mb-1">Mood Analysis</h3>
                  <p className="text-gray-500 text-sm italic">
                    Status: {state?.label ?? "Waiting for data"}
                  </p>
                </div>

                <div className="text-center py-10">
                  <span className="text-7xl mb-6 block drop-shadow-lg animate-float">
                    {MOOD_EMOJI[state?.key] ?? "⏳"}
                  </span>
                  <h4
                    className={`text-3xl font-black italic tracking-tighter ${state?.key === "deep_focus" ? "text-[var(--aura-blue)]" : "text-white"}`}
                  >
                    {state?.label ?? "No recent activity"}
                  </h4>

                  <div className="mt-8 space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-50">
                      <span>Efficiency</span>
                      <span>{score === null ? "—" : `${score}%`}</span>
                    </div>
                    <div className="bg-white/10 rounded-full h-1.5 w-full">
                      <div
                        className="h-full rounded-full bg-[var(--aura-blue)] shadow-[0_0_12px_var(--aura-blue)] transition-all duration-1000"
                        style={{ width: `${score ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowInsights(!showInsights)}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 py-4 rounded-2xl transition-all text-xs font-black uppercase tracking-widest"
                >
                  {showInsights ? "Collapse" : "Expand Insights"}
                </button>
              </div>
            </div>

            {/* 4. SPOTIFY PLAYER */}
            <div className="mb-12">
              <SpotifyPlayer focusScore={score ?? 0} />
            </div>

            {/* 5. RECOMMENDATIONS SECTION (Matching Landing Page Style) */}
            <div className="mt-16">
              <div className="flex items-center gap-4 mb-8">
                <h3 className="text-3xl font-extrabold text-[var(--aura-dark)] tracking-tight">
                  Curated Vibe
                </h3>
                <div className="h-[2px] flex-grow bg-gray-100"></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {video ? (
                  <div className="lg:col-span-2 bg-white/50 backdrop-blur-xl p-5 rounded-[40px] border border-white shadow-xl transition-transform hover:scale-[1.01]">
                    <div className="relative w-full aspect-video rounded-[30px] overflow-hidden shadow-2xl">
                      <iframe
                        src={`https://www.youtube.com/embed/${video.id}?autoplay=0&rel=0`}
                        className="absolute top-0 left-0 w-full h-full border-none"
                        allowFullScreen
                        title="Aura Recommendation"
                      ></iframe>
                    </div>
                    <div className="mt-6 px-4 pb-2">
                      <p className="text-[var(--aura-blue)] text-[10px] font-black uppercase tracking-[0.3em] mb-1">
                        Recommended for {state?.label ?? "you"}
                      </p>
                      <h4 className="text-xl font-extrabold text-[var(--aura-dark)]">
                        {video.title}
                      </h4>
                    </div>
                  </div>
                ) : (
                  <div className="lg:col-span-2 bg-white/30 border-4 border-dashed border-gray-200 rounded-[40px] flex items-center justify-center min-h-[400px]">
                    <p className="text-gray-400 font-bold italic">
                      Finding your visual frequency...
                    </p>
                  </div>
                )}

                {/* Why this video card */}
                <div className="bg-gradient-to-br from-[var(--aura-blue)] to-[#4f46e5] p-10 rounded-[40px] text-white shadow-2xl flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>

                  <h3 className="text-2xl font-black mb-4 relative z-10">
                    Why this? 🧠
                  </h3>
                  <p className="text-white/80 text-base leading-relaxed mb-8 relative z-10 font-medium">
                    We've analyzed your current usage of{" "}
                    <span className="text-white font-bold underline underline-offset-4">
                      {analytics?.current_app ?? "your recent activity"}
                    </span>
                    . This content is scientifically filtered to match a{" "}
                    <span className="font-bold underline">
                      {state?.label ?? "neutral"}
                    </span>{" "}
                    state.
                  </p>

                  <div className="bg-black/20 backdrop-blur-md p-6 rounded-3xl border border-white/10 relative z-10">
                    <p className="text-xs font-bold leading-relaxed">
                      "Cognitive synchronization occurs faster when visual stimuli
                      match ambient audio frequencies."
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </>
        ) : (
          // Same instance for Week and Month: switching keeps the frame and dims it while loading.
          <HistoryView range={RANGE_BY_VIEW[view]} onInstallClick={scrollToInstall} />
        )}

        <SensorSetup />

        <DataControls />

        {/* 6. FOOTER */}
        <div className="w-full text-center text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-24 pb-12">
          Aura © 2026 •{" "}
          <a href="/privacy" className="underline underline-offset-4 hover:text-gray-600">
            Privacy
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
