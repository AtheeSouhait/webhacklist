// Real UI downloads and print-media contracts; all source processing stays in Docker.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {launchBrowser,browserName,mobileEmulation} from "./browser-test.mjs";
const base=process.env.WEBSEC_TEST_URL || "http://127.0.0.1:4173/";
const action=format=>`[data-discovery-action="desk-bibliography"][data-discovery-value="${format}"]`;
const browser=await launchBrowser(), errors=[];
async function open(context,search="") {
  const page=await context.newPage(); page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${base}${search}#desk`); await page.waitForSelector("#desk-query");
  await page.waitForFunction(()=>!document.querySelector("#boot-screen")); return page;
}
async function ready(page) { await page.waitForFunction(()=>!discoveryLoadState().missing.length); }
async function download(page,format) {
  const event=page.waitForEvent("download"); await page.locator(action(format)).click();
  const file=await event; assert.equal(file.suggestedFilename(),`webhacklist-shortlist.${format === "csv" ? "csv" : "md"}`);
  return readFile(await file.path(),"utf8");
}
async function print(page,name) {
  await page.evaluate(()=>{window.print=()=>{window.printRequested=true;dispatchEvent(new Event("beforeprint"));};});
  await page.locator(action("print")).focus(); await page.keyboard.press("Enter");
  await page.waitForFunction(()=>window.printRequested && !shortlistPreparing);
  const expected=await page.evaluate(()=>ShortlistBibliography.records(deskFilteredRecords(),normalizeUrl,itemStandingLabel).length);
  assert.equal(await page.locator("#shortlist-print > ol > li").count(),expected);
  await page.emulateMedia({media:"print"});
  assert.equal(await page.locator("#app-shell").isVisible(),false);
  assert.equal(await page.locator("canvas:visible, dialog:visible, .sidebar:visible, .topbar:visible").count(),0);
  assert.match(await page.locator("#shortlist-print").innerText(),new RegExp(`${expected} records. Full matching set`));
  // Clear emulation so page.pdf uses print CSS and restores normal screen media
  // for afterprint. Explicit screen emulation would incorrectly print the shell.
  await page.emulateMedia({media:null});
  if(browserName === "chromium") {
    const pdf=await page.pdf({format:"A4",printBackground:false,displayHeaderFooter:false,preferCSSPageSize:true});
    assert.ok(pdf.subarray(0,5).equals(Buffer.from("%PDF-"))); assert.ok(pdf.length<8*1024*1024);
    if(process.env.WEBSEC_SHORTLIST_CAPTURE === "1") console.log("SHORTLIST_ARTIFACT "+JSON.stringify({name:`${name}.pdf`,type:"pdf",bytes:pdf.length,data:pdf.toString("base64")}));
  }
  await page.evaluate(()=>{dispatchEvent(new Event("afterprint"));window.printRequested=false;});
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.discoveryValue),"print");
  assert.equal(await page.locator("#shortlist-print").isVisible(),false);
}
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.addInitScript(()=>Object.defineProperty(navigator,"connection",{value:{saveData:true},configurable:true}));
  const page=await open(context,"?q=HTTP"); await ready(page);
  const expected=await page.evaluate(()=>deskFilteredRecords().map(item=>({id:item.id,title:item.title})));
  assert.ok(expected.length>40);
  await page.locator('[data-discovery-action="desk-next"]').click();
  const markdown=await download(page,"markdown");
  assert.match(markdown,new RegExp(`${expected.length} records`));
  assert.equal((markdown.match(/^## \d+\./gm)||[]).length,expected.length,"download includes later pages, not only twenty visible rows");
  const csv=await download(page,"csv");
  for(const record of expected) assert.ok(csv.includes(`"${record.id}"`));
  assert.match(await page.locator(".discovery-pagination").innerText(),/Page 2/);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.discoveryValue),"csv");

  await page.locator('[data-discovery-action="desk-reset"]').click(); await page.selectOption("#desk-year","2024");
  await ready(page);
  // Optional metadata must be ready too. A failed source shard blocks the entire
  // export, then retry retrieves the full sources/credits without inventing them.
  await page.evaluate(()=>{loadedSourceDetails.delete("2024");});
  let failure=true, downloads=0;
  page.on("download",()=>downloads++);
  await page.route("**/data/sources/2024.json*",route=>failure?route.fulfill({status:503,body:"Synthetic failure"}):route.continue());
  await page.locator(action("markdown")).click();
  await page.waitForFunction(()=>document.querySelector("#toast").textContent.includes("could not be prepared"));
  assert.equal(downloads,0); assert.equal(await page.locator(action("markdown")).isEnabled(),true);
  failure=false; await download(page,"markdown"); assert.equal(downloads,1);

  // Save a short set using the existing UI; no parallel selection mechanism.
  const saved=await page.locator(".discovery-record [data-favourite]").evaluateAll(nodes=>nodes.slice(0,2).map(node=>node.dataset.favourite));
  for(const id of saved) await page.locator(`[data-favourite="${id}"]`).click();
  await page.selectOption("#desk-saved","saved");
  assert.equal(await page.locator(".discovery-record").count(),2);
  const shortMarkdown=await download(page,"markdown"); assert.match(shortMarkdown,/2 records/);
  await print(page,"shortlist-short");
  await page.selectOption("#desk-saved","all"); await page.selectOption("#desk-standing","winner");
  await print(page,"shortlist-multiple");
  assert.equal(await page.evaluate(()=>history.state?.archiveView || "desk"),"desk");
  const deskUrl=page.url();
  await page.evaluate(()=>scrollTo({top:600,behavior:"instant"}));
  // Keyboard activation avoids a pointer racing WebKit's smooth scroll. The
  // modal still opens over a genuinely scrolled document for the print check.
  await page.locator(".discovery-record [data-artifact]").first().focus(); await page.keyboard.press("Enter");
  await page.waitForSelector("#artifact-dialog[open]");
  await page.evaluate(()=>dispatchEvent(new Event("beforeprint")));
  assert.match(await page.locator("#shortlist-print").textContent(),/Close any open document/);
  await page.emulateMedia({media:"print"});
  const geometry=await page.evaluate(()=>({position:getComputedStyle(document.body).position,top:getComputedStyle(document.body).top,y:document.querySelector("#shortlist-print").getBoundingClientRect().y}));
  assert.equal(geometry.position,"static"); assert.equal(geometry.top,"auto"); assert.ok(geometry.y>=0 && geometry.y<100);
  assert.equal(await page.locator("dialog:visible, #app-shell:visible").count(),0);
  await page.emulateMedia({media:null});
  if(browserName === "chromium" && process.env.WEBSEC_SHORTLIST_CAPTURE === "1") {
    const fallback=await page.pdf({format:"A4",preferCSSPageSize:true});
    console.log("SHORTLIST_ARTIFACT "+JSON.stringify({name:"shortlist-dialog-guidance.pdf",type:"pdf",bytes:fallback.length,data:fallback.toString("base64")}));
  }
  await page.keyboard.press("Escape"); await page.waitForFunction(()=>!document.querySelector("#artifact-dialog").open);
  await page.waitForURL(deskUrl);
  assert.equal(page.url(),deskUrl);
  console.log("Shortlist: actual Markdown/CSV downloads cover all matching pages, source-credit failure/retry, saved two-record selection, print snapshots and modal/history focus pass");
  await context.close();

  // A slow metadata request cannot open a print dialog/download after the user
  // changes selection or leaves Desk, even when they later return to that view.
  for (const change of ["filter","navigate"]) {
    const delayedContext=await browser.newContext();
    let releaseMetadata; const metadataHeld=new Promise(resolve=>{releaseMetadata=resolve;});
    await delayedContext.route("**/data/sources/2024.json*",async route=>{await metadataHeld; await route.continue();});
    const delayed=await open(delayedContext,"?year=2024&standing=winner"); await ready(delayed);
    let delayedDownloads=0; delayed.on("download",()=>delayedDownloads++);
    await delayed.evaluate(()=>{window.print=()=>{window.stalePrint=true;};});
    await delayed.locator(action(change === "filter" ? "markdown" : "print")).click();
    await delayed.waitForFunction(()=>shortlistPreparing);
    if(change === "filter") {await delayed.locator("#desk-query").fill("changed-selection");}
    else {await delayed.evaluate(()=>setView("museum")); await delayed.evaluate(()=>setView("desk"));}
    releaseMetadata(); await delayed.waitForFunction(()=>!shortlistPreparing);
    assert.equal(delayedDownloads,0); assert.equal(await delayed.evaluate(()=>window.stalePrint),undefined);
    assert.match(await delayed.locator("#toast").innerText(),/preparation cancelled/);
    if(change === "filter") assert.equal(await delayed.evaluate(()=>document.activeElement.id),"desk-query","metadata completion does not steal focus from the newly edited filter");
    await delayedContext.close();
  }
  console.log("Shortlist: delayed metadata plus filter edits or view navigation cancels stale downloads/printing and retains editing focus");

  const partialContext=await browser.newContext();
  await partialContext.addInitScript(()=>Object.defineProperty(navigator,"connection",{value:{saveData:true},configurable:true}));
  let release; const held=new Promise(resolve=>{release=resolve;}); let fail=true;
  await partialContext.route("**/data/collections/2006.json*",async route=>{await held;await route.continue();});
  await partialContext.route("**/data/collections/2007.json*",route=>fail?route.fulfill({status:503,body:"Synthetic failure"}):route.continue());
  const partial=await open(partialContext);
  await partial.waitForSelector('[data-discovery-action="retry"]');
  for(const format of ["markdown","csv","print"]) assert.equal(await partial.locator(action(format)).isDisabled(),true);
  assert.match(await partial.locator("#desk-bibliography-note").innerText(),/unavailable until every selected collection loads/);
  release(); await partial.waitForFunction(()=>loadedCollections.has("2006"));
  assert.equal(await partial.locator(action("csv")).isDisabled(),true);
  await partial.evaluate(()=>dispatchEvent(new Event("beforeprint")));
  assert.equal(await partial.locator("#shortlist-print > ol").count(),0,"native printing does not silently emit partial records");
  fail=false; await partial.locator('[data-discovery-action="retry"]').click(); await ready(partial);
  assert.equal(await partial.locator(action("csv")).isEnabled(),true);
  await partial.locator("#desk-query").fill("no-record-matches-12345");
  assert.equal(await partial.locator(action("print")).isDisabled(),true);
  await partialContext.close();

  const mobileContext=await browser.newContext({viewport:{width:320,height:568},...(mobileEmulation?{isMobile:true,hasTouch:true}:{}),acceptDownloads:true});
  const mobile=await open(mobileContext,"?year=2006&standing=winner"); await ready(mobile);
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mobile.locator(action("markdown")).focus();
  const downloaded=mobile.waitForEvent("download"); await mobile.keyboard.press("Enter"); await downloaded;
  await mobile.waitForFunction(()=>!shortlistPreparing);
  assert.equal(await mobile.evaluate(()=>document.activeElement.dataset.discoveryValue),"markdown");
  await print(mobile,"shortlist-mobile");
  await mobileContext.close(); assert.deepEqual(errors,[]);
  console.log("Shortlist: delayed/failed relevant shards disable all actions; Retry enables complete exports, empty-set disabled, 320px keyboard/download/print-media focus pass");
  console.log("Shortlist browser test: PASS");
} finally {await browser.close();}
