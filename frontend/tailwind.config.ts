import type { Config } from "tailwindcss"

export default {
  // <- para que TS no se queje con tu versión, usa string en vez de ["class"]
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx,mdx}",
    "./lib/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config
