import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

console.log("🚀 Minimal MainProject test app starting...");

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("❌ Root element not found! Cannot render app.");
  document.body.innerHTML =
    '<div style="padding: 40px; font-family: system-ui; color: #dc3545;"><h1>Error: Root Element Missing</h1><p>The #root div is missing from index.html</p></div>';
} else {
  console.log("✅ Root element found, rendering minimal app...");

  try {
    createRoot(rootElement).render(
      <React.StrictMode>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#020617",
            color: "#f9fafb",
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          <div
            style={{
              padding: "2.5rem 2rem",
              borderRadius: "1rem",
              border: "1px solid rgba(148, 163, 184, 0.4)",
              maxWidth: "480px",
              textAlign: "center",
              background: "#020617",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <h1 style={{ fontSize: "1.8rem", marginBottom: "0.75rem" }}>
              The Huddle Co. Admin
            </h1>
            <p style={{ margin: "0.4rem 0" }}>
              The full dashboard is still being wired up.
            </p>
            <p style={{ margin: "0.4rem 0" }}>
              This is a minimal test page to confirm React is running.
            </p>
            <div
              style={{
                marginTop: "1.5rem",
                display: "inline-block",
                padding: "0.25rem 0.75rem",
                borderRadius: "999px",
                border: "1px solid #f97316",
                fontSize: "0.75rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#fed7aa",
              }}
            >
              Admin portal under construction
            </div>
          </div>
        </div>
      </React.StrictMode>
    );
    console.log("✅ Minimal app rendered successfully");
  } catch (error) {
    console.error("❌ Error rendering minimal app:", error);
    rootElement.innerHTML = `<div style="padding: 40px; font-family: system-ui; color: #dc3545;"><h1>Error Rendering Minimal App</h1><pre>${error}</pre></div>`;
  }
}
