/* Two accessible entrances to the same archive. Loaded before app.js. */
const DISCOVERY_VIEWS = {
  desk: { kicker: "Workspace 08 / find and read", title: "Research Desk", description: "Search the archive, save papers and track your reading." },
  time: { kicker: "Journey 04 / the archive through time", title: "Time Machine", description: "Explore annual collections and follow a subject through the years." },
};
function isDiscoveryView(view = state.view) { return Object.hasOwn(DISCOVERY_VIEWS, view); }
function storedDiscoveryTheme() {
  try { return localStorage.getItem("websec-discovery-theme-v1") === "light" ? "light" : "dark"; } catch { return "dark"; }
}
const discoveryState = {
  theme: storedDiscoveryTheme(), busy: false, error: "",
  deskQuery: "", deskAuthor: "", deskYear: "all", deskTopic: "all", deskStanding: "all", deskRead: "all", deskSort: "newest", deskVideo: "all", deskCompact: false, deskPage: 1,
  timeTopic: "all", timeOrder: "oldest", timeYear: "all", timeExpanded: new Set()
};
function discoveryAppearance() {
  return `<div class="discovery-appearance" role="group" aria-label="Page appearance"><span>Appearance</span>${["light", "dark"].map((mode) => `<button type="button" data-discovery-action="theme" data-discovery-value="${mode}" aria-pressed="${discoveryState.theme === mode}">${mode === "light" ? "Light" : "Dark"}</button>`).join("")}</div>`;
}
function updateDiscoveryAppearance() {
  const root = document.documentElement;
  if (isDiscoveryView()) root.dataset.discoveryTheme = discoveryState.theme;
  else delete root.dataset.discoveryTheme;
  const themeColor = $('meta[name="theme-color"]');
  if (themeColor) themeColor.content = getComputedStyle(root).getPropertyValue("--paper").trim();
}
function discoverySelect(id, label, value, options) {
  return `<label class="discovery-field" for="${id}"><span>${label}</span><select id="${id}">${options.map(([key, title]) => `<option value="${h(key)}" ${key === value ? "selected" : ""}>${h(title)}</option>`).join("")}</select></label>`;
}
function discoveryYears() { return [["all", "Every collection"], ...newestFirstYearRecords().map((record) => [record.id, yearLabel(record.id)])]; }
function discoveryTopics() { return [["all", "Every subject"], ...TOPICS.map((topic) => [topic.name, topic.name])]; }
function discoveryStatus(item) { return itemStandingLabel(item); }
function discoveryRecord(item, mode = "card") {
  return `<article class="discovery-record ${mode === "row" ? "discovery-row" : ""}" data-discovery-record="${h(item.id)}">
    <div class="discovery-record-copy"><p class="discovery-meta"><span>${h(item.yearLabel || item.year)}</span><span>${h(item.topic)}</span><span>${h(discoveryStatus(item))}</span>${item.videos?.length ? `<span class="discovery-video">${videoMark(item)}${item.videos.some((video) => video.confidence === "confirmed") ? "Video available" : "Possible video"}</span>` : ""}</p>
    <h3><button type="button" data-artifact="${h(item.id)}" aria-label="${h(`Open ${item.title}${videoLabel(item)}`)}">${h(item.title)}</button></h3><p class="discovery-credit">${h(creditOf(item) || "Author not stated")}</p>
    ${item.summary ? `<p class="discovery-summary">${h(short(item.summary, 240))}</p>` : ""}</div>
    <div class="discovery-record-actions"><button type="button" data-discovery-action="read" data-discovery-value="${h(item.id)}">${item.mdPath ? "Read article" : "Open record"}</button><button type="button" data-artifact="${h(item.id)}">Sources &amp; details (${item.sourceCount || item.links.length})</button><button type="button" data-favourite="${h(item.id)}" aria-pressed="${item.favourite}" aria-label="${h(`${item.favourite ? "Remove saved" : "Save"}: ${item.title}`)}">${item.favourite ? "★ Saved" : "☆ Save"}</button><button type="button" data-discovery-action="mark" data-discovery-value="${h(item.id)}" aria-pressed="${item.read}" aria-label="${h(`Mark ${item.read ? "unread" : "read"}: ${item.title}`)}">${item.read ? "✓ Read" : "Mark read"}</button></div>
  </article>`;
}
function discoveryEmpty(message) { return `<p class="discovery-empty" role="status">${h(message)}</p>`; }
function discoverySorted(items, order = "newest") {
  return [...items].sort((a, b) => {
    if (order === "title") return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    if (order === "rank") return byRankThenTitle(a, b) || a.id.localeCompare(b.id);
    const years = compareCollectionsNewestFirst(yearRecordFor(a.year), yearRecordFor(b.year));
    return (order === "oldest" ? -years : years) || byRankThenTitle(a, b) || a.id.localeCompare(b.id);
  });
}

