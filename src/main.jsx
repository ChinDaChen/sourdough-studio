import React from "react";
import { createRoot } from "react-dom/client";
import { storage } from "./storage.js";
import App from "./App.jsx";

// App.jsx 內部仍呼叫 window.storage，這裡在掛載前把瀏覽器版實作接上去。
window.storage = storage;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
