// First-party synthetic PDF and shared-origin tabs in the offline browser sandbox.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { launchBrowser } from "./browser-test.mjs";

const base = process.env.WEBSEC_TEST_URL || "http://127.0.0.1:4173/";
const axe = await readFile(process.env.AXE_SOURCE || new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
function syntheticPdf() {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>"];
  for (const text of ["Token alpha <script>inert</script>", "", "Token omega final page"]) {
    const stream = `BT /F1 18 Tf 30 740 Td (${text}) Tj ET`;
    const number = objects.length + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 9 0 R >> >> /Contents ${number + 1} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  return Buffer.from(pdf + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const a = await context.newPage(), b = await context.newPage();
  for (const page of [a, b]) {
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}#desk`);
    await page.waitForSelector(".discovery-record");
    await page.waitForFunction(() => !document.querySelector("#boot-screen"));
  }
  const ids = await a.evaluate(() => state.items.slice(0, 2).map(item => item.id));
  await b.evaluate(id => openArtifact(id), ids[0]);
  await a.evaluate(id => { const item = state.items.find(item => item.id === id); setFavouriteState(item, true); setReadState(item, true); }, ids[0]);
  await b.waitForFunction(() => document.querySelector("#artifact-favourite-toggle").getAttribute("aria-pressed") === "true" && document.querySelector("#artifact-read-toggle").getAttribute("aria-pressed") === "true");
  // Exercise simultaneous different-record edits before either tab consumes the event.
  await Promise.all([a.evaluate(id => setReadState(state.items.find(item => item.id === id), false), ids[0]), b.evaluate(id => setReadState(state.items.find(item => item.id === id), true), ids[1])]);
  for (const page of [a, b]) await page.waitForFunction(ids => !state.items.find(item => item.id === ids[0]).read && state.items.find(item => item.id === ids[1]).read, ids);
  await b.locator("#artifact-favourite-toggle").click();
  await a.waitForFunction(id => !state.items.find(item => item.id === id).favourite, ids[0]);
  await a.reload();
  await a.waitForSelector(".discovery-record");
  assert.deepEqual(await a.evaluate(ids => ids.map(id => { const item = state.items.find(item => item.id === id); return [item.read, item.favourite]; }), ids), [[false, false], [true, false]]);
  // A shared-storage clear should also refresh other tabs.
  await a.evaluate(() => localStorage.clear());
  await b.waitForFunction(() => state.readKeys.size === 0 && state.favouriteKeys.size === 0);
  await b.close();

  const pdf = syntheticPdf();
  await context.route("**/original-listings/2099-top10.pdf*", route => route.fulfill({ contentType: "application/pdf", headers: { "access-control-allow-origin": "*", "content-length": String(pdf.length) }, body: pdf }));
  await a.evaluate(() => openPdfViewer(null, { path: "original-listings/2099-top10.pdf", kind: "listingPdf", title: "Synthetic accessible PDF" }));
  const iframe = a.frameLocator("#pdf-frame");
  await iframe.locator("canvas").first().waitFor({ state: "visible" });
  const frame = a.frames().find(frame => frame.url().includes("pdf-reader.html"));
  assert.ok(frame, "PDF parsing remains on the separate reader origin");
  assert.notEqual(new URL(frame.url()).origin, new URL(a.url()).origin);
  assert.ok(await a.locator("#pdf-open-markdown").isHidden(), "annual PDF has no Markdown alternative");
  // The actual container must reach the next page synchronously, not animate.
  async function immediateNext() {
    assert.equal(await frame.evaluate(() => {
      const target = document.querySelector('[data-page="2"]');
      const scroller = document.querySelector("#document-scroll");
      scroller.scrollTo({ top: 0, behavior: "instant" });
      document.querySelector("#next-page").click();
      return Math.abs(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top) <= 1;
    }), true);
  }
  await a.emulateMedia({ reducedMotion: "reduce" });
  await iframe.locator('html[data-motion-reduced="true"]').waitFor();
  await immediateNext();
  await a.emulateMedia({ reducedMotion: "no-preference" });
  await a.evaluate(() => { motionOverride = true; applyMotionPreference(); });
  await iframe.locator('html[data-motion-reduced="true"]').waitFor();
  await frame.evaluate(() => document.querySelector("#previous-page").click());
  await immediateNext();
  await a.evaluate(() => { motionOverride = false; applyMotionPreference(); });
  await iframe.locator('html[data-motion-reduced="false"]').waitFor();
  await iframe.locator("#text-mode").focus();
  await a.keyboard.press("Enter");
  await iframe.locator("#text-query:not([disabled])").waitFor();
  assert.match(await iframe.locator(".page-text").first().innerText(), /Token alpha <script>inert<\/script>/);
  assert.match(await iframe.locator(".page-text").nth(1).innerText(), /No extractable text/);
  assert.equal(await iframe.locator(".page-text script").count(), 0);
  await iframe.locator("#text-query").fill("Token");
  await iframe.locator("#text-query").press("Enter");
  await frame.waitForFunction(() => document.querySelector("#text-status").textContent.startsWith("Match 1"));
  assert.match(await iframe.locator("#text-status").innerText(), /Match 1 \/ 2, page 1/);
  assert.equal(await iframe.locator("mark").innerText(), "Token");
  await iframe.locator("#text-find").focus();
  await iframe.locator("#text-find").press("Enter");
  await frame.waitForFunction(() => document.querySelector("#text-status").textContent.startsWith("Match 2"));
  assert.match(await iframe.locator("#text-status").innerText(), /Match 2 \/ 2, page 3/);
  assert.equal(await frame.evaluate(() => document.activeElement.tagName), "MARK");
  assert.equal(await iframe.locator(".page-text-content").first().evaluate(element => {
    const style = getComputedStyle(element);
    return style.getPropertyValue("user-select") || style.getPropertyValue("-webkit-user-select");
  }), "text");
  await a.setViewportSize({ width: 320, height: 568 });
  assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "reader controls and reflowed text fit 320px");
  for (const theme of ["light", "dark"]) {
    await a.evaluate(theme => { state.readingTheme = theme; syncPdfReaderPreferences(); }, theme);
    await iframe.locator(`html[data-theme="${theme}"]`).waitFor();
    await frame.evaluate(axe);
    const result = await frame.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
    assert.deepEqual(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.failureSummary) })), [], `${theme} PDF iframe accessibility`);
  }
  await iframe.locator("#text-query").fill("missing-word");
  await iframe.locator("#text-query").press("Enter");
  await frame.waitForFunction(() => document.querySelector("#text-status").textContent.startsWith("No matches"));
  assert.match(await iframe.locator("#text-status").innerText(), /No matches/);
  await iframe.locator("#text-mode").click();
  await iframe.locator("canvas:visible").first().waitFor({ state: "visible" });
  assert.deepEqual(errors, []);
  await context.close();
  console.log("PDF text/keyboard/search/iframe accessibility/motion and concurrent saved-state synchronization PASS");
} finally { await browser.close(); }
