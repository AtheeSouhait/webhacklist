// Trusted first-party contracts with synthetic URLs/storage, no source parsing.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const sources = await Promise.all(["saved-state.js", "discovery.js", "app.js"].map(name => readFile(new URL(name, import.meta.url), "utf8")));
function fixture() {
  const storage = new Map(), denial = {read: false, write: () => false};
  const context = vm.createContext({URL, URLSearchParams, TextEncoder, console,
    CSS: {escape: value => value}, location: {href:"https://example.test/#favourites",hash:"#favourites",search:""},
    document: {querySelector: () => ({hidden:true,textContent:""}), querySelectorAll: () => []},
    localStorage: {
      get length() { if (denial.read) throw Error("read denied"); return storage.size; },
      key: index => [...storage.keys()][index] ?? null,
      getItem: key => { if (denial.read) throw Error("read denied"); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (denial.write(key)) throw Error("write denied"); storage.set(key, value); }
    }, setTimeout: () => 1, clearTimeout() {}});
  for (const source of sources) vm.runInContext(source.replace(/\nloadArchive\(\);\s*$/, "\n"), context);
  const run = code => vm.runInContext(code, context);
  const backup = run("SavedStateBackup");
  const json = fields => JSON.stringify({format:backup.FORMAT,version:1,read:[],favourites:[],unread:[],unfavourited:[],...fields});
  const merge = (fields, mode) => { context.__backup = backup.parse(json(fields)); context.__mode = mode; return run("mergeSavedBackup(__backup, __mode)"); };
  return {storage, denial, run, backup, json, merge};
}
const read = "technique-vault-read-v1", fav = "websec-favourites-v1";
const record = (list, url) => `${list}:item:${url}`;
const a = "https://example.test/a", b = "https://example.test/b", c = "https://example.test/c";

test("versioned strict schema, UTF-8 bytes, item/identity bounds and HTTP-only inert identities", () => {
  const {backup, json} = fixture();
  assert.throws(() => backup.parse("{"), /valid JSON/);
  for (const fields of [{version:2},{extra:"unexpected"},{read:{}},{format:"other"},{read:[null]},{read:[a],unread:[a]}]) assert.throws(() => backup.parse(json(fields)));
  for (const identity of ["javascript:alert(1)","file:///secret","data:text/plain,hi","//example.test", "https://u:p@example.test/a", " https://example.test/a", "https://example.test/\n", "x".repeat(2049)]) assert.throws(() => backup.parse(json({read:[identity]})));
  const exact = "https://example.test/" + "a".repeat(2048-21);
  assert.equal(exact.length,2048);
  assert.equal(backup.parse(json({read:[exact]})).read.size,1);
  assert.throws(() => backup.parse(json({read:[exact+"x"]})),/2,048/);
  assert.equal(backup.parse(json({read:Array(5000).fill(a)})).duplicates,4999);
  assert.throws(() => backup.parse(json({read:Array(5001).fill(a)})),/5,000/);
  const valid = json({});
  assert.equal(backup.parse(valid+" ".repeat(backup.MAX_BYTES-Buffer.byteLength(valid))).identities.size,0);
  assert.throws(() => backup.parse(valid+" ".repeat(backup.MAX_BYTES-Buffer.byteLength(valid)+1)),/1 MiB/);
  assert.throws(() => backup.parse('"'+"é".repeat(backup.MAX_BYTES/2)+'"'),/1 MiB/);
  assert.throws(() => backup.plan(backup.parse(json({read:[a]})),"replace"),/Choose/);
});

test("normalization retains existing URL identities and combines duplicate marks/removals", () => {
  const {backup, json, run} = fixture();
  for (const identity of ["https://EXAMPLE.test/a/#fragment","http://example.test/","https://example.test/a?q=1#two","https://example.test/é"]) {
    assert.equal(backup.normalizeIdentity(identity),run(`normalizeUrl(${JSON.stringify(identity)})`));
  }
  const parsed = backup.parse(json({read:[a,a+"/#hash"],unfavourited:[b,b+"/"]}));
  assert.equal(parsed.identities.size,2);
  assert.equal(parsed.duplicates,2);
  assert.throws(() => backup.parse(json({read:[a],unread:[a+"/#fragment"]})),/both mark and remove/);
});

