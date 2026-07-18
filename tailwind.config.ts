import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#142433",
        mist: "#f2f5f7",
        signal: "#0e7490",
        coral: "#d9485f",
        moss: "#305d50",
        sand: "#f0dec2"
      },
      boxShadow: {
        card: "0 20px 60px rgba(20, 36, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
