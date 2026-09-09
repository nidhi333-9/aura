import { useEffect, useState } from "react";
import illustration from "./assets/Events-cuate.svg";
import GoogleButton from "./components/GoogleButton.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useNavigate } from "react-router-dom";
import { Check, Copy, Terminal, Download } from "lucide-react";
const MAC_INSTALL_CMD =
  "curl -fsSL https://raw.githubusercontent.com/nidhi333-9/aura/main/tracker/install.sh | bash";

function App() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyInstallCmd = () => {
    navigator.clipboard.writeText(MAC_INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  useEffect(() => {
    const token = localStorage.getItem("token");
    const callback = new URLSearchParams(window.location.search).get(
      "callback",
    );

    if (token) {
      if (callback) {
        window.location.href = `${callback}?token=${token}`; // hand it back to the sensor
        return;
      }
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const steps = [
    {
      step: "01",
      title: "Authenticate",
      desc: "Log in with your Google account to sync preferences.",
      icon: "👤",
    },
    {
      step: "02",
      title: "Install Sensor",
      desc: "Download or run the light background sensor agent.",
      icon: "💾",
    },
    {
      step: "03",
      title: "Analyze & Flow",
      desc: "Launch Aura and start receiving real-time insights.",
      icon: "🚀",
    },
  ];
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
      <section className="relative z-30 max-w-5xl mx-auto mb-32 px-4 w-full font-sans">
        <div className="relative overflow-hidden bg-white/60 backdrop-blur-2xl rounded-[40px] md:rounded-[48px] p-8 md:p-14 border border-white/80 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)]">
          {/* Subtle Background Accent Mesh */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-[var(--aura-blue)]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="max-w-xl mx-auto text-center mb-14">
            <span className="inline-flex items-center gap-1.5 text-[var(--aura-blue)] font-bold tracking-widest uppercase text-[11px] bg-[var(--aura-blue)]/10 border border-[var(--aura-blue)]/20 px-4 py-1.5 rounded-full">
              Quick Setup
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--aura-dark)] mt-4 mb-3 tracking-tight">
              Ready to find your flow?
            </h2>
            <p className="text-gray-500 font-medium text-base">
              Get Aura up and running on your machine in under two minutes.
            </p>
          </div>

          {/* Horizontal Step Flow */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 mb-14">
            {/* Connector Line (Desktop Only) */}
            <div className="hidden md:block absolute top-10 left-[18%] right-[18%] h-[2px] bg-gradient-to-r from-transparent via-gray-200 to-transparent -z-0" />

            {steps.map((item, idx) => (
              <div
                key={idx}
                className="relative z-10 flex flex-col items-center text-center p-6 rounded-3xl bg-white/40 border border-white/60 hover:bg-white/80 hover:shadow-lg transition-all duration-300 group"
              >
                {/* Step Icon Badge */}
                <div className="relative mb-5">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100/80 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                    {item.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 bg-[var(--aura-blue)] text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                    {item.step}
                  </span>
                </div>

                <h3 className="font-bold text-[var(--aura-dark)] text-lg mb-1">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-xs leading-relaxed max-w-[200px]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Installation Actions */}
          <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch w-full">
              {/* macOS Terminal Copy Button */}
              <button
                type="button"
                onClick={copyInstallCmd}
                className="group relative flex-1 flex items-center justify-between gap-3 bg-gray-900 hover:bg-black text-white px-5 py-3.5 rounded-2xl transition-all duration-300 shadow-xl shadow-gray-900/10 border border-gray-800"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-xl shrink-0">🍎</span>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-1">
                      macOS Terminal
                    </span>
                    <code className="text-xs font-mono text-gray-200 truncate max-w-[180px] sm:max-w-[160px] md:max-w-[200px]">
                      {MAC_INSTALL_CMD}
                    </code>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white/10 group-hover:bg-white/20 px-3 py-1.5 rounded-xl transition-colors shrink-0">
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] font-bold text-emerald-400 uppercase">
                        Copied
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-300" />
                      <span className="text-[11px] font-bold text-gray-300 uppercase">
                        Copy
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Windows Download Link */}
              <a
                href="https://github.com/nidhi333-9/aura/releases/latest/download/aura-sensor-windows.zip"
                className="group flex-1 flex items-center justify-between gap-3 bg-[var(--aura-blue)] text-white px-5 py-3.5 rounded-2xl hover:brightness-110 transition-all duration-300 shadow-xl shadow-[var(--aura-blue)]/20"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🪟</span>
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] opacity-80 uppercase font-bold leading-none mb-1">
                      Download for
                    </span>
                    <span className="font-bold text-sm leading-none">
                      Windows .ZIP
                    </span>
                  </div>
                </div>

                <div className="bg-white/15 group-hover:bg-white/25 p-2 rounded-xl transition-colors">
                  <Download className="w-4 h-4 text-white" />
                </div>
              </a>
            </div>

            {/* Platform OS Instructions */}
            <p className="text-xs text-gray-400 max-w-lg text-center leading-relaxed">
              <span className="font-semibold text-gray-500">macOS:</span> Paste
              into Terminal to bypass gatekeeper permissions.{" "}
              <br className="hidden sm:inline" />
              <span className="font-semibold text-gray-500">Windows:</span> If
              SmartScreen appears, select{" "}
              <span className="underline underline-offset-2">More info</span> →{" "}
              <span className="underline underline-offset-2">Run anyway</span>.
            </p>
          </div>
        </div>
      </section>
      {/* 5. FOOTER */}
      <div className="w-full text-center text-xs text-gray-400 pb-8">
        Aura © 2026. Respecting your privacy is our priority 🔒
      </div>
    </div>
  );
}
export default App;
