import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";

const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

function svg(size) {
  const r = Math.round(size * 0.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" fill="#111827"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
      font-family="Arial, Helvetica, sans-serif" font-weight="700"
      font-size="${size * 0.4}" fill="#22d3ee">GS</text>
  </svg>`;
}

for (const size of [192, 512]) {
  const buf = Buffer.from(svg(size));
  await sharp(buf).png().toFile(path.join(outDir, `icon-${size}.png`));
  console.log(`Wrote icon-${size}.png`);
}
