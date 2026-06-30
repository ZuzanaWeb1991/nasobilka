import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<React.StrictMode><App /></React.StrictMode>);

// Remove the inline boot splash (shown instantly from index.html) once React has mounted
const splash = document.getElementById("boot-splash");
if (splash) splash.remove();

// Register service worker for PWA / offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
