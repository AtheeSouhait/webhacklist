import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { pdfjsReleaseFiles } from "./pdfjs-release-build.mjs";
import { PDFJS_RELEASE_PATH, PDFJS_ROOT } from "./pdfjs-release.mjs";

test("one content-addressed root binds every PDF dependency and worker polyfill", async () => {
  const release = await pdfjsReleaseFiles();
  assert.equal(release.releasePath, PDFJS_RELEASE_PATH);
  assert.match(PDFJS_RELEASE_PATH, /^vendor\/pdfjs\/releases\/[a-f0-9]{64}$/);
  for (const name of ["build/pdf.mjs", "build/pdf.worker.mjs", "web/cmaps/Adobe-Japan1-UCS2.bcmap",
    "web/standard_fonts/LiberationSans-Regular.ttf", "web/wasm/openjpeg.wasm", "pdf-worker.mjs", "pdf-reader-polyfills.mjs"]) {
    assert.ok(release.files.get(name)?.length, name);
    assert.ok(new URL(name, PDFJS_ROOT).href.includes(PDFJS_RELEASE_PATH + "/"));
  }
  const wrapper = release.files.get("pdf-worker.mjs").toString();
  assert.ok(wrapper.includes('import "./pdf-reader-polyfills.mjs"'));
  assert.ok(wrapper.includes('import("./build/pdf.worker.mjs")'));
  assert.ok(!wrapper.includes("./vendor/pdfjs/"));
  const reader = await readFile(new URL("./pdf-reader.mjs", import.meta.url), "utf8");
  assert.ok(reader.includes('import { PDFJS_ROOT } from "./pdfjs-release.mjs"'));
  for (const name of ["build/pdf.mjs", "pdf-worker.mjs", "web/cmaps/", "web/standard_fonts/", "web/wasm/"]) {
    assert.ok(reader.includes(`new URL("${name}", PDFJS_ROOT)`), name);
  }
});
