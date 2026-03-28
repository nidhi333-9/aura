import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard.jsx";

createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId="634097304955-gp72tp0i0vriduko4clfrnke2i69o1p4.apps.googleusercontent.com">
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>
    ,
  </GoogleOAuthProvider>,
);
