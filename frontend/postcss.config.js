module.exports = {
  plugins: {
    "@tailwindcss/postcss": {
      // Disable modern color spaces to avoid Turbopack compatibility issues
      // See: https://github.com/vercel/next.js/issues/65179
      support: false,
    },
    // Remove lab/lch color functions that Turbopack can't parse
    "./postcss-remove-lab.js": {},
    autoprefixer: {},
  },
};
