(function () {
  "use strict";

  const query = document.getElementById("query");
  const classSelect = document.getElementById("character-class");
  const subclassSelect = document.getElementById("character-subclass");
  const levelSelect = document.getElementById("character-level");
  const characterNote = document.getElementById("character-note");
  const tierButtons = document.getElementById("tier-buttons");
  const secrets = document.getElementById("secrets");
  const offlineData = document.getElementById("offline-spells");
  const buttons = document.getElementById("school-buttons");
  const results = document.getElementById("results");
  const count = document.getElementById("count");
  const empty = document.getElementById("empty");
  const error = document.getElementById("error");
  const coreSchools = ["Fire", "Ice", "Lightning", "Wind", "Radiant", "Necrotic"];
  const schools = [...coreSchools, "Hexbinder", "Shadowmancer", "Shepherd", "Songweaver", "Muscle Mage"];
  const symbols = { Fire: "✦", Ice: "❄", Lightning: "ϟ", Wind: "✧", Radiant: "☼", Necrotic: "☾" };
  // These trailing definitions apply to the group, not just the card they were extracted with.
  const schoolReferences = {
    Fire: { "Flame Dart": /(?<=\. )Smoldering\. / },
    Ice: { Shatter: /(?<=\. )Hampered\. /, "Glacier Strike": /(?<=\. )D66\. / },
    Lightning: { "Ride the Lightning": /(?<=\. )D88\. / },
    Wind: { Echoburst: /(?<=\. )D44\. / },
    Shadowmancer: { "Summon Shadow": /(?<=\. )Minions\. / },
    "Muscle Mage": { "Power Word: Clobber": /(?<=\. )Clobbered\. /, Throwmaturgy: /(?<=\. )3\/FD\? / }
  };
  const glossarySources = { Clobbered: "Power Word: Clobber", Smoldering: "Flame Dart", Hampered: "Shatter", Charged: "Overload" };
  const glossaryPattern = new RegExp(`\\b(?:${Object.keys(glossarySources).join("|")})\\b`, "gi");
  const glossary = new Map();
  const legendName = /(?:The Aegis|The Stiletto|The Mender|The Tactician|The Warlord|Old Oakum)\./;
  const spellLabels = new RegExp([
    /\b(?:Range|Reach|Line|Damage|Concentration|High(?:er)? Levels|Upcast|On crit|On hit|On miss|On damage|Reaction|Exert(?: \(Reach \d+\))?):/,
    /(?:^|(?<=[.!?]\s))(?:Castable only|Castable(?=\s+when\b)|Costs(?=\s+\d+\b))/,
    /(?:^|(?<=[.!?]\s))(?:Note\.|Example\.|Replacing a die\.|Flavor is Free\.|Minions\.|Shadow Limit\.|Smoldering\.|Hampered\.|Clobbered\.|D(?:44|66|88)(?: with advantage)?\.|Remember!|Dead\?|Rushed Attacks and My Companion\?|3\/FD\?)/,
    new RegExp(`(?:^|(?<=[.!?:]\\s))(?:(?:Legends you know|You also learn the following Legends|Learn the following Legends):|${legendName.source}|Banner Bearer\\.|LEVEL \\d+\\b)`),
    /•\s*(?:[^.!?•]+?\.(?:\s+\d+ Actions?:)?)?/
  ].map((pattern) => pattern.source).join("|"), "gi");
  const rules = window.CharacterRules;
  let selectedSchool = "";
  const selectedTiers = new Set();
  let spells = [];
  let requestId = 0;
  let loaded = false;

  if (!rules) {
    count.textContent = "Character rules could not be loaded";
    error.textContent = "The character rules file could not be loaded. Check the app files and reload the page.";
    error.hidden = false;
    return;
  }
  for (const name of Object.keys(rules.classes)) classSelect.add(new Option(name, name));
  for (let level = 1; level <= 20; level++) levelSelect.add(new Option(String(level), String(level)));

  function character() {
    return { className: classSelect.value, subclass: subclassSelect.value, level: Number(levelSelect.value) };
  }

  function updateCharacter() {
    subclassSelect.disabled = !classSelect.value || Number(levelSelect.value) < 3;
    characterNote.textContent = rules.explanation(character());
    characterNote.hidden = !classSelect.value;
    render();
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function referenceStart(spell) {
    return spell.is_secret ? -1 : (schoolReferences[spell.school]?.[spell.name]?.exec(spell.description)?.index ?? -1);
  }

  const tooltip = element("div", "glossary-tooltip");
  tooltip.hidden = true;
  tooltip.setAttribute("aria-hidden", "true");
  document.body.append(tooltip);
  let activeTerm;

  function hideTooltip() {
    tooltip.hidden = true;
    activeTerm = null;
  }

  function showTooltip(term, definition) {
    activeTerm = term;
    tooltip.textContent = definition;
    tooltip.hidden = false;
    const anchor = term.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    tooltip.style.left = `${Math.max(8, Math.min(anchor.left, width - tooltip.offsetWidth - 8))}px`;
    const top = anchor.bottom + tooltip.offsetHeight <= window.innerHeight - 8
      ? anchor.bottom : Math.max(8, anchor.top - tooltip.offsetHeight);
    tooltip.style.top = `${top}px`;
  }

  tooltip.addEventListener("pointerleave", (event) => {
    if (event.relatedTarget !== activeTerm && document.activeElement !== activeTerm) hideTooltip();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTooltip();
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.target !== activeTerm && !tooltip.contains(event.target)) hideTooltip();
  });
  window.addEventListener("resize", hideTooltip);
  window.addEventListener("scroll", hideTooltip, { passive: true });

  function appendGlossaryTerms(row, text) {
    let position = 0;
    for (const match of text.matchAll(glossaryPattern)) {
      const key = match[0].toLowerCase();
      const definition = glossary.get(key);
      if (!definition) continue;
      row.append(document.createTextNode(text.slice(position, match.index)));
      const term = element("button", "glossary-term", match[0]);
      term.type = "button";
      term.setAttribute("aria-describedby", `definition-${key}`);
      const show = () => showTooltip(term, definition);
      term.addEventListener("pointerenter", show);
      term.addEventListener("focus", show);
      term.addEventListener("click", show);
      term.addEventListener("pointerleave", (event) => {
        if (activeTerm === term && event.relatedTarget !== tooltip && document.activeElement !== term) hideTooltip();
      });
      term.addEventListener("blur", () => {
        if (activeTerm === term) hideTooltip();
      });
      row.append(term);
      position = match.index + match[0].length;
    }
    if (position < text.length) row.append(document.createTextNode(text.slice(position)));
  }

  function appendSpellText(row, text) {
    const parts = text.split(/(\((?:\d+\/(?:round|turn|encounter)|WIL\/Safe Rest)\))/gi);
    for (let i = 0; i < parts.length; i++) {
      if (i % 2) row.append(element("span", "keyword-badge frequency-badge", parts[i]));
      else if (parts[i]) appendGlossaryTerms(row, parts[i]);
    }
  }

  function appendSpellRows(description, row, text, isCantrip) {
    const options = text.split(isCantrip ? /\s+(OR:?)\s+/ : /\s+(OR:)\s+/);
    appendSpellText(row, options[0]);
    description.append(row);
    for (let i = 1; i < options.length; i += 2) {
      const alternative = element("p", "spell-text spell-alternative");
      alternative.append(element("strong", "keyword-badge alternative-badge", options[i]), document.createTextNode(" "));
      appendSpellText(alternative, options[i + 1]);
      description.append(alternative);
    }
  }

  function spellDescription(text, isCantrip = false, groupLegends = false) {
    const description = element("div", "spell-description");
    const sections = [];
    let position = 0;
    let label = "";
    for (const match of text.matchAll(spellLabels)) {
      sections.push({ label, body: text.slice(position, match.index).trim() });
      label = match[0].replace(/\s+/g, " ").trim();
      position = match.index + match[0].length;
    }
    sections.push({ label, body: text.slice(position).trim() });

    let legend;
    for (const { label, body } of sections) {
      if (!label && !body) continue;
      if (groupLegends && legendName.test(label)) {
        legend = element("div", "legend-entry");
        legend.append(element("h4", "spell-text legend-name", label));
        description.append(legend);
        appendSpellRows(legend, element("p", "spell-text"), body, isCantrip);
        continue;
      }
      if (!/^Exert\b/i.test(label)) legend = null;
      const group = legend || description;
      const row = element("p", label ? "spell-text spell-detail" : "spell-text");
      if (legend) row.classList.add("legend-exert");
      const restriction = /^(?:Castable(?: only)?|Costs)$/i.test(label);
      if (label) row.append(element("strong", restriction ? "keyword-badge restriction-badge" : "keyword-badge", label), document.createTextNode(body ? " " : ""));
      // Start the effect on its own line after a short stat or casting restriction.
      const lead = (restriction || /^(?:Range|Reach|Line|Concentration):$/i.test(label)) && /^(.+?\.)\s+(.+)$/.exec(body);
      appendSpellRows(group, row, lead ? lead[1] : body, isCantrip);
      if (lead) appendSpellRows(group, element("p", "spell-text"), lead[2], isCantrip);
    }
    return description;
  }

  function spellCard(spell, availability) {
    const card = element("article", "spell-card");
    const label = spell.school === "Muscle Mage" ? "MUSCLE SPELL" : spell.is_utility ? "UTILITY CANTRIP" : spell.tier === 0 ? "CANTRIP" : `TIER ${spell.tier}`;
    const tags = [label, spell.tags, spell.is_secret ? "SECRET" : null].filter(Boolean).join(" · ");
    card.append(element("span", "spell-label", tags));

    const heading = element("div", "spell-heading");
    heading.append(element("h3", "", spell.name));
    if (spell.casting_time) heading.append(element("span", "casting-time", spell.casting_time));
    card.append(heading);
    if (availability === "option") card.append(element("span", "availability-badge", "CHOICE"));
    if (availability === "conditional") card.append(element("span", "availability-badge conditional", "CONDITIONAL"));
    if (spell.source_details) card.append(element("p", "source-details", spell.source_details));
    const noteStart = referenceStart(spell);
    card.append(spellDescription(
      noteStart < 0 ? spell.description : spell.description.slice(0, noteStart).trimEnd(),
      spell.tier === 0 && spell.school !== "Muscle Mage",
      spell.school === "Songweaver" && spell.name === "Legend’s Tale"
    ));
    if (spell.gm_notes) {
      const details = element("details", "gm-notes");
      details.append(element("summary", "", "GM notes"), element("p", "", spell.gm_notes));
      card.append(details);
    }
    const sourceName = spell.source_file.startsWith("classes\\") ? "CLASS SHEET" : spell.is_secret ? "GM GUIDE" : "CORE RULES";
    const source = element(offlineData ? "span" : "a", "source-link", `${sourceName} · PDF PAGE ${spell.pdf_page}${offlineData ? "" : " ↗"}`);
    if (!offlineData) {
      source.href = "/" + spell.source_file.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/") + "#page=" + spell.pdf_page;
      source.target = "_blank";
      source.rel = "noopener";
    }
    card.append(source);
    return card;
  }

  function render() {
    if (!loaded) return;
    const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const currentCharacter = character();
    const matches = spells.map((spell) => ({ spell, availability: rules.availability(spell, currentCharacter) })).filter(({ spell, availability }) => {
      if (!availability) return false;
      if (selectedSchool === "Class spells" && coreSchools.includes(spell.school)) return false;
      if (selectedSchool && selectedSchool !== "Class spells" && spell.school !== selectedSchool) return false;
      if (selectedTiers.size && (spell.school === "Muscle Mage" || !selectedTiers.has(spell.tier))) return false;
      const searchable = [spell.name, spell.school, spell.description, spell.source_details, spell.gm_notes].join(" ").toLocaleLowerCase();
      return terms.every((term) => searchable.includes(term));
    });
    count.textContent = `${matches.length} ${matches.length === 1 ? "spell" : "spells"} found`;
    empty.hidden = matches.length > 0;
    hideTooltip();
    results.replaceChildren();
    const definitions = element("div", "");
    definitions.hidden = true;
    for (const [key, definition] of glossary) {
      const entry = element("span", "", definition);
      entry.id = `definition-${key}`;
      definitions.append(entry);
    }
    results.append(definitions);
    renderSpellGroups(results, matches);
  }

  function renderSpellGroups(target, entries, decorateCard) {
    for (const school of schools) {
      const group = entries
        .filter(({ spell }) => spell.school === school)
        .sort((a, b) => Number(b.spell.tier === 0) - Number(a.spell.tier === 0));
      if (!group.length) continue;
      const section = element("section", `school-section school-${school.toLowerCase().replace(/\s+/g, "-")}`);
      const heading = element("div", "school-heading");
      const icon = element("span", "school-icon", symbols[school] || "✦");
      icon.setAttribute("aria-hidden", "true");
      const title = element("h2", "", `${school} Spells`);
      heading.append(icon, title, element("span", "school-count", `${group.length} ${group.length === 1 ? "SPELL" : "SPELLS"}`));
      section.append(heading);
      if (schoolReferences[school]) {
        const notes = element("aside", "school-notes");
        notes.setAttribute("aria-label", `${school} rules reference`);
        for (const spell of spells) {
          if (spell.school !== school) continue;
          const start = referenceStart(spell);
          if (start >= 0) notes.append(spellDescription(spell.description.slice(start)));
        }
        if (notes.childElementCount) section.append(notes);
      }
      const grid = element("div", "spell-grid");
      for (const { spell, availability } of group) {
        const card = spellCard(spell, availability);
        decorateCard?.(card, spell);
        grid.append(card);
      }
      section.append(grid);
      target.append(section);
    }
  }

  if (offlineData) window.SpellbookCards = { renderSpellGroups };

  async function loadSpells() {
    const currentRequest = ++requestId;
    loaded = false;
    count.textContent = "Loading spells…";
    error.hidden = true;
    empty.hidden = true;
    hideTooltip();
    results.replaceChildren();
    try {
      let data;
      if (offlineData) {
        data = JSON.parse(offlineData.textContent);
      } else {
        const response = await fetch(`/api/spells?include_secret=${secrets.checked ? "1" : "0"}`);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        data = await response.json();
      }
      if (!Array.isArray(data)) throw new Error("Invalid spell data");
      if (currentRequest !== requestId) return;
      spells = data;
      glossary.clear();
      for (const [term, source] of Object.entries(glossarySources)) {
        const spell = spells.find((entry) => !entry.is_secret && entry.name === source);
        const definition = spell?.description.match(new RegExp(`(?:^|(?<=\\. ))${term}\\. (.+)$`))?.[1];
        if (definition) glossary.set(term.toLowerCase(), definition);
      }
      loaded = true;
      render();
    } catch (problem) {
      if (currentRequest !== requestId) return;
      count.textContent = "Spells could not be loaded";
      const help = offlineData ? "Try opening a fresh copy of the offline file." : "Check that the local server is running and reload the page.";
      error.textContent = `Unable to load the spell database. ${problem.message} ${help}`;
      error.hidden = false;
    }
  }

  buttons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-school]");
    if (!button) return;
    selectedSchool = button.dataset.school;
    for (const item of buttons.querySelectorAll("button")) {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    }
    render();
  });
  tierButtons.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tier]");
    if (!button) return;
    if (button.dataset.tier === "") {
      selectedTiers.clear();
    } else {
      const value = Number(button.dataset.tier);
      if (selectedTiers.has(value)) selectedTiers.delete(value);
      else selectedTiers.add(value);
    }
    for (const item of tierButtons.querySelectorAll("button")) {
      const active = item.dataset.tier === ""
        ? selectedTiers.size === 0
        : selectedTiers.has(Number(item.dataset.tier));
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    }
    render();
  });
  query.addEventListener("input", render);
  classSelect.addEventListener("change", () => {
    subclassSelect.replaceChildren(new Option(classSelect.value ? "No subclass selected" : "Choose a class first", ""));
    if (classSelect.value) {
      for (const name of rules.classes[classSelect.value]) subclassSelect.add(new Option(name, name));
    }
    updateCharacter();
  });
  subclassSelect.addEventListener("change", updateCharacter);
  levelSelect.addEventListener("change", updateCharacter);
  secrets?.addEventListener("change", loadSpells);
  loadSpells();
})();
