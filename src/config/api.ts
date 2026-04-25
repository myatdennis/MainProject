// src/config/api.ts

// Define a single source of truth for the API base URL
export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:3000";
