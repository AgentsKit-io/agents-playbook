import type { Config } from "tailwindcss";
import { createPreset } from "fumadocs-ui/tailwind-plugin";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
    "./node_modules/fumadocs-ui/dist/**/*.js",
  ],
  presets: [createPreset({
    preset: "default",
  })],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui"],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Accent + surface tokens; mapped from CSS variables in globals.css
      },
      backgroundImage: {
        "hero-gradient":
          "radial-gradient(ellipse at top, rgba(140,100,255,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(30,180,255,0.10), transparent 50%)",
        "accent-gradient":
          "linear-gradient(135deg, oklch(0.72 0.18 295), oklch(0.68 0.18 240))",
        "accent-gradient-hover":
          "linear-gradient(135deg, oklch(0.78 0.18 295), oklch(0.74 0.18 240))",
      },
      boxShadow: {
        "glow-purple": "0 0 60px -10px rgba(140,100,255,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
