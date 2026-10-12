/* First-party, dependency-free reading-state backup contracts. No source fetching. */
const SavedStateBackup = (() => {
  const FORMAT = "webhacklist-reading-state";
  const VERSION = 1;
  const MAX_BYTES = 1024 * 1024;
  const MAX_ITEMS = 5000;
  const MAX_IDENTITY = 2048;

  function normalizeIdentity(value) {
    if (typeof value !== "string" || !value.length || value.length > MAX_IDENTITY
      || /[\u0000-\u0020\u007f]/.test(value)) throw Error("Every identity must be an HTTP or HTTPS URL of at most 2,048 characters.");
    let url;
    try { url = new URL(value); } catch { throw Error("Every identity must be an HTTP or HTTPS URL."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Every identity must be an HTTP or HTTPS URL without credentials.");
    // Match the existing identityUrl/originalUrl key normalization exactly.
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/$/, "");
    const key = url.toString().replace(/\/$/, "");
    if (key.length > MAX_IDENTITY) throw Error("A normalized identity exceeds 2,048 characters.");
    return key;
  }

  function parse(text) {
    if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BYTES) throw Error("Choose a JSON file no larger than 1 MiB.");
    let data;
    try { data = JSON.parse(text); } catch { throw Error("The file is not valid JSON."); }
    if (!data || typeof data !== "object" || Array.isArray(data)
      || Object.keys(data).sort().join(",") !== "favourites,format,read,unfavourited,unread,version"
      || data.format !== FORMAT || data.version !== VERSION
      || ![data.read, data.favourites, data.unread, data.unfavourited].every(Array.isArray)) throw Error("This is not a supported WebHackList reading-state backup (version 1).");
    if (data.read.length + data.favourites.length + data.unread.length + data.unfavourited.length > MAX_ITEMS) throw Error("A backup can contain at most 5,000 marks or removals across all lists.");
    const read = new Set(data.read.map(normalizeIdentity));
    const favourites = new Set(data.favourites.map(normalizeIdentity));
    const unread = new Set(data.unread.map(normalizeIdentity));
    const unfavourited = new Set(data.unfavourited.map(normalizeIdentity));
    if ([...read].some(key => unread.has(key)) || [...favourites].some(key => unfavourited.has(key))) throw Error("A backup cannot both mark and remove the same identity in one list.");
    const identities = new Set([...read, ...favourites, ...unread, ...unfavourited]);
    const duplicates = data.read.length + data.favourites.length + data.unread.length + data.unfavourited.length - read.size - favourites.size - unread.size - unfavourited.size;
    return { read, favourites, unread, unfavourited, identities, duplicates };
  }

  function serialize(read, favourites, unread = [], unfavourited = []) {
    const data = {format: FORMAT, version: VERSION, read: [...read].sort(), favourites: [...favourites].sort(), unread: [...unread].sort(), unfavourited: [...unfavourited].sort()};
    // Validate our own output too: an invalid legacy identity is never silently
    // omitted from what is presented as a complete backup.
    const text = JSON.stringify(data, null, 2) + "\n";
    const checked = parse(text);
    const normalized = JSON.stringify({format: FORMAT, version: VERSION, read: [...checked.read].sort(), favourites: [...checked.favourites].sort(), unread: [...checked.unread].sort(), unfavourited: [...checked.unfavourited].sort()}, null, 2) + "\n";
    if (new TextEncoder().encode(normalized).length > MAX_BYTES) throw Error("The normalized backup exceeds 1 MiB.");
    return normalized;
  }

  function plan(backup, mode) {
    if (!["add", "restore"].includes(mode)) throw Error("Choose how to merge this backup first.");
    const writes = [];
    for (const identity of backup.identities) {
      for (const flag of ["read", "favourites"]) {
        const value = backup[flag].has(identity);
        const removal = backup[flag === "read" ? "unread" : "unfavourited"].has(identity);
        if (value || (mode === "restore" && removal)) writes.push({flag, identity, value});
      }
    }
    return writes;
  }
  return {FORMAT, VERSION, MAX_BYTES, MAX_ITEMS, MAX_IDENTITY, normalizeIdentity, parse, serialize, plan};
})();
