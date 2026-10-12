import type { Config } from "tailwindcss";

/* Sistema de diseño: negro minimalista con un único acento (verde de marca 3L J4RD1N).
   Las escalas `cyan` y `purple` se redefinen para que todos los componentes existentes adopten
   el nuevo estilo sin reescribirlos: cyan = acento de marca, purple = gris neutro. */
const marca = {
  50: "#E6FFF4", 100: "#C2FBE2", 200: "#8AF3C6", 300: "#4FE8A8", 400: "#00D47E",
  500: "#00B86C", 600: "#009558", 700: "#007545", 800: "#005A36", 900: "#003D25", 950: "#00241A",
};
const neutro = {
  50: "#FAFAFA", 100: "#F4F4F5", 200: "#E4E4E7", 300: "#D4D4D8", 400: "#C4C4CC",
  500: "#A1A1AA", 600: "#71717A", 700: "#52525B", 800: "#27272A", 900: "#18181B", 950: "#0B0B0C",
};

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "#000000",
        panel:   "#0B0B0C",
        panel2:  "#141416",
        line:    "#1F1F23",
        accent:  "#00D47E",
        accent2: "#A1A1AA",
        success: "#34D399",
        error:   "#F87171",
        dim:     "#8B8B94",
        teal:    "#10b981",
        cyan:    marca,
        purple:  neutro,
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in":    "fadeIn 0.3s ease-in-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
export default config;
