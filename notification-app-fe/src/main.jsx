import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// import "./index.css";
import App from "./App.jsx";

// Store fresh token for logger
localStorage.setItem("token", "paste_your_fresh_token_here");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);