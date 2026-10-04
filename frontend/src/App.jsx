import { useEffect } from "react";
import illustration from "./assets/Events-cuate.svg";
import GoogleButton from "./components/GoogleButton.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useNavigate } from "react-router-dom";

function App() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();

  // Sensors from before device pairing opened this page with ?callback=http://localhost:... to log
  // in. That way of connecting no longer exists, so say what to do instead of leaving the person
  // wondering why nothing happens, and don't skip past this page.
  const fromOldSensor = new URLSearchParams(window.location.search).has("callback");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || fromOldSensor) return;

    // Only a 401 means the token is bad; a cold-start 502 or a 5xx says nothing about it.
    fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("token"); // stale/invalid, force a fresh login
          return;
        }
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {});
  }, [navigate, fromOldSensor]);

  return (
    <div className="min-h-screen bg-[var(--aura-light)] relative overflow-hidden bg-grid-mesh flex flex-col">
      {/* 1. NAVBAR (Fixed top) */}
      <div className="absolute top-0 left-0 w-full flex justify-between items-center px-12 py-6 z-50">
        <h1 className="logo-font text-3xl font-bold text-[var(--aura-dark)]">
          🌱 Aura
        </h1>
        <button
          onClick={() => login()}
          disabled={loading}
          className="bg-[var(--aura-blue)] text-white px-5 py-2 rounded-xl shadow-md hover:scale-105 transition"
        >
          {loading ? "..." : "Login"}
        </button>
      </div>

      {/* 2. HERO SECTION */}
      <div className="pt-32 pb-10 text-center relative z-20 px-6">
        <div className="absolute w-[400px] h-[400px] bg-[var(--aura-blue)] opacity-10 blur-[120px] rounded-full left-1/2 -translate-x-1/2 top-0 -z-10"></div>

        {fromOldSensor && (
          <div
            role="status"
            className="max-w-2xl mx-auto mb-10 px-5 py-4 rounded-2xl border bg-amber-50 text-amber-800 border-amber-200 text-sm font-medium text-left"
          >
            <p className="font-bold">This link came from an old Aura sensor, which no longer works.</p>
            <p className="mt-1">
              Sign in, open <b>Connect a sensor</b> on your dashboard, and run the new install command.
              The old sensor can then be closed.
            </p>
          </div>
        )}

        <h1 className="text-6xl md:text-7xl font-extrabold text-[var(--aura-dark)] leading-tight max-w-4xl mx-auto tracking-tight mb-6">
          Understand yourself
          <br /> without saying a word
        </h1>
        <p className="text-gray-600 mt-6 max-w-2xl mx-auto text-lg/relaxed font-medium">
          Your behavior already tells a story. We just help you see it.
          <br />
          Transform insights into action, automatically.
        </p>
        <GoogleButton />
      </div>

      {/* 3. THE CENTRAL VISUAL STACK */}
      <div className="relative w-full max-w-7xl mx-auto min-h-[300px] md:h-[550px] z-10 flex items-center justify-center">
        {/* BACKGROUND GLOW */}
        <div className="absolute w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-[var(--aura-green)] opacity-10 blur-[100px] md:blur-[150px] rounded-full left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 -z-20"></div>

        {/* MAIN ILLUSTRATION */}
        <div className="**relative md:absolute** **md:left-1/2** **-translate-x-0 md:-translate-x-1/2** top-0 w-full max-w-2xl flex justify-center z-0 **mt-10 md:mt-0**">
          <img
            src={illustration}
            alt="Aura Illustration"
            className="w-[70%] md:w-[80%] h-auto drop-shadow-[0_35px_35px_rgba(14,165,233,0.15)] animate-float"
          />
        </div>

        {/* FLOATING CARDS - Hidden on small screens, shown from Medium (768px) up */}
        <div className="hidden md:block absolute left-[5%] top-[15%] bg-white/70 backdrop-blur-lg p-6 rounded-3xl shadow-xl w-64 border border-white/20 z-10 rotate-[-4deg]">
          <h2 className="text-3xl font-bold text-[var(--aura-blue)] mb-2">
            Spotify 🎶
          </h2>
          <p className="text-sm font-semibold mb-1">Mood-based playlists</p>
          <p className="text-xs text-gray-500">
            Get music that matches how you feel in real time.
          </p>
        </div>

        <div className="hidden md:block absolute right-[5%] top-[20%] bg-white/70 backdrop-blur-lg p-5 rounded-3xl shadow-2xl w-72 z-10 rotate-[5deg] scale-105 border border-white/20">
          <h2 className="text-3xl font-bold text-[#FF0000] mb-2">YouTube ▶️</h2>
          <p className="text-sm font-semibold mb-1">
            Smart video recommendations
          </p>
          <p className="text-xs text-gray-500">
            Discover content that fits your focus.
          </p>
        </div>
      </div>

      {/* 4. BOTTOM STATS BAR (Moved outside the relative stack) */}
      {/* 4. BOTTOM STATS BAR with Hover Glow */}
      <div className="relative z-30 max-w-6xl mx-auto -mt-16 mb-24 px-4 w-full group">
        {/* The Glow Effect (Hidden by default, follows group hover) */}
        <div className="absolute inset-0 bg-[var(--aura-blue)] opacity-0 group-hover:opacity-10 blur-[80px] transition-opacity duration-500 rounded-[40px] -z-10"></div>

        <div className="bg-[#1a1a1a] rounded-[40px] p-10 md:p-14 grid grid-cols-1 md:grid-cols-3 gap-8 text-white shadow-2xl border border-white/5 transition-all duration-300 group-hover:border-[var(--aura-blue)]/30 group-hover:shadow-[0_0_40px_-12px_rgba(14,165,233,0.3)]">
          {/* Section 1: Mood Detection */}
          <div className="flex flex-col items-center md:items-start md:border-r md:border-white/10 pr-4 group/item cursor-default">
            <h2 className="text-5xl font-bold text-[var(--aura-blue)] mb-2 transition-transform group-hover/item:-translate-y-1">
              35%
            </h2>
            <p className="text-sm font-semibold uppercase opacity-90">
              🧠 Mood Detection
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Emotional patterns from activity.
            </p>
          </div>

          {/* Section 2: Behavioral Insights */}
          <div className="flex flex-col items-center md:items-start md:border-r md:border-white/10 pr-4 group/item cursor-default">
            <h2 className="text-5xl font-bold text-white mb-2 transition-transform group-hover/item:-translate-y-1">
              3-6X
            </h2>
            <p className="text-sm font-semibold uppercase opacity-90">
              📊 Behavioral Insights
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Visualize habits with clarity.
            </p>
          </div>

          {/* Section 3: Recommendations */}
          <div className="flex flex-col items-center md:items-start group/item cursor-default">
            <h2 className="text-5xl font-bold text-white mb-2 transition-transform group-hover/item:-translate-y-1">
              50%
            </h2>
            <p className="text-sm font-semibold uppercase opacity-90">
              🎵 Personalized Guidance
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Recommendations for your state.
            </p>
          </div>
        </div>
      </div>

      {/* FEATURES / VALUE PROP SECTION */}
      <section className="relative z-30 max-w-5xl mx-auto mb-32 px-4 w-full font-sans">
        <div className="relative overflow-hidden bg-white/60 backdrop-blur-2xl rounded-[40px] md:rounded-[48px] p-8 md:p-14 border border-white/80 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)]">
          {/* Subtle Background Accent Mesh */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-[var(--aura-blue)]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="max-w-xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-1.5 text-[var(--aura-blue)] font-bold tracking-widest uppercase text-[11px] bg-[var(--aura-blue)]/10 border border-[var(--aura-blue)]/20 px-4 py-1.5 rounded-full">
              Why Aura
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--aura-dark)] mt-4 mb-3 tracking-tight">
              Engineered for deep focus
            </h2>
            <p className="text-gray-500 font-medium text-base">
              Understand your work habits with zero manual logging or extra
              setup.
            </p>
          </div>

          {/* 3-Column Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-start p-6 rounded-3xl bg-white/40 border border-white/60 hover:bg-white/80 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-xl mb-4 text-[var(--aura-blue)]">
                ⚡
              </div>
              <h3 className="font-bold text-[var(--aura-dark)] text-lg mb-2">
                Automatic Tracking
              </h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Runs silently in the background, logging active application
                contexts and focus sessions seamlessly.
              </p>
            </div>

            <div className="flex flex-col items-start p-6 rounded-3xl bg-white/40 border border-white/60 hover:bg-white/80 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-xl mb-4 text-[var(--aura-blue)]">
                📊
              </div>
              <h3 className="font-bold text-[var(--aura-dark)] text-lg mb-2">
                Real-time Analytics
              </h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Visualize peak productivity hours, context switches, and deep
                focus scores directly from your dashboard.
              </p>
            </div>

            <div className="flex flex-col items-start p-6 rounded-3xl bg-white/40 border border-white/60 hover:bg-white/80 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-xl mb-4 text-[var(--aura-blue)]">
                🔒
              </div>
              <h3 className="font-bold text-[var(--aura-dark)] text-lg mb-2">
                Privacy First
              </h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Your data belongs to your account only. See exactly what is
                collected, and delete it or your account any time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DIRECT CTA SECTION */}
      <section className="relative z-30 max-w-5xl mx-auto mb-32 px-4 w-full font-sans">
        <div className="relative overflow-hidden bg-white/60 backdrop-blur-2xl rounded-[40px] md:rounded-[48px] p-8 md:p-14 border border-white/80 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] flex flex-col items-center text-center">
          {/* Subtle Background Accent Mesh */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-[var(--aura-blue)]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Section Badge */}
          <span className="inline-flex items-center gap-1.5 text-[var(--aura-blue)] font-bold tracking-widest uppercase text-[11px] bg-[var(--aura-blue)]/10 border border-[var(--aura-blue)]/20 px-4 py-1.5 rounded-full mb-4">
            Instant Access
          </span>

          {/* CTA Copy */}
          <h2 className="text-3xl md:text-5xl font-extrabold text-[var(--aura-dark)] mb-4 tracking-tight max-w-2xl">
            Ready to find your flow?
          </h2>
          <p className="text-gray-500 font-medium text-base sm:text-lg max-w-lg mb-8 leading-relaxed">
            Jump directly into your personalized dashboard to analyze real-time
            focus metrics and behavioral insights.
          </p>

          {/* Primary Action Button */}
          <a
            href="/dashboard"
            className="inline-flex items-center gap-3 bg-[var(--aura-blue)] text-white font-bold text-base px-8 py-4 rounded-2xl shadow-xl shadow-[var(--aura-blue)]/25 hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            <span>Open Dashboard</span>
            <span className="text-xl">→</span>
          </a>
        </div>
      </section>
      {/* 5. FOOTER */}
      <div className="w-full text-center text-xs text-gray-400 pb-8">
        Aura © 2026 ·{" "}
        <a href="/privacy" className="underline underline-offset-4 hover:text-gray-600">
          Privacy
        </a>
      </div>
    </div>
  );
}
export default App;
