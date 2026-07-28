/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0d1117",
        panel: "#161b22",
        border: "#30363d",
        accent: "#2f81f7",
      },
      screens: {
        xs: "420px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
