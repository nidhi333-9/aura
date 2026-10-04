import { useGoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { buildSensorCallbackUrl } from "../utils/sensorCallback.js";

// Signing in may be the first request after the free-tier backend went to sleep and has to wake
// up (up to about a minute), so it waits longer than the client's default timeout.
const LOGIN_TIMEOUT_MS = 90_000;

export const useAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const login = useGoogleLogin({
    flow: "implicit",
    scope:
      "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await api.post(
          "/auth/google",
          { token: tokenResponse.access_token },
          { skipAuth: true, timeout: LOGIN_TIMEOUT_MS },
        );
        if (res.data.token) {
          localStorage.setItem("token", res.data.token);
          localStorage.setItem("user", JSON.stringify(res.data.user));
          const params = new URLSearchParams(window.location.search);
          const sensorUrl = buildSensorCallbackUrl(
            params.get("callback"),
            res.data.token,
          );
          if (sensorUrl) {
            window.location.href = sensorUrl; // hand it back to the sensor (loopback only)
            return;
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
