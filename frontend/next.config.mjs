import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
  webpack(config) {
    config.resolve.alias["@"] = path.resolve(__dirname)
    return config
  },
};

// Log the API URL during build to debug
console.log('🔧 Build-time NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);

export default nextConfig;
