import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
const GoogleButton = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const login = useGoogleLogin({
    flow: "implicit",
    scope:
      "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      console.log("Sending token:", tokenResponse);
      try {
        const res = await axios.post("http://localhost:8080/auth/google", {
          token: tokenResponse.access_token,
        });
        console.log(res.data);
        if (res.data.token) {
          localStorage.setItem("token", res.data.token);
          setTimeout(() => {
            navigate("/dashboard");
          }, 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      console.log("Login Failed...");
    },
  });
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
