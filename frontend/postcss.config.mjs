/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // Disable modern color spaces to avoid Turbopack compatibility issues
      // See: https://github.com/vercel/next.js/issues/65179
      support: false,
    },
    autoprefixer: {},
  },
}

export default config
