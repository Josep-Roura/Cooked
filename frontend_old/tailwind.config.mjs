/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "hsl(210, 20%, 98%)",
          dark: "hsl(220, 30%, 7%)"
        },
        surface: {
          DEFAULT: "hsl(0, 0%, 100%)",
          dark: "hsl(220, 25%, 12%)"
        },
        border: {
          DEFAULT: "hsl(220, 15%, 88%)",
          dark: "hsl(220, 20%, 20%)"
        },
        text: {
          primary: "hsl(220, 25%, 15%)",
          secondary: "hsl(220, 10%, 40%)",
          inverted: "hsl(0, 0%, 100%)"
        },
        primary: {
          DEFAULT: "hsl(222, 95%, 55%)",
          hover: "hsl(222, 90%, 48%)",
          foreground: "hsl(0,0%,100%)"
        },
        success: {
          DEFAULT: "hsl(142, 70%, 40%)"
        },
        warning: {
          DEFAULT: "hsl(38, 92%, 50%)"
        },
        error: {
          DEFAULT: "hsl(0, 84%, 60%)"
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      },
      borderRadius: {
        lg: "1rem",
        full: "9999px"
      },
      boxShadow: {
        sm: "0 2px 4px rgba(0,0,0,0.06)",
        md: "0 8px 24px rgba(0,0,0,0.08)",
        lg: "0 24px 48px rgba(0,0,0,0.12)"
      },
      maxWidth: {
        content: "1280px"
      }
    }
  },
  plugins: []
};

export default config;
