// Actual UI/download/file import under the approved isolated browser harness.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {launchBrowser, mobileEmulation} from "./browser-test.mjs";
const browser = await launchBrowser();
const base = process.env.WEBSEC_TEST_URL || "http://127.0.0.1:4173/";
const axe = await readFile(process.env.AXE_SOURCE,"utf8");
const errors = [];
let checks = 0;
const readKey = "technique-vault-read-v1", favKey = "websec-favourites-v1";
const backup = fields => JSON.stringify({format:"webhacklist-reading-state",version:1,read:[],favourites:[],unread:[],unfavourited:[],...fields});
async function ready(page) {
  await page.waitForFunction(() => state.view === "favourites" && loadedCollections.size === YEAR_FILES.length && !document.querySelector("#boot-screen") && !restoringRoute);
  await page.locator("[data-saved-backup]").waitFor();
}
async function open(page) {
  await page.locator("[data-saved-backup]").focus();
  await page.keyboard.press("Enter");
  await page.locator("#saved-backup-dialog[open]").waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("aria-label")),"Close saved-state backup");
}
async function upload(page, text) {
  await page.locator("#saved-backup-file").setInputFiles({name:"backup.json",mimeType:"application/json",buffer:Buffer.from(text)});
  await page.waitForFunction(()=>!document.querySelector("#saved-backup-status").textContent.includes("Reading backup"));
}
async function apply(page, mode) {
  await page.locator(`[name="saved-backup-mode"][value="${mode}"]`).focus();
  await page.keyboard.press("Space");
  await page.locator("#saved-backup-apply").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(()=>document.querySelector("#saved-backup-status").textContent.startsWith("Import applied"));
  assert.equal(await page.evaluate(()=>document.activeElement.id),"saved-backup-status");
  assert.ok(await page.locator("#saved-backup-status").evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),"Result focus remains visible");
}
async function marks(page) {
  return page.evaluate(()=>({read:[...state.readKeys].sort(),favourites:[...state.favouriteKeys].sort(),pending:pendingReadingWrites.size}));
}
async function download(page) {
  const promised = page.waitForEvent("download");
  await page.locator("#saved-backup-export").click();
  const item = await promised;
  assert.equal(item.suggestedFilename(),"webhacklist-reading-state-v1.json");
  assert.equal(await item.failure(),null);
  const stream = await item.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  assert.ok(bytes.length <= 1024*1024);
  return bytes.toString("utf8");
}
async function audit(page, width) {
  await page.evaluate(axe);
  const results = await page.evaluate(()=>axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa","wcag22aa"]}}));
  assert.deepEqual(results.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],`Backup accessibility at ${width}px`);
  const geometry = await page.locator("#saved-backup-dialog").evaluate(dialog=>({scroll:dialog.scrollWidth,width:dialog.clientWidth,rect:dialog.getBoundingClientRect().toJSON(),viewport:innerWidth}));
  assert.ok(geometry.scroll <= geometry.width+1 && geometry.rect.left>=0 && geometry.rect.right<=geometry.viewport+1,JSON.stringify(geometry));
  checks++;
}
try {
  for (const width of [1440,320]) {
    const settings = {viewport:{width,height:width===320?568:1000},isMobile:width===320&&mobileEmulation,hasTouch:width===320,reducedMotion:"reduce",acceptDownloads:true};
    const source = await browser.newContext(settings);
    const page = await source.newPage(); page.on("pageerror",error=>errors.push(error.message));
    await page.goto(base+"#saved"); await ready(page);
    const records = await page.evaluate(()=>{
      const unique = [...new Map(state.items.map(item=>[item.readKey,item])).values()];
      const grouped = unique.find(item=>item.identityUrl && normalizeUrl(item.identityUrl)!==normalizeUrl(item.originalUrl));
      return [grouped||unique[0],...unique.filter(item=>item!==grouped&&item!==unique[0]).slice(0,2)].map(item=>({id:item.id,key:item.readKey}));
    });
    assert.equal(records.length,3);
    const [a,b,c] = records;
    await page.evaluate(({readKey,favKey,a,b,c})=>{
      localStorage.setItem(readKey,JSON.stringify([a.key,b.key]));
      localStorage.setItem(favKey,JSON.stringify([a.key,c.key]));
      synchronizeReadingState(); render();
    },{readKey,favKey,a,b,c});
    await page.evaluate(id=>openArtifact(id),b.id);
    await page.locator("#artifact-read-toggle").click();
    await page.locator("#artifact-dialog .dialog-close").click();
    await page.waitForFunction(()=>location.hash==="#saved"&&!documentDismissal&&!restoringRoute&&!document.querySelector("dialog[open]")&&!document.body.classList.contains("document-dialog-open"));
    await page.evaluate(id=>openArtifact(id),c.id);
    await page.locator("#artifact-favourite-toggle").click();
    await page.locator("#artifact-dialog .dialog-close").click();
    await page.waitForFunction(()=>location.hash==="#saved"&&!documentDismissal&&!restoringRoute&&!document.querySelector("dialog[open]")&&!document.body.classList.contains("document-dialog-open"));
    const originalRoute=page.url();
    await open(page);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(()=>document.activeElement.id),"saved-backup-export",`First content action follows close at ${width}px`);
    const text = await download(page), data=JSON.parse(text);
    assert.deepEqual(data.read,[a.key]); assert.deepEqual(data.favourites,[a.key]);
    assert.deepEqual(data.unread,[b.key]); assert.deepEqual(data.unfavourited,[c.key]);
    await audit(page,width);
    await page.keyboard.press("Escape");
    await page.waitForFunction(()=>!document.body.classList.contains("document-dialog-open"));
    assert.ok(await page.locator("[data-saved-backup]").evaluate(el=>el===document.activeElement));
    assert.equal(page.url(),originalRoute,"Utility dialog does not add a document route");

    const fresh = await browser.newContext(settings), target = await fresh.newPage();
    target.on("pageerror",error=>errors.push(error.message));
    await target.goto(base+"#saved"); await ready(target);
    assert.deepEqual(await marks(target),{read:[],favourites:[],pending:0});
    await open(target);
    const requests=[]; target.on("request",request=>requests.push(request.url()));
    await upload(target,text);
    assert.ok(await target.locator("#saved-backup-preview").isVisible());
    assert.ok(await target.locator("#saved-backup-apply").isDisabled(),"Explicit merge choice required");
    assert.match(await target.locator("#saved-backup-summary").textContent(),/3 identities: 1 read, 1 favourites, 1 unread removals, 1 favourite removals/);
    assert.equal(await target.locator("#saved-backup-identities a, #saved-backup-identities img, #saved-backup-identities svg").count(),0);
    await audit(target,width);
    await apply(target,"restore");
    assert.match(await target.locator("#saved-backup-status").textContent(),/All applied values were written/);
    assert.deepEqual(await marks(target),{read:[a.key],favourites:[a.key],pending:0});
    assert.deepEqual(JSON.parse(await download(target)),data,"Fresh profile download matches original including tombstones");
    assert.deepEqual(requests,[],"Preview/import/export send no requests or uploads");
    await target.keyboard.press("Escape");
    await target.waitForFunction(()=>!document.body.classList.contains("document-dialog-open"));
    assert.ok(await target.locator("[data-saved-backup]").evaluate(el=>el===document.activeElement),"Opener restored after import rerender");
    await target.reload(); await ready(target);
    assert.deepEqual(await marks(target),{read:[a.key],favourites:[a.key],pending:0});
    await open(target);

    const before = await marks(target);
    for (const invalid of ["{",backup({version:9}),backup({read:["javascript:alert(1)"]}),backup({extra:true}),backup({read:[a.key],unread:[a.key]}),backup({read:Array(5001).fill(a.key)})," ".repeat(1024*1024+1)]) {
      await upload(target,invalid);
      assert.match(await target.locator("#saved-backup-status").textContent(),/could not be read/);
      assert.ok(await target.locator("#saved-backup-apply").isDisabled());
      assert.deepEqual(await marks(target),before);
    }
    await upload(target,backup({}));
    assert.match(await target.locator("#saved-backup-status").textContent(),/empty/);
    assert.ok(await target.locator("#saved-backup-apply").isDisabled());
    await upload(target,backup({read:[b.key,b.key+"/#duplicate"],favourites:["https://example.test/?x=<svg/onload=alert(1)>"]}));
    assert.match(await target.locator("#saved-backup-summary").textContent(),/1 duplicate entries combined/);
    assert.equal(await target.locator("#saved-backup-identities svg, #saved-backup-identities a").count(),0);
    await target.locator("#saved-backup-cancel").click();
    assert.equal(await target.evaluate(()=>document.activeElement.id),"saved-backup-file");
    assert.deepEqual(await marks(target),before);
    // File picker cancellation and denied File.text leave no stale preview.
    await target.locator("#saved-backup-file").dispatchEvent("cancel");
    assert.match(await target.locator("#saved-backup-status").textContent(),/selection cancelled/);
    await target.evaluate(()=>{globalThis.realFileText=File.prototype.text;File.prototype.text=()=>Promise.reject(Error("file permission denied"));});
    await upload(target,text);
    assert.match(await target.locator("#saved-backup-status").textContent(),/file permission denied/);
    await target.evaluate(()=>{File.prototype.text=realFileText;});
    // A closed/cancelled or replaced async read must never revive its preview.
    await target.evaluate(()=>{File.prototype.text=function(){return new Promise(resolve=>{globalThis.releaseFileRead=()=>resolve(realFileText.call(this));});};});
    await target.locator("#saved-backup-file").setInputFiles({name:"delayed.json",mimeType:"application/json",buffer:Buffer.from(text)});
    await target.waitForFunction(()=>typeof releaseFileRead==="function");
    await target.locator("#saved-backup-cancel").click();
    await target.evaluate(()=>releaseFileRead());
    await target.evaluate(()=>new Promise(resolve=>setTimeout(resolve,50)));
    assert.ok(await target.locator("#saved-backup-preview").isHidden());
    assert.ok(await target.locator("#saved-backup-apply").isDisabled());
    await target.evaluate(()=>{globalThis.firstRead=true;File.prototype.text=function(){if(firstRead){firstRead=false;return new Promise(resolve=>{globalThis.releaseFileRead=()=>resolve(realFileText.call(this));});}return realFileText.call(this);};});
    await target.locator("#saved-backup-file").setInputFiles({name:"old.json",mimeType:"application/json",buffer:Buffer.from(text)});
    await target.waitForFunction(()=>!firstRead);
    await upload(target,backup({read:["https://example.test/replacement"]}));
    await target.evaluate(()=>releaseFileRead());
    await target.evaluate(()=>new Promise(resolve=>setTimeout(resolve,50)));
    assert.equal(await target.locator("#saved-backup-identities li").textContent(),"https://example.test/replacement");
    await target.locator("#saved-backup-cancel").click();
    await target.evaluate(()=>{File.prototype.text=realFileText;});

    // A second real tab changes the imported record after preview, and also an
    // unrelated flag/removal. Add keeps local tombstones; apply restores only
    // explicit flags. Legacy arrays remain untouched.
    const other = await fresh.newPage(); await other.goto(base+"#saved"); await ready(other);
    await upload(target,backup({read:[b.key],favourites:[b.key]}));
    await other.evaluate(({readKey,favKey,a,b,c})=>{
      localStorage.setItem(`${readKey}:item:${b.key}`,"false");
      localStorage.setItem(`${readKey}:item:${a.key}`,"false");
      localStorage.setItem(`${favKey}:item:${c.key}`,"true");
    },{readKey,favKey,a,b,c});
    await target.waitForFunction(c=>state.favouriteKeys.has(c),c.key);
    assert.ok(await target.locator("#saved-backup-preview").isVisible(),"Cross-tab redraw retains preview");
    await apply(target,"add");
    assert.match(await target.locator("#saved-backup-status").textContent(),/1 local removals or pending edits kept/);
    let current=await marks(target);
    assert.equal(current.read.includes(b.key),false); assert.ok(current.favourites.includes(b.key)&&current.favourites.includes(c.key));
    assert.equal(current.read.includes(a.key),false);
    await upload(target,backup({read:[b.key],unfavourited:[b.key]}));
    await apply(target,"restore");
    current=await marks(target);
    assert.ok(current.read.includes(b.key)); assert.equal(current.favourites.includes(b.key),false); assert.ok(current.favourites.includes(c.key));

    // Selective quota failure creates a partial import. Its notice stays honest,
    // its session mark survives a cross-tab update, and it remains exportable.
    await target.evaluate(({favKey,b})=>{
      globalThis.realSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key===`${favKey}:item:${b.key}`) throw new DOMException("quota denied","QuotaExceededError");return realSetItem.call(this,key,value);};
    },{favKey,b});
    await upload(target,backup({read:[a.key],favourites:[b.key]})); await apply(target,"restore");
    assert.match(await target.locator("#saved-backup-status").textContent(),/1 changes remain session only/);
    assert.doesNotMatch(await target.locator("#saved-backup-status").textContent(),/All applied values were written/);
    assert.equal((await marks(target)).pending,1);
    await other.evaluate(({readKey,c})=>localStorage.setItem(`${readKey}:item:${c.key}`,"true"),{readKey,c});
    await target.waitForFunction(c=>state.readKeys.has(c),c.key);
    assert.ok((await marks(target)).favourites.includes(b.key));
    assert.ok(JSON.parse(await download(target)).favourites.includes(b.key));
    await upload(target,backup({read:[b.key]})); await apply(target,"add");
    assert.equal((await marks(target)).pending,1,"Unrelated pending favourite survives another import");
    await target.evaluate(()=>{Storage.prototype.setItem=realSetItem;});
    await upload(target,backup({favourites:[a.key]})); await apply(target,"restore");
    assert.equal((await marks(target)).pending,0,"Next affected-list edit retries pending writes");

    // Denied storage reads preserve the current session but cannot produce a
    // claimed complete backup or apply an import from an incomplete snapshot.
    const beforeReadDenial=await marks(target);
    await target.evaluate(()=>{globalThis.realGetItem=Storage.prototype.getItem;Storage.prototype.getItem=()=>{throw new DOMException("storage read denied","SecurityError");};});
    await target.locator("#saved-backup-export").click();
    assert.match(await target.locator("#saved-backup-status").textContent(),/could not be downloaded/);
    await upload(target,backup({read:["https://example.test/new"]}));
    await target.locator('[name="saved-backup-mode"][value="restore"]').check();
    await target.locator("#saved-backup-apply").click();
    assert.match(await target.locator("#saved-backup-status").textContent(),/could not be applied/);
    assert.deepEqual(await marks(target),beforeReadDenial);
    await target.evaluate(()=>{Storage.prototype.getItem=realGetItem;});
    // Back closes the utility without creating a separate archive visit;
    // Forward returns to Saved with no stale import preview.
    await target.evaluate(()=>setView("desk")); await target.locator("#desk-query").waitFor();
    assert.equal(await target.locator("#saved-backup-dialog").evaluate(el=>el.open),false);
    await target.evaluate(()=>setView("favourites")); await ready(target); await open(target);
    await target.goBack();
    await target.waitForFunction(()=>!document.querySelector("#saved-backup-dialog").open);
    await target.goForward(); await ready(target);
    assert.equal(await target.locator("#saved-backup-dialog").evaluate(el=>el.open),false);
    checks+=15;
    await source.close(); await fresh.close();
  }
  assert.deepEqual(errors,[],"No browser exceptions");
  console.log(`Saved portability: ${checks} grouped desktop/mobile UI, fresh-profile download/import, validation, denial and concurrency checks passed`);
} finally { await browser.close(); }
