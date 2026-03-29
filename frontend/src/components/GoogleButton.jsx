import { useAuth } from "../hooks/useAuth";
const GoogleButton = () => {
  const { login, loading } = useAuth();
  return (
    <button
      onClick={() => login()}
      disabled={loading}
      className="mt-10 bg-gradient-to-r from-[var(--aura-blue)] to-[var(--aura-green)] text-white px-10 py-4 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
    >
      {loading ? "Logging in..." : " Continue with Google"}
    </button>
  );
};

export default GoogleButton;
