/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        aura: {
          blue: "#1E3A8A",
          lightBlue: "#3B82F6",
          green: "#10B981",
          yellow: "#F59E0B",
          dark: "#0F172A",
          light: "#F9FAFB",
        },
      },
    },
  },
  plugins: [],
};
