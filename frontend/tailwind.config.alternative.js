/**
 * Tailwind CSS v4 Configuration without lab/lch color space generation
 * This prevents Turbopack from encountering unsupported color functions
 * 
 * The issue: Tailwind v4 automatically generates lab/lch alternatives for oklch colors
 * The solution: Explicitly configure theme to use only traditional color spaces
 */

module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx,mdx}",
    "./lib/**/*.{ts,tsx,js,jsx,mdx}",
  ],

  theme: {
    extend: {},

    // Explicitly define color palette in RGB to avoid lab/lch generation
    colors: {
      transparent: "transparent",
      current: "currentColor",
      black: "rgb(0 0 0)",
      white: "rgb(255 255 255)",
    },
  },

  corePlugins: {
    // Disable any plugins that might generate modern color spaces
  },

  plugins: [],
}
