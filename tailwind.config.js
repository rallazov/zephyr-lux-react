/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Include all JavaScript and TypeScript files in src
    "./index.html", // Include the main HTML file if applicable
  ],
  theme: {
    extend: {
      colors: {
        zlx: {
          bg: "var(--zlx-bg)",
          surface: "var(--zlx-surface)",
          "surface-2": "var(--zlx-surface-2)",
          input: "var(--zlx-input)",
          border: "var(--zlx-border)",
          text: "var(--zlx-text)",
          muted: "var(--zlx-muted)",
          action: "var(--zlx-action)",
          "action-hover": "var(--zlx-action-hover)",
          "action-text": "var(--zlx-action-text)",
          danger: "var(--zlx-danger)",
          "danger-deep": "var(--zlx-danger-deep)",
          "danger-hover": "var(--zlx-danger-hover)",
          processing: "var(--zlx-processing)",
          success: "var(--zlx-success)",
          warning: "var(--zlx-warning)",
          progress: "var(--zlx-progress)",
          "progress-hover": "var(--zlx-progress-hover)",
        },
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
