// Rasterizes assets/icon.svg to a flat 256x256 icon.png using sharp.
import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "assets", "icon.svg");
const output = join(root, "icon.png");
const SIZE = 256;
const MAX_BYTES = 50 * 1024;

const svg = await readFile(source);
const png = await sharp(svg, { density: 384 })
  .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9, palette: true })
  .toBuffer();

await writeFile(output, png);

const { size } = await stat(output);
const kib = (size / 1024).toFixed(1);
if (size > MAX_BYTES) {
  console.error(`icon.png is ${kib} KB — exceeds the 50 KB limit.`);
  process.exit(1);
}
console.log(`Wrote icon.png (${SIZE}x${SIZE}, ${kib} KB).`);
