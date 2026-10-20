// Створює src/imageNames.js зі списком картинок із public/images/
//
// Структура:
//   public/images/domestic/cat.webp        -> група "domestic", слово "cat"
//   public/images/птахи/school-bag.png     -> група "птахи", слово "school bag"
//   public/images/horse.webp               -> група "Без папки" (картинки просто в images/)
//
// Запуск: node scripts/make-image-list.mjs  (або npm run images)

import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const imagesDir = join(projectRoot, "public", "images");
const outFile = join(projectRoot, "src", "imageNames.js");

const IMAGE_EXT = new Set([".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".avif"]);
const byName = (a, b) => a.localeCompare(b, "uk");

// school-bag.webp -> "school bag"
const toName = (file) => basename(file, extname(file)).replace(/[-_]+/g, " ").trim();

function readImages(dir) {
    return readdirSync(dir)
        .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()) && statSync(join(dir, f)).isFile())
        .sort(byName)
        .map((file) => ({ name: toName(file), file }));
}

const groups = [];

if (existsSync(imagesDir)) {
    // кожна підпапка — окрема група
    readdirSync(imagesDir)
        .filter((entry) => statSync(join(imagesDir, entry)).isDirectory())
        .sort(byName)
        .forEach((folder) => {
            const images = readImages(join(imagesDir, folder));
            if (images.length) {
                groups.push({ id: folder, label: folder.replace(/[-_]+/g, " "), images });
            }
        });

    // картинки, які лежать прямо в public/images/
    const loose = readImages(imagesDir);
    if (loose.length) groups.push({ id: "", label: "Без папки", images: loose });
}

const total = groups.reduce((sum, g) => sum + g.images.length, 0);

const text = `// Файл створюється автоматично: scripts/make-image-list.mjs
// Групи картинок: кожна папка в public/images/ — окрема група
export const IMAGE_GROUPS = ${JSON.stringify(groups, null, 4)};
`;

writeFileSync(outFile, text, "utf8");
console.log(`imageNames.js: ${groups.length} груп, ${total} картинок`);
