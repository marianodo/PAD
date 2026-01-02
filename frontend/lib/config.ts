// Configuration constants for the application
// This ensures the API URL is properly set at build time

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_V1 = `${API_URL}/api/v1`;

// Log the configuration in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("🔧 Client-side API_URL:", API_URL);
}
