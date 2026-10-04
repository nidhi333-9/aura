import axios from "axios";

// Every API call (login included) goes through here, so VITE_API_URL is the single place that
// decides which backend the app talks to. Local development sets it in frontend/.env.local.
if (!import.meta.env.VITE_API_URL) {
  console.error(
    "VITE_API_URL is not set: API calls (and login) will go to this site's own address and fail. " +
      "Copy frontend/.env.example to frontend/.env.local.",
  );
}

// The generous timeout is for Render's free tier, whose first request after idle can take ~30-60 s.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 45000,
});

// Sends the saved session token, except on requests that opt out with { skipAuth: true }
// (login: there is nothing to prove yet, and an old expired token shouldn't be sent along).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.skipAuth) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
