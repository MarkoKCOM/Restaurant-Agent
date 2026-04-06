import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const sourcePath = path.join(appDir, "test.html");
const distDir = path.join(appDir, "dist");
const targetPath = path.join(distDir, "index.html");

const html = await readFile(sourcePath, "utf8");
const output = html
  .replace("OpenSeat Booking Widget Test", "OpenSeat Booking Widget Demo")
  .replace("טסט ווידג'ט הזמנות", "ווידג'ט הזמנות - דמו")
  .replace(/\sdata-api-url="[^"]*"/, "")
  .replace("/widget/openseat-booking.iife.js", "./openseat-booking.iife.js");

await mkdir(distDir, { recursive: true });
await writeFile(targetPath, output);
console.log(`Generated ${path.relative(appDir, targetPath)}`);
