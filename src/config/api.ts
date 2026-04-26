// src/config/api.ts

// Define a single source of truth for the API base URL
export const API_BASE = import.meta.env.MODE === 'development'
	? 'http://localhost:3000'
	: 'https://api.the-huddle.co';
