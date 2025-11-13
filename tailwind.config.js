/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Include all JavaScript and TypeScript files in src
    "./index.html", // Include the main HTML file if applicable
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1E40AF", // Example: Custom primary color
        secondary: "#9333EA", // Example: Custom secondary color
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"], // Example: Add custom font families
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"), // Optional: Adds better form styles
    require("@tailwindcss/typography"), // Optional: For rich text formatting
    require("@tailwindcss/aspect-ratio"), // Optional: Aspect ratio utilities
  ],
}

