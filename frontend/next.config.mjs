/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  },
};

// Log the API URL during build to debug
console.log('🔧 Build-time NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);

export default nextConfig;
