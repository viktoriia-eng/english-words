import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ВАЖЛИВО: замість english-words впиши точну назву свого репозиторію
export default defineConfig({
  plugins: [react()],
  base: "/english-words/",
});
