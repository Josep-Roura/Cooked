module.exports = {
  plugins: {
    "@tailwindcss/postcss": {
      // Disable modern color spaces to avoid Turbopack compatibility issues
      // See: https://github.com/vercel/next.js/issues/65179
      support: false,
    },
    autoprefixer: {},
  },
};
