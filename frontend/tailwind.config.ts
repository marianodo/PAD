import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        pad: {
          aubergine: "#201631",
          "aubergine-mid": "#3C2E51",
          "aubergine-light": "#534A68",
          purple: "#5941CE",
          "purple-light": "#7B6FD4",
          mint: "#00CCBA",
          "mint-light": "#33D9C9",
          "off-white": "#F2F3F4",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "DM Sans", "Inter", "sans-serif"],
        serif: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
