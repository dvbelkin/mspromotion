import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "Segoe UI", "sans-serif"],
        body: ["Plus Jakarta Sans", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 40px rgba(0,0,0,0.22)",
        glow: "0 0 80px rgba(100, 143, 255, 0.25)"
      },
      colors: {
        surface: "var(--surface)",
        "surface-soft": "var(--surface-soft)",
        "surface-elevated": "var(--surface-elevated)",
        text: "var(--text)",
        muted: "var(--muted)",
        line: "var(--line)",
        accent: "var(--accent)",
        accent2: "var(--accent-2)"
      }
    }
  },
  plugins: [typography]
};
