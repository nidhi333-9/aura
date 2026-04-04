import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
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
        console.log("aura token: ", res.data.token);
        if (res.data.token) {
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("user", JSON.stringify(res.data.user));
          try {
            await axios.post("http://localhost:8080/save-token", {
              token: res.data.token,
            });
          } catch (err) {
            console.warn("Could not save token for sensor: ", err.message);
          }
          navigate("/dashboard", { replace: true });
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
  return { login, loading };
};
