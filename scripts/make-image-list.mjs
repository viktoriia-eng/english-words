// Проходить по public/images/ і записує масив назв у src/imageNames.js
// Запуск: node scripts/make-image-list.mjs  (або npm run images)
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "images");
const exts = new Set([".webp", ".png", ".jpg", ".jpeg"]);

const names = existsSync(dir)
    ? readdirSync(dir)
          .filter((f) => exts.has(extname(f).toLowerCase()))
          .map((f) => basename(f, extname(f)).replace(/-/g, " "))
          .sort()
    : [];

const out =
    "// Файл створюється автоматично: scripts/make-image-list.mjs\n" +
    "// Назви всіх картинок із public/images/ (school-bag.webp -> \"school bag\")\n" +
    "export const IMAGE_NAMES = " + JSON.stringify(names, null, 4) + ";\n";

writeFileSync(join(root, "src", "imageNames.js"), out);
console.log(`imageNames.js: ${names.length} картинок`);
