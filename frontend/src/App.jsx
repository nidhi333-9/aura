import { useEffect } from "react";
import illustration from "./assets/Events-cuate.svg";
import GoogleButton from "./components/GoogleButton.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useNavigate } from "react-router-dom";
function App() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);
  return (
    <div className="min-h-screen bg-[var(--aura-light)] relative overflow-hidden bg-grid-mesh flex flex-col">
      {/* 1. NAVBAR (Fixed top) */}
      <div className="absolute top-0 left-0 w-full flex justify-between items-center px-12 py-6 z-50">
        <h1 className="logo-font text-3xl font-bold text-[var(--aura-dark)]">
          Aura
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

        <h1 className="text-6xl md:text-7xl font-extrabold text-[var(--aura-dark)] leading-tight max-w-4xl mx-auto tracking-tight mb-6">
          Understand yourself
          <br /> without saying a word
        </h1>
        <p className="text-gray-600 mt-6 max-w-2xl mx-auto text-lg/relaxed font-medium">
          Your behavior already tells a story. We just help you see it.
          <br />
          Transform insights into action, automatically.
        </p>
        {/* <button className="mt-10 bg-gradient-to-r from-[var(--aura-blue)] to-[var(--aura-green)] text-white px-10 py-4 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">
          Continue with Google
        </button> */}
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

      {/* DOWNLOAD SECTION */}
      {/* DOWNLOAD SECTION */}
      <div className="relative z-30 max-w-5xl mx-auto mb-32 px-4 w-full">
        <div className="bg-white/40 backdrop-blur-xl rounded-[48px] p-8 md:p-16 border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
          {/* Header - More compact and modern */}
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="text-[var(--aura-blue)] font-bold tracking-widest uppercase text-xs bg-[var(--aura-blue)]/10 px-4 py-2 rounded-full">
              Quick Setup
            </span>
            <h2 className="text-4xl font-black text-[var(--aura-dark)] mt-6 mb-4">
              Ready to find your flow?
            </h2>
            <p className="text-gray-500 font-medium">
              Set up Aura in less than two minutes.
            </p>
          </div>

          {/* Steps - Horizontal flow with indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative mb-16">
            {/* Visual Connector Line (Hidden on mobile) */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-transparent via-gray-200 to-transparent -z-10"></div>

            {[
              {
                step: "01",
                title: "Authenticate",
                desc: "Login with Google",
                icon: "👤",
              },
              {
                step: "02",
                title: "Install",
                desc: "Download the sensor",
                icon: "💾",
              },
              {
                step: "03",
                title: "Analyze",
                desc: "Run and see insights",
                icon: "🚀",
              },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center group">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <span className="text-[var(--aura-blue)] font-black text-xs mb-1">
                  {item.step}
                </span>
                <h3 className="font-bold text-[var(--aura-dark)] text-lg">
                  {item.title}
                </h3>
                <p className="text-gray-400 text-sm mt-1">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Modernized Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://github.com/nidhi333-9/aura/releases/download/v1.0.0/aura-sensor-mac"
              className="group relative flex items-center gap-3 bg-[var(--aura-dark)] text-white px-10 py-4 rounded-2xl hover:bg-black transition-all duration-300 shadow-xl"
            >
              <span className="text-xl">🍎</span>
              <div className="flex flex-col items-start">
                <span className="text-[10px] opacity-60 uppercase font-bold leading-none">
                  Download for
                </span>
                <span className="font-bold">macOS</span>
              </div>
            </a>

            <a
              href="https://github.com/nidhi333-9/aura/releases/download/v1.0.0/aura-sensor-windows.exe"
              className="group relative flex items-center gap-3 bg-[var(--aura-blue)] text-white px-10 py-4 rounded-2xl hover:brightness-110 transition-all duration-300 shadow-xl shadow-blue-500/20"
            >
              <span className="text-xl">🪟</span>
              <div className="flex flex-col items-start">
                <span className="text-[10px] opacity-70 uppercase font-bold leading-none">
                  Download for
                </span>
                <span className="font-bold">Windows</span>
              </div>
            </a>
          </div>
        </div>
      </div>
      {/* 5. FOOTER */}
      <div className="w-full text-center text-xs text-gray-400 pb-8">
        Aura © 2026. Respecting your privacy is our priority 🔒
      </div>
    </div>
  );
}
export default App;
