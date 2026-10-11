import { createHash } from "node:crypto";

// Keys are normalized original citation URLs. Keep old keys forever; when a
// citation URL changes, give its new key the same registered ID before building.
export function storyIdentityKey(registry, year, identity, title) {
  const choices = registry.disambiguators?.[year]?.[identity];
  if (!choices) return identity;
  if (!Object.hasOwn(choices, title) || typeof choices[title] !== "string" || !/^[a-z0-9-]+$/.test(choices[title])) throw new Error(`Shared citation in ${year} needs an explicit story disambiguator: ${identity}`);
  return `${identity}\n${choices[title]}`;
}

export function registerStoryIdentity(registry, year, identity, { checkOnly = false, title = "" } = {}) {
  identity = storyIdentityKey(registry, year, identity, title);
  const entries = registry.collections[year] ||= {};
  if (Object.hasOwn(entries, identity)) return entries[identity];
  if (checkOnly) throw new Error(`Unregistered story in ${year}; run build-data.mjs and commit story-identities.json`);
  const digest = createHash("sha256").update(`${year}\n${identity}`).digest("hex").slice(0, 24);
  return entries[identity] = `${year}-r-${digest}`;
}
