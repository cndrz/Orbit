/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        display: ["'Syne'", "sans-serif"],
      },
      colors: {
        // Orbit design system – deep slate base with amber accent
        orbit: {
          bg:       "#0D0F14",
          surface:  "#13161D",
          panel:    "#191C26",
          border:   "#252836",
          muted:    "#3A3F52",
          text:     "#C8CEDD",
          subtext:  "#6B7280",
          accent:   "#F59E0B",   // amber-500
          accentDim:"#78350F",
          success:  "#10B981",
          danger:   "#EF4444",
          info:     "#6366F1",
        },
      },
      boxShadow: {
        "orbit-panel": "0 0 0 1px #252836, 0 4px 24px rgba(0,0,0,0.4)",
        "orbit-glow":  "0 0 20px rgba(245,158,11,0.15)",
      },
      animation: {
        "fade-in":    "fadeIn 0.25s ease forwards",
        "slide-up":   "slideUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:     { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp:    { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pulseSoft:  { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
      },
    },
  },
  plugins: [],
};