test("complete fresh-profile roundtrip includes legacy marks, false tombstones and session removals", () => {
  const old = fixture();
  old.storage.set(read,JSON.stringify([a,b])); old.storage.set(fav,JSON.stringify([a,c]));
  old.storage.set(record(read,b),"false");
  old.run("synchronizeReadingState()");
  old.denial.write = () => true;
  old.run(`state.favouriteKeys.delete(${JSON.stringify(c)}); persistReadingState(FAVOURITE_STORAGE_KEY,${JSON.stringify(c)},false)`);
  const text = old.run("savedBackupText()");
  const restored = fixture();
  const data = JSON.parse(text);
  const result = restored.merge(data,"restore");
  assert.equal(result.pending,0);
  assert.deepEqual([...JSON.parse(restored.run("savedBackupText()")).read],[a]);
  assert.equal(restored.storage.get(record(read,b)),"false");
  assert.equal(restored.storage.get(record(fav,c)),"false");
  assert.equal(old.storage.get(read),JSON.stringify([a,b]),"legacy arrays never overwritten");
});

test("add keeps local removals and pending edits; apply overrides only explicit matching flags", () => {
  const f = fixture();
  f.storage.set(record(read,a),"false");
  f.denial.write = () => true;
  f.run(`persistReadingState(FAVOURITE_STORAGE_KEY,${JSON.stringify(b)},false); persistReadingState(READ_STORAGE_KEY,${JSON.stringify(c)},true)`);
  f.denial.write = () => false;
  const add = f.merge({read:[a],favourites:[b],unread:[c]},"add");
  assert.equal(add.kept,2);
  assert.equal(f.run(`state.readKeys.has(${JSON.stringify(a)})`),false);
  assert.equal(f.run(`state.readKeys.has(${JSON.stringify(c)})`),true);
  assert.equal(f.run("pendingReadingWrites.size"),2,"kept pending edits are not discarded");
  f.merge({favourites:[b]},"restore");
  assert.equal(f.storage.get(record(fav,b)),"true");
  assert.equal(f.run("pendingReadingWrites.size"),1,"unrelated pending read remains");
  assert.equal(f.run(`state.readKeys.has(${JSON.stringify(c)})`),true);
});

test("confirmation uses latest storage and preserves unrelated concurrent changes and removals", () => {
  const f = fixture();
  f.storage.set(read,JSON.stringify([b]));
  const preview = f.backup.parse(f.json({read:[a]}));
  f.storage.set(record(read,b),"false"); f.storage.set(record(fav,c),"true");
  f.merge(previewToFields(preview),"restore");
  assert.equal(f.storage.get(record(read,b)),"false");
  assert.equal(f.storage.get(record(fav,c)),"true");
  assert.equal(f.run(`state.readKeys.has(${JSON.stringify(b)})`),false);
});
function previewToFields(p) { return {read:[...p.read],favourites:[...p.favourites],unread:[...p.unread],unfavourited:[...p.unfavourited]}; }

test("partial denied writes remain pending, export includes them, subsequent refresh/retry preserves edits", () => {
  const f = fixture();
  f.denial.write = key => key === record(fav,b);
  const result = f.merge({read:[a],favourites:[b]},"restore");
  assert.equal(result.pending,1);
  assert.equal(f.storage.get(record(read,a)),"true");
  assert.equal(f.storage.has(record(fav,b)),false);
  assert.deepEqual(JSON.parse(f.run("savedBackupText()")).favourites,[b]);
  f.storage.set(record(read,c),"true");
  f.run("synchronizeReadingState()");
  assert.equal(f.run(`state.favouriteKeys.has(${JSON.stringify(b)})`),true);
  f.denial.write = () => false;
  f.run(`persistReadingState(FAVOURITE_STORAGE_KEY,${JSON.stringify(a)},true)`);
  assert.equal(f.storage.get(record(fav,b)),"true");
  assert.equal(f.run("pendingReadingWrites.size"),0);
});

test("denied storage reads keep session state and block partial backup/import before writes", () => {
  const empty = fixture();
  empty.denial.read = true;
  assert.throws(() => empty.merge({read:[a]},"restore"),/read denied/);
  assert.equal(empty.storage.size,0,"an unreadable empty store is probed before writes");
  const f = fixture();
  f.merge({read:[a]},"restore");
  f.denial.read = true;
  f.run("synchronizeReadingState()");
  assert.equal(f.run(`state.readKeys.has(${JSON.stringify(a)})`),true);
  assert.throws(() => f.run("savedBackupText()"),/read denied/);
  assert.throws(() => f.merge({favourites:[b]},"restore"),/read denied/);
  assert.equal(f.storage.size,1);
  f.run(`state.readKeys.add(${JSON.stringify(c)}); persistReadingState(READ_STORAGE_KEY,${JSON.stringify(c)},true)`);
  assert.equal(f.run(`state.readKeys.has(${JSON.stringify(c)})`),true,"write success with denied reads retains local edit");
});
