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
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        border: "var(--border)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        destructive: "var(--destructive)",
        ring: "var(--ring)",
        input: "var(--input)",
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        pad: {
          black: "#000000",
          "black-soft": "#1a1a2e",
          "black-mid": "#2d2d44",
          blue: "#2962FF",
          "blue-light": "#5E8AFF",
          green: "#00C853",
          "green-light": "#33D968",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
        body: ["var(--font-open-sans)", "Open Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
