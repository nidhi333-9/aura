import axios from "axios";

if (!import.meta.env.VITE_API_URL) {
  console.error(
    "VITE_API_URL is not set: API calls (and login) will go to this site's own address and fail. " +
      "Copy frontend/.env.example to frontend/.env.local.",
  );
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 45000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.skipAuth)
    config.headers.Authorization = `Bearer ${token}`;
  return config;
});
