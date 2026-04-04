import { type Config } from "tailwindcss";
import lineClamp from "@tailwindcss/line-clamp";

const config: Config = {
  content: [
    "./app*.{js,ts,jsx,tsx,mdx}",
    "./shared*.{js,ts,jsx,tsx,mdx}",
    "./lib*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
      },
      fontSize: {
        responsive: "clamp(1vh, 5vw, 1rem)",
        "responsive-lg": "clamp(1.5vh, 6vw, 1.5rem)",
        "responsive-xl": "clamp(2vh, 7vw, 2rem)",
        "responsive-2xl": "clamp(2.5vh, 8vw, 2.5rem)",
        "responsive-3xl": "clamp(3vh, 9vw, 3rem)",
        "responsive-4xl": "clamp(4vh, 12vw, 4rem)",
      },
      padding: {
        safe: "env(safe-area-inset-bottom, 0)",
      },
    },
  },
  plugins: [lineClamp],
};

export default config;
