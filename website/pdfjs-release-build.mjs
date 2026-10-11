import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PDFJS_RELEASE_PATH } from "./pdfjs-release.mjs";

const app = path.dirname(fileURLToPath(import.meta.url));
async function filesUnder(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesUnder(path.join(directory, entry.name), name + "/"));
    else if (entry.isFile()) files.push(name);
    else throw Error(`Non-regular PDF.js release input: ${name}`);
  }
  return files;
}

export async function pdfjsReleaseFiles({ validate = true } = {}) {
  const directory = path.join(app, "vendor/pdfjs");
  const files = new Map();
  for (const name of (await filesUnder(directory)).sort()) {
    // Maintainer notes are mutable; distributed payload and licences are not.
    if (name === "README.md") continue;
    files.set(name, await readFile(path.join(directory, name)));
  }
  files.set("pdf-reader-polyfills.mjs", await readFile(path.join(app, "pdf-reader-polyfills.mjs")));
  const wrapper = await readFile(path.join(app, "pdf-worker.mjs"), "utf8");
  files.set("pdf-worker.mjs", Buffer.from(wrapper.replace("./vendor/pdfjs/build/pdf.worker.mjs", "./build/pdf.worker.mjs")));
  const hash = createHash("sha256");
  for (const [name, bytes] of [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    hash.update(`${name}\0${bytes.length}\0`); hash.update(bytes);
  }
  const releasePath = `vendor/pdfjs/releases/${hash.digest("hex")}`;
  if (validate && releasePath !== PDFJS_RELEASE_PATH) {
    throw Error(`PDF.js release changed: update PDFJS_RELEASE_PATH to ${releasePath} before publishing`);
  }
  return { releasePath, files };
}

if (process.argv.includes("--print-path")) console.log((await pdfjsReleaseFiles({ validate: false })).releasePath);
