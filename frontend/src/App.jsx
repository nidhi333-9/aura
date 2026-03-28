import illustration from "./assets/Events-cuate.svg";
import GoogleButton from "./components/GoogleButton.jsx";
function App() {
  return (
    <div className="min-h-screen bg-[var(--aura-light)] relative overflow-hidden bg-grid-mesh flex flex-col">
      {/* 1. NAVBAR (Fixed top) */}
      <div className="absolute top-0 left-0 w-full flex justify-between items-center px-12 py-6 z-50">
        <h1 className="logo-font text-3xl font-bold text-[var(--aura-dark)]">
          Aura
        </h1>
        <button className="bg-[var(--aura-blue)] text-white px-5 py-2 rounded-xl shadow-md hover:scale-105 transition">
          Login
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

      {/* 3. THE CENTRAL VISUAL STACK (Dedicated height to prevent overlap) */}
      <div className="relative w-full max-w-7xl mx-auto h-[550px] z-10">
        {/* BACKGROUND GLOW */}
        <div className="absolute w-[600px] h-[600px] bg-[var(--aura-green)] opacity-10 blur-[150px] rounded-full left-1/2 -translate-x-1/2 top-0 -z-20"></div>

        {/* MAIN ILLUSTRATION (Z-index 0) */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-full max-w-2xl flex justify-center z-0">
          <img
            src={illustration}
            alt="Aura Illustration"
            className="w-[80%] h-auto drop-shadow-[0_35px_35px_rgba(14,165,233,0.15)] animate-float"
          />
        </div>

        {/* FLOATING CARDS (Z-index 10 to stay above image) */}
        <div className="absolute left-[5%] top-[15%] bg-white/70 backdrop-blur-lg p-6 rounded-3xl shadow-xl w-64 border border-white/20 z-10 rotate-[-4deg]">
          <h2 className="text-3xl font-bold text-[var(--aura-blue)] mb-2">
            Spotify 🎶
          </h2>
          <p className="text-sm font-semibold mb-1">Mood-based playlists</p>
          <p className="text-xs text-gray-500">
            Get music that matches how you feel in real time.
          </p>
        </div>

        <div className="absolute right-[5%] top-[20%] bg-white/70 backdrop-blur-lg p-5 rounded-3xl shadow-2xl w-72 z-10 rotate-[5deg] scale-105 border border-white/20">
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

      {/* 5. FOOTER */}
      <div className="w-full text-center text-xs text-gray-400 pb-8">
        Aura © 2026. Respecting your privacy is our priority 🔒
      </div>
    </div>
  );
}
export default App;