function loadDiscoveryCollections() {
  if (discoveryState.busy) return;
  discoveryState.busy = true;
  ensureAllCollections().then(() => { discoveryState.error = ""; }).catch((error) => {
    discoveryState.error = `Some collections could not be loaded. ${error.message}`;
  }).finally(() => {
    discoveryState.busy = false;
    if (isDiscoveryView()) render();
  });
}
function renderDiscovery() {
  if (loadedCollections.size !== YEAR_FILES.length) {
    $("#view-root").innerHTML = `<section class="discovery-view"><div class="discovery-empty" role="status">${discoveryState.error ? `<p>${h(discoveryState.error)}</p><button type="button" data-discovery-action="retry">Try again</button>` : "Opening all collections…"}</div></section>`;
    if (!discoveryState.error) loadDiscoveryCollections();
    return;
  }
  ({ desk: renderResearchDesk, time: renderTimeMachine })[state.view]();
}
function deskFilteredRecords() {
  return discoverySorted(queryItems(state.items, discoveryState.deskQuery).filter((item) =>
    (discoveryState.deskYear === "all" || item.year === discoveryState.deskYear)
    && (discoveryState.deskTopic === "all" || item.topic === discoveryState.deskTopic)
    && (!discoveryState.deskAuthor || (item.authors || []).join(" ").toLowerCase().includes(discoveryState.deskAuthor.toLowerCase()))
    && (discoveryState.deskVideo === "all" || (discoveryState.deskVideo === "with" ? Boolean(item.videos?.length) : !item.videos?.length))
    && (discoveryState.deskRead === "all" || item.read === (discoveryState.deskRead === "read"))
    && (discoveryState.deskStanding === "all" || itemStanding(item) === discoveryState.deskStanding)
  ), discoveryState.deskSort);
}
function deskResults() {
  const items = deskFilteredRecords(), pageSize = 20, pages = Math.max(1, Math.ceil(items.length / pageSize));
  discoveryState.deskPage = Math.max(1, Math.min(discoveryState.deskPage, pages));
  const start = (discoveryState.deskPage - 1) * pageSize;
  return `<div class="desk-result-heading"><p id="desk-result-count" role="status" tabindex="-1">${items.length.toLocaleString()} results${items.length ? ` · showing ${start + 1}–${Math.min(start + pageSize, items.length)}` : ""}</p><span>Collection years, newest first by default</span></div>
    <div class="desk-records ${discoveryState.deskCompact ? "is-compact" : ""}">${items.length ? items.slice(start, start + pageSize).map((item) => discoveryRecord(item, "row")).join("") : discoveryEmpty("No records match these filters. Try another subject or reset the filters.")}</div>
    <nav class="discovery-pagination" aria-label="Research results pages"><button type="button" data-discovery-action="desk-prev" ${discoveryState.deskPage === 1 ? "disabled" : ""}>← Previous</button><span>Page ${discoveryState.deskPage} of ${pages}</span><button type="button" data-discovery-action="desk-next" ${discoveryState.deskPage === pages ? "disabled" : ""}>Next →</button></nav>`;
}
function renderResearchDesk() {
  setMetric(state.items.length, "research records to explore");
  $("#view-root").innerHTML = `<section class="discovery-view research-desk">
    <form id="desk-filter-form" class="desk-filters" role="search" aria-label="Filter the Research Desk">
      <label class="discovery-field desk-query"><span>Search the archive</span><input id="desk-query" type="search" value="${h(discoveryState.deskQuery)}" placeholder="Title, subject, publisher, or a phrase…" autocomplete="off"></label>
      <label class="discovery-field"><span>Author name</span><input id="desk-author" type="search" value="${h(discoveryState.deskAuthor)}" placeholder="Any author" autocomplete="off"></label>
      ${discoverySelect("desk-year", "Collection", discoveryState.deskYear, discoveryYears())}${discoverySelect("desk-topic", "Subject", discoveryState.deskTopic, discoveryTopics())}
      ${discoverySelect("desk-standing", "Selection", discoveryState.deskStanding, [["all", "All research"], ["winner", "Top 10"], ["nominee", "Nominations"], ["addition", "Later additions"], ["held", "Held out of vote"], ["preliminary", "Preliminary"]])}
      ${discoverySelect("desk-read", "Reading status", discoveryState.deskRead, [["all", "Read and unread"], ["unread", "Unread"], ["read", "Read"]])}
      ${discoverySelect("desk-sort", "Sort by", discoveryState.deskSort, [["newest", "Newest collection"], ["oldest", "Oldest collection"], ["title", "Title A–Z"], ["rank", "Rank, then title"]])}
      ${discoverySelect("desk-video", "Video", discoveryState.deskVideo, [["all", "All research"], ["with", "With video links"], ["without", "No video links"]])}
      <div class="desk-filter-actions"><button type="button" data-discovery-action="desk-compact" aria-pressed="${discoveryState.deskCompact}">Compact rows</button><button type="button" data-discovery-action="desk-reset">Reset filters</button></div>
    </form><div id="desk-results">${deskResults()}</div></section>`;
  $("#desk-filter-form").addEventListener("submit", (event) => event.preventDefault());
}
function renderTimeMachine() {
  const items = state.items.filter((item) => discoveryState.timeTopic === "all" || item.topic === discoveryState.timeTopic);
  const records = [...newestFirstYearRecords()];
  if (discoveryState.timeOrder === "oldest") records.reverse();
  const chronological = discoverySorted(items.filter((item) => !item.preliminary), "oldest");
  const first = chronological[0], lastYear = chronological.at(-1)?.year;
  const last = discoverySorted(chronological.filter((item) => item.year === lastYear))[0];
  setMetric(items.length, "records across the years");
  $("#view-root").innerHTML = `<section class="discovery-view time-machine">
    <div class="discovery-toolbar">${discoverySelect("time-topic", "Follow a subject", discoveryState.timeTopic, discoveryTopics())}${discoverySelect("time-order", "Travel direction", discoveryState.timeOrder, [["oldest", "Earlier to later"], ["newest", "Later to earlier"]])}${discoverySelect("time-jump", "Jump to a collection", discoveryState.timeYear === "all" ? "" : discoveryState.timeYear, [["", "Choose a year…"], ...discoveryYears().slice(1)])}</div>
    <p class="discovery-note">Dates below are collection years, not necessarily publication dates. Comparisons show archive appearances and do not imply that one paper builds on another.</p>
    ${first && last && first.year !== last.year ? `<section class="time-comparison" aria-label="Earlier and later research"><div><p class="eyebrow">Earlier in the archive</p>${discoveryRecord(first)}</div><div><p class="eyebrow">Later in the archive</p>${discoveryRecord(last)}</div></section>` : ""}
    <div class="time-spine">${records.map((record) => {
      const yearItems = discoverySorted(items.filter((item) => item.year === record.id));
      const expanded = discoveryState.timeExpanded.has(record.id);
      return `<section class="time-stop" id="time-${h(record.id)}" tabindex="-1"><header><p class="time-year">${h(yearLabel(record.id))}</p><div><p class="eyebrow">${record.status === "final" ? "Annual collection" : "Preliminary collection · unranked"}</p><h2>${yearItems.length} ${discoveryState.timeTopic === "all" ? "research records" : `${h(discoveryState.timeTopic)} records`}</h2><p>${record.status === "final" ? `${yearItems.filter((item) => item.rank).length} Top 10 selections in this view` : "Provisional research leads; subject to change"}</p></div></header>
      <div class="discovery-grid">${yearItems.slice(0, expanded ? yearItems.length : 3).map((item) => discoveryRecord(item)).join("") || discoveryEmpty("No records for this subject in this collection.")}</div>
      ${yearItems.length > 3 ? `<button class="discovery-more" type="button" data-discovery-action="time-expand" data-discovery-value="${h(record.id)}" aria-expanded="${expanded}">${expanded ? "Show highlights" : `Explore all ${yearItems.length} records from ${h(yearLabel(record.id))}`}</button>` : ""}</section>`;
    }).join("")}</div></section>`;
}
function discoveryRefresh() {
  if (!isDiscoveryView()) return;
  const active = document.activeElement;
  const id = active?.id;
  const action = active?.getAttribute("data-discovery-action"), value = active?.getAttribute("data-discovery-value"), favourite = active?.getAttribute("data-favourite");
  const inside = $("#view-root").contains(active);
  render();
  if (!inside) return;
  const controls = $$("#view-root button");
  const target = id ? document.getElementById(id) : controls.find((button) => favourite ? button.dataset.favourite === favourite : button.dataset.discoveryAction === action && button.dataset.discoveryValue === value);
  const fallback = $("#desk-result-count") || $("#view-root");
  if (target && !target.disabled) focusWithoutScroll(target);
  else { fallback.setAttribute("tabindex", "-1"); focusWithoutScroll(fallback); }
}
function discoveryJump(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: state.motionReduced ? "instant" : "smooth", block: "start" });
  focusWithoutScroll(target);
}
function handleDiscoveryClick(event) {
  const button = event.target.closest("[data-discovery-action]");
  if (!button) return false;
  const { discoveryAction: action, discoveryValue: value } = button.dataset;
  if (action === "read" || action === "mark") {
    const item = state.items.find((entry) => entry.id === value);
    if (item) {
      if (action === "mark") setReadState(item);
      else if (item.mdPath) openReader(item);
      else openArtifact(item.id);
    }
    return true;
  }
  if (action === "retry") { discoveryState.error = ""; renderDiscovery(); return true; }
  if (action === "theme" && ["light", "dark"].includes(value)) {
    discoveryState.theme = value;
    try { localStorage.setItem("websec-discovery-theme-v1", value); } catch { toast("Appearance could not be saved in this browser"); }
    updateDiscoveryAppearance();
    $$("[data-discovery-action='theme']").forEach((control) => control.setAttribute("aria-pressed", String(control.dataset.discoveryValue === value)));
    return true;
  } else if (action === "desk-reset") {
    // Capture the previous year before Reset clears the other desk filters.
    selectArchiveYear("all");
    Object.assign(discoveryState, { deskQuery: "", deskAuthor: "", deskYear: "all", deskTopic: "all", deskStanding: "all", deskRead: "all", deskSort: "newest", deskVideo: "all", deskPage: 1 });
  } else if (action === "desk-compact") discoveryState.deskCompact = !discoveryState.deskCompact;
  else if (action === "desk-next") discoveryState.deskPage++;
  else if (action === "desk-prev") discoveryState.deskPage--;
  else if (action === "time-expand" && YEAR_FILES.includes(value)) toggleInSet(discoveryState.timeExpanded, value);
  discoveryRefresh();
  return true;
}
function handleDiscoveryInput(event) {
  const mapping = { "desk-query": "deskQuery", "desk-author": "deskAuthor", "desk-year": "deskYear", "desk-topic": "deskTopic", "desk-standing": "deskStanding", "desk-read": "deskRead", "desk-sort": "deskSort", "desk-video": "deskVideo", "time-topic": "timeTopic", "time-order": "timeOrder" };
  if (event.target.id === "time-jump") { selectArchiveYear(event.target.value || "all"); return; }
  if (event.target.id === "desk-year") { selectArchiveYear(event.target.value); return; }
  const key = mapping[event.target.id];
  if (!key) return;
  discoveryState[key] = event.target.value;
  if (state.view === "desk") { discoveryState.deskPage = 1; $("#desk-results").innerHTML = deskResults(); }
  else discoveryRefresh();
}
