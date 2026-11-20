(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const rules = window.CharacterRules;
  const classIndex = JSON.parse(byId("offline-features").textContent);
  const origins = JSON.parse(byId("offline-origins").textContent);
  const spells = JSON.parse(byId("offline-spells").textContent);
  const classSelect = byId("my-class");
  const subclassSelect = byId("my-subclass");
  const levelSelect = byId("my-level");
  const profileSelect = byId("my-profiles");
  const nameInput = byId("my-name");
  const ancestrySelect = byId("my-ancestry");
  const backgroundSelect = byId("my-background");
  const secondBackground = byId("my-second-background");
  const backgroundSpell = byId("my-background-spell");
  const extraForm = byId("my-extra-form");
  const extraKind = byId("my-extra-kind");
  const extraName = byId("my-extra-name");
  const extraRules = byId("my-extra-rules");
  const notesInput = byId("my-notes");
  const notePagesSelect = byId("my-note-pages");
  const noteTitle = byId("my-note-title");
  const choicePanel = byId("my-choices");
  const featureChoices = byId("my-feature-choices");
  const manaInput = byId("my-mana-stat");
  const status = byId("my-status");
  const output = byId("my-unlocks");
  const spellOutput = byId("my-spells");
  const storageKey = "nimble-offline-characters-v1";
  const accountStore = window.NimbleProfileStore;
  const saveButton = byId("my-save");
  const deleteButton = byId("my-delete");
  const editor = byId("my-character-title").closest(".library");
  let profiles = {};
  let activeName = "";
  let savedSnapshot = "";
  let writes = Promise.resolve(true);
  let profileBusy = false;
  let picks = {};
  let manaStats = {};
  let notePages = [{ title: "General", text: "" }];
  let activeNotePage = 0;
  let featurePicks = {};
  let extraAbilities = [];
  let editingExtra = -1;
  let openSections = new Set();
  for (const name of Object.keys(rules.classes)) classSelect.add(new Option(name));
  for (let level = 1; level <= 20; level++) levelSelect.add(new Option(String(level)));

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function refreshProfiles(selected = "") {
    profileSelect.replaceChildren(new Option("New character", ""));
    for (const name of Object.keys(profiles).sort((a, b) => a.localeCompare(b))) profileSelect.add(new Option(name));
    profileSelect.value = selected;
  }

  function renderNotePages() {
    notePagesSelect.replaceChildren(...notePages.map((page, index) =>
      new Option(page.title.trim() || `Untitled page ${index + 1}`, String(index))));
    notePagesSelect.value = String(activeNotePage);
    noteTitle.value = notePages[activeNotePage].title;
    notesInput.value = notePages[activeNotePage].text;
  }

  notePagesSelect.addEventListener("change", () => {
    activeNotePage = Number(notePagesSelect.value);
    renderNotePages();
  });
  noteTitle.addEventListener("input", () => {
    notePagesSelect.options[activeNotePage].text = noteTitle.value.trim() || `Untitled page ${activeNotePage + 1}`;
  });
  noteTitle.addEventListener("blur", () => {
    notePages[activeNotePage].title = noteTitle.value;
    autosave();
  });
  notesInput.addEventListener("blur", () => {
    notePages[activeNotePage].text = notesInput.value;
    autosave();
  });
  byId("my-note-add").addEventListener("click", () => {
    activeNotePage = notePages.push({ title: "New page", text: "" }) - 1;
    renderNotePages();
    autosave();
    noteTitle.focus();
    noteTitle.select();
  });
  byId("my-note-delete").addEventListener("click", () => {
    const title = notePagesSelect.options[activeNotePage].text;
    if (!window.confirm(`Delete “${title}” and its notes?`)) return;
    notePages.splice(activeNotePage, 1);
    if (!notePages.length) notePages.push({ title: "General", text: "" });
    activeNotePage = Math.min(activeNotePage, notePages.length - 1);
    renderNotePages();
    autosave();
    notePagesSelect.focus();
  });

  if (!accountStore) {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) profiles = JSON.parse(saved);
    } catch {
      status.textContent = "Saved profiles could not be loaded. You can still use the character view.";
    }
  }
  refreshProfiles();

  function character() {
    const level = Number(levelSelect.value);
    return { className: classSelect.value, subclass: level >= 3 ? subclassSelect.value : "", level };
  }

  function updateSubclass(selected = "") {
    subclassSelect.replaceChildren(new Option("None selected", ""));
    for (const name of rules.classes[classSelect.value] || []) subclassSelect.add(new Option(name));
    subclassSelect.value = (rules.classes[classSelect.value] || []).includes(selected) ? selected : "";
    updateLevel();
  }

  function updateLevel() {
    subclassSelect.disabled = !classSelect.value || Number(levelSelect.value) < 3;
    byId("my-choice-hint").textContent = !classSelect.value ? "Choose a class to see its options."
      : subclassSelect.disabled ? "Subclasses are available from level 3." : "";
  }

  function updateMana(resource) {
    const stat = manaInput.valueAsNumber;
    const formula = `${resource.stat}${resource.multiplier === 1 ? "" : ` × ${resource.multiplier}`}${resource.bonus ? ` + ${resource.bonus}` : ""}`;
    byId("my-mana").textContent = `${Number.isInteger(stat) ? Math.max(0, stat * resource.multiplier + resource.bonus) : formula} ${resource.unit}`;
  }

  function renderCasting(current, entries) {
    const resource = rules.castingResource(current);
    byId("my-casting").hidden = false;
    byId("my-mana-stat-field").hidden = !resource.stat;
    byId("my-mana-stat-label").textContent = resource.stat ? `Current ${resource.stat} score` : "";
    manaInput.value = manaStats[resource.stat] ?? "";
    if (resource.stat) updateMana(resource);
    else byId("my-mana").textContent = resource.text;
    const leveled = entries.filter(({ spell }) => spell.tier > 0);
    const progressionTier = current.subclass === "Reaver (story)" ? 0 : rules.maxTier(current);
    const standardTier = Math.max(progressionTier, ...leveled.filter(({ state }) => state !== "conditional").map(({ spell }) => spell.tier));
    const conditionalTier = Math.max(0, ...leveled.filter(({ state }) => state === "conditional").map(({ spell }) => spell.tier));
    const base = standardTier ? `Tier ${standardTier}` : entries.some(({ spell }) => spell.tier === 0 && spell.school !== "Muscle Mage") ? "Cantrips only" : "No tiered spells";
    byId("my-max-tier").textContent = current.subclass === "Elemental Lord"
      ? "Varies with Wounds (Elemental Avatar)"
      : conditionalTier > standardTier ? `${base}; up to Tier ${conditionalTier} conditionally` : base;
  }

  function heading(text, body) {
    const section = node("section", "character-unlock-group");
    section.append(node("h2", "", text), body);
    return section;
  }

  function optional(key, title, body) {
    const section = node("details", "character-options character-unlock-group");
    section.open = openSections.has(key);
    section.append(node("summary", "", title), body);
    section.addEventListener("toggle", () => {
      if (section.open) openSections.add(key);
      else openSections.delete(key);
    });
    return section;
  }

  const abilityGroups = {
    Ancestry: "Ancestry abilities", Background: "Background abilities",
    Item: "Item abilities", Boon: "Boons", Other: "Other abilities"
  };
  const ancestries = new Map(origins.ancestries.map((entry) => [entry.name, entry]));
  const backgrounds = new Map(origins.backgrounds.map((entry) => [entry.name, entry]));
  const utilities = new Map(spells.filter((spell) => spell.is_utility && !Object.hasOwn(rules.classes, spell.school))
    .map((spell) => [JSON.stringify([spell.school, spell.name]), spell]));
  const alphabetical = (a, b) => a.name.localeCompare(b.name);
  ancestrySelect.add(new Option("None selected", ""));
  for (const rarity of ["Common", "Uncommon", "Exotic"]) {
    const group = node("optgroup");
    group.label = rarity;
    for (const origin of origins.ancestries.filter((entry) => entry.rarity === rarity).sort(alphabetical)) {
      group.append(new Option(origin.name));
    }
    ancestrySelect.append(group);
  }
  for (const select of [backgroundSelect, secondBackground]) {
    select.add(new Option("None selected", ""));
    for (const origin of [...origins.backgrounds].sort(alphabetical)) select.add(new Option(origin.name));
  }
  [...secondBackground.options].find((option) => option.value === "Made a BAD Choice").disabled = true;
  ancestrySelect.add(new Option("Custom — add below", "__custom"));
  backgroundSelect.add(new Option("Custom — add below", "__custom"));
  backgroundSpell.add(new Option("None selected", ""));
  for (const [key, spell] of [...utilities].sort((a, b) => alphabetical(a[1], b[1]))) {
    backgroundSpell.add(new Option(`${spell.name} (${spell.school})`, key));
  }

  function resetExtraForm() {
    editingExtra = -1;
    extraForm.reset();
    extraName.setCustomValidity("");
    extraForm.querySelector('[type="submit"]').textContent = "Add ability";
    byId("my-extra-cancel").hidden = true;
  }

  function renderOrigins() {
    const ancestry = ancestries.get(ancestrySelect.value);
    const background = backgrounds.get(backgroundSelect.value);
    const hasSecond = background?.name === "Made a BAD Choice";
    byId("my-second-background-field").hidden = !hasSecond;
    secondBackground.disabled = !hasSecond;
    if (!hasSecond) secondBackground.value = "";
    const selectedBackgrounds = [background, backgrounds.get(secondBackground.value)].filter(Boolean);
    const hasUtility = selectedBackgrounds.some((entry) => entry.utilitySpell);
    byId("my-background-spell-field").hidden = !hasUtility;
    backgroundSpell.disabled = !hasUtility;
    if (!hasUtility) backgroundSpell.value = "";
    const utility = utilities.get(backgroundSpell.value);

    const groups = new Map(Object.keys(abilityGroups).map((kind) => [kind, []]));
    if (ancestry) groups.get("Ancestry").push({ ...ancestry, name: ancestry.trait, source: `${ancestry.name} · ${ancestry.size}` });
    for (const entry of selectedBackgrounds) groups.get("Background").push({ ...entry, page: 15 });
    for (const entry of extraAbilities) groups.get(entry.kind).push(entry);
    const output = byId("my-origin-abilities");
    output.replaceChildren();
    for (const [kind, rows] of groups) {
      if (!rows.length) continue;
      const list = node("ul", "character-feature-list");
      for (const entry of rows) {
        const item = node("li", "arsenal-feature");
        item.append(node("strong", "ability-name", entry.name));
        item.append(node("span", "keyword-badge arsenal-badge", entry.source || kind));
        if (entry.page) item.append(node("small", "", ` · Core Rules · PDF page ${entry.page}`));
        if (entry.description) item.append(node("p", "feature-description", entry.description));
        if (entry.utilitySpell && utility) {
          item.append(optional("background-spell", `Learned: ${utility.name}`, spellList([{ spell: utility, state: "known" }])));
        }
        list.append(item);
      }
      output.append(heading(abilityGroups[kind], list));
    }
  }

  function renderExtraChoices() {
    const list = byId("my-extra-choices");
    list.replaceChildren();
    for (const [index, entry] of extraAbilities.entries()) {
      const item = node("li", "origin-choice-row");
      const controls = node("div");
      const edit = node("button", "school-button", "Edit");
      const remove = node("button", "school-button", "Remove");
      for (const button of [edit, remove]) {
        button.type = "button";
        button.setAttribute("aria-label", `${button.textContent} ${entry.name}`);
      }
      edit.addEventListener("click", () => {
        editingExtra = index;
        extraName.setCustomValidity("");
        extraKind.value = entry.kind;
        extraName.value = entry.name;
        extraRules.value = entry.description;
        extraForm.querySelector('[type="submit"]').textContent = "Update ability";
        byId("my-extra-cancel").hidden = false;
        extraName.focus();
      });
      remove.addEventListener("click", () => {
        if (!window.confirm(`Remove “${entry.name}”?`)) return;
        extraAbilities.splice(index, 1);
        if (editingExtra === index) resetExtraForm();
        else if (editingExtra > index) editingExtra--;
        renderExtraChoices();
        renderOrigins();
        autosave();
        extraKind.focus();
      });
      controls.append(edit, remove);
      item.append(node("span", "", `${entry.kind}: ${entry.name}`), controls);
      list.append(item);
    }
  }

  extraName.addEventListener("input", () => extraName.setCustomValidity(""));
  byId("my-extra-cancel").addEventListener("click", () => { resetExtraForm(); extraKind.focus(); });
  extraForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = extraName.value.trim();
    if (!name) {
      extraName.setCustomValidity("Enter an ability name.");
      extraName.reportValidity();
      return;
    }
    const ability = { kind: extraKind.value, name, description: extraRules.value.trim() };
    if (editingExtra === -1) extraAbilities.push(ability);
    else extraAbilities[editingExtra] = ability;
    resetExtraForm();
    renderExtraChoices();
    renderOrigins();
    autosave();
    extraKind.focus();
  });
  for (const select of [ancestrySelect, backgroundSelect, secondBackground, backgroundSpell]) {
    select.addEventListener("change", () => {
      if (select.value === "__custom" && editingExtra === -1) {
        extraKind.value = select === ancestrySelect ? "Ancestry" : "Background";
        extraName.focus();
      }
      renderOrigins();
      autosave();
    });
  }

  function choiceOptions(feature, data, entries, current) {
    const name = feature.name.replace(/ \(\d+\)$/, "");
    const text = feature.description || "";
    const direct = (names) => names.map((value) => ({ name: value }));
    if (/stat/i.test(name)) return direct([...new Set(text.match(/\b(?:STR|DEX|INT|WIL)\b/g) || [])])
      .map((option) => ({ ...option, repeatable: true }));
    if (/Wind Spellcasting/.test(name)) return direct(["Fire", "Ice", "Lightning", "Radiant", "Necrotic"]);
    if (name === "Deepening Study") return direct(["Ice", "Radiant"]);
    if (name === "Weapon Mastery") return [
      { name: "Slashing", description: "Once per turn, a slashing attack can also hit a creature adjacent to both you and the target.", page: 4 },
      { name: "Piercing", description: "Once per turn, a piercing attack can also hit a creature behind the target and within Reach.", page: 4 },
      { name: "Bludgeoning", description: "Once per turn, deal +10 damage with a bludgeoning attack against a creature with Defense.", page: 4 }
    ];
    if (name === "Beastmaster Companion") return rules.companionOptions(current.level);
    if (name === "Epic Boon") return rules.epicBoons;
    if (name === "Hexbinder Subclass") return direct(rules.classes.Hexbinder);
    if (name === "Fireshaper" || name === "Frostshaper") {
      const schools = name === "Fireshaper" ? ["Ice", "Lightning"] : ["Fire", "Lightning"];
      return entries.filter(({ spell, state }) => schools.includes(spell.school) && state === "option" && !spell.is_utility)
        .map(({ spell }) => ({ name: spell.name, spell }));
    }
    if (name === "THE PACT IS SEALED" || name === "Lesser Invocation") return data.catalogs["Lesser Invocations"];
    if (name === "A Gift from the Master") return data.catalogs.Invocations;
    if (name === "Powerful Mind") return data.catalogs["Psionic Abilities"]
      .filter((option) => option.requiredLevel > 0 && option.requiredLevel <= feature.level);
    if (name === "Fit for Any Battlefield") return [
      ...data.catalogs["Commander’s Orders"].filter((option) => option.tactic),
      ...(feature.level > 2 ? [{ name: "+1 max Combat Die", description: "Increase your maximum Combat Dice by 1.", page: feature.page, repeatable: true }] : [])
    ];
    if (name === "Commander’s Orders") return data.catalogs[name].filter((option) => !option.tactic);
    if (name === "Afflictions") return data.catalogs[name].filter((option) => !["Withered", "Frenzied"].includes(option.name));
    if (["Hexbinder’s Familiar", "Empowered Familiar", "Mighty Familiar"].includes(name)) return data.catalogs["Familiar Boons"];
    if (feature.subclass === "Elemental Lord" && name === "Elemental Mastery") return data.catalogs["Elemental Prowess"];
    if (!feature.subclass && name === "Elemental Mastery") return direct(["Fire", "Ice", "Lightning"]);
    if (name === "Old Habits…") return data.catalogs["Underhanded Ability"] || [];
    if (name === "Constant Tinkering" || name === "Eureka!") return [...(data.catalogs["Eureka!"] || []), ...(data.catalogs.Gadgets || [])];
    if (data.catalogs[name]?.length) return data.catalogs[name];
    if (/\butility spell/i.test(text) && !/\b(?:tier|school to learn)\b/i.test(text)) {
      const school = text.match(/\b(Fire|Ice|Lightning|Wind|Radiant|Necrotic) Utility Spell/i)?.[1];
      return (school ? spells.filter((spell) => spell.is_utility && spell.school === school)
        : entries.filter(({ spell, state }) => spell.is_utility && state !== "conditional").map(({ spell }) => spell))
        .map((spell) => ({ name: spell.name, spell }));
    }
    return [];
  }

  function featureCategory(feature) {
    if (feature.category) return feature.category;
    if (/^reaction$/i.test(feature.activation || "")) return "Reactions";
    if (/^passive$/i.test(feature.activation || "")) return "Passives & upgrades";
    return rules.featureCategory({
      ...feature, description: [feature.activation, feature.description].filter(Boolean).join(" ")
    });
  }

  function groupFeatures(features, className) {
    const groups = new Map();
    const names = new Set(features.map((f) => JSON.stringify([f.subclass, f.name])));
    for (const feature of features) {
      let name = feature.name;
      const rageRule = className === "Berserker" && (
        !feature.subclass && /^(?:Rage(?: \(\d+\))?|Your Rage Ends|Yes!|Intensifying Fury(?: \(\d+\))?|Enduring Rage|Deep Rage|Boundless Rage)$/i.test(name) ||
        feature.subclass === "Burning Rage" && /^(?:Stoke the Flames|Overflowing Fury|Hot Headed|Pyromania|BOUNDLESS FLAMES.*)$/.test(name) ||
        feature.subclass === "Mountainheart" && name === "Titan’s Fury"
      );
      const base = name.replace(/ \(\d+\)$/, "");
      const chain = !feature.source && Object.entries(rules.featureChains[className] || {}).find(([root, members]) =>
        names.has(JSON.stringify(["", root])) && (members.includes(base) || (!feature.subclass && base === root)));
      if (rageRule) {
        name = "Rage";
      } else if (chain) {
        name = chain[0];
      } else {
        if (names.has(JSON.stringify([feature.subclass, base]))) name = base;
      }
      const key = JSON.stringify([rageRule || chain ? "" : feature.subclass, name]);
      if (!groups.has(key)) groups.set(key, { name, rows: [] });
      groups.get(key).rows.push(feature);
    }
    return [...groups.values()];
  }

  function spellList(entries, decorateCard) {
    const list = node("div", "character-spell-list");
    window.SpellbookCards.renderSpellGroups(list, entries.map(({ spell, state }) => ({
      spell, availability: state
    })), decorateCard);
    return list;
  }

  function render() {
    const current = character();
    const { className, subclass, level } = current;
    output.replaceChildren();
    spellOutput.replaceChildren();
    featureChoices.replaceChildren();
    byId("my-casting").hidden = true;
    byId("my-choices-summary").textContent = "Feature Choices";
    byId("my-prompt").hidden = Boolean(className);
    const data = classIndex[className];
    if (data) {
      const entries = spells.flatMap((spell) => {
        const state = rules.availability(spell, current);
        return state ? [{ spell, state }] : [];
      });
      renderCasting(current, entries);
      const companionSize = featurePicks[JSON.stringify([className, subclass, 3, "Beastmaster Companion"])];
      const features = rules.unlockedFeatures(data.features, { ...current, companionSize });
      const selectedOptions = [];
      const knownFeatures = features.filter((feature) => !feature.choice).map(({ name }) => name);
      function refreshFeaturePicks() {
        const { claimed, duplicates } = rules.resolveFeaturePicks(selectedOptions, featurePicks, knownFeatures);
        for (const { storedKey, options, select, explanation } of selectedOptions) {
          for (const item of select.options) {
            const option = options.get(item.value);
            if (!option) continue;
            item.disabled = !option.repeatable && claimed.has(option.name) && claimed.get(option.name) !== storedKey;
            item.textContent = item.disabled ? `${option.name} (already learned)` : option.name;
          }
          const value = featurePicks[storedKey];
          select.value = !duplicates.includes(storedKey) && (options.has(value) || value === "__custom") ? value : "";
          explanation.textContent = options.get(select.value)?.description || "";
          explanation.hidden = !explanation.textContent;
        }
      }
      const spellChoices = new Map();
      const unlocked = node("div", "ability-categories");
      const unlockedSection = heading("Unlocked class features", unlocked);
      output.append(unlockedSection);
      function renderAbilities() {
        unlocked.replaceChildren();
        const selected = selectedOptions.flatMap(({ feature, options, select }) => {
          const pick = options.get(select.value);
          if (!pick?.description) return [];
          const category = /^Savage Arsenal\b/.test(feature.name) ? "Attacks & combat actions" : featureCategory(pick);
          return [{ ...pick, level: feature.level, subclass: feature.subclass, source: feature.name, category }];
        });
        const uniquePicks = selected.filter((item, index) => selected.findIndex((other) =>
          other.name === item.name && other.page === item.page && other.description === item.description) === index);
        const groups = groupFeatures([...features.filter((f) => !f.choice ||
          /^(?:Fit for Any Battlefield|Weapon Mastery|Shadowrime|We’ll ALL Burn!|Electrical Dedication|(?:Mighty |Elemental )Avatar|Elemental Prowess)$/.test(f.name)), ...uniquePicks]
          .sort((a, b) => a.level - b.level), className);
        for (const category of ["Attacks & combat actions", "Reactions", "Utility & support", "Passives & upgrades", "Progression"]) {
          const items = groups.filter(({ rows }) => featureCategory(rows[0]) === category);
          if (!items.length) continue;
          const section = node("section", "ability-category");
          const list = node("ul", "character-feature-list");
          for (const { name, rows } of items) {
            const source = rows.find((row) => row.source)?.source;
            const item = node("li", source ? "arsenal-feature" : "");
            item.append(node("strong", "ability-name", name));
            if (source) item.append(node("span", "keyword-badge arsenal-badge", source.replace(/ \(\d+\)$/, "")));
            const summary = rows[0].subclass || source ? null : rules.featureSummary(current, name, rows);
            const consolidated = summary || (rows.length > 1
              ? [...new Set(rows.map((row) => row.description).filter(Boolean))].map((text) => ["", text])
              : null);
            const progression = consolidated ? node("details", "ability-progression") : item;
            if (consolidated) {
              for (const [label, text] of consolidated) {
                const line = node("p", "feature-description");
                if (label) line.append(node("span", "keyword-badge", label), document.createTextNode(" "));
                line.append(document.createTextNode(text));
                item.append(line);
              }
              progression.append(node("summary", "", "Original features by level"));
              item.append(progression);
            }
            for (const row of rows) {
              const detail = node("div", "ability-rule");
              detail.append(node("span", "keyword-badge", `Level ${row.level}`));
              if (row.activation) detail.append(node("span", "keyword-badge", row.activation));
              if (consolidated || row.name !== name) detail.append(node("strong", "", ` ${row.name}`));
              detail.append(node("small", "", ` · ${row.sourceLabel || row.source || row.subclass || className} · PDF page ${row.page}`));
              if (row.description) detail.append(node("p", "feature-description", row.description));
              progression.append(detail);
            }
            list.append(item);
          }
          if (category === "Progression") unlocked.append(optional("progression", category, list));
          else {
            section.append(node("h3", "", category), list);
            unlocked.append(section);
          }
        }
        unlockedSection.hidden = !unlocked.childElementCount;
      }
      const makeFeatureList = (items) => {
        const list = node("ul", "character-feature-list");
        for (const f of items) {
          const listed = choiceOptions(f, data, entries, current).some((option) => option.description);
          const item = node("li", listed ? "arsenal-feature" : "");
          item.append(node("span", "keyword-badge", `Level ${f.level}`), node("strong", "", ` ${f.name}`),
            node("small", "", ` · ${f.sourceLabel || f.subclass || className} · PDF page ${f.page}`));
          if (listed) item.append(document.createTextNode(" "), node("span", "keyword-badge arsenal-badge", "Ability choice"));
          if (f.description) item.append(node("p", "feature-description", f.description));
          // Reuse the old level-3 storage key for the first Gambit so saved picks survive.
          const pickLevel = f.name === "Honorable Gambits" && f.level === 4 ? 3 : f.level;
          const key = JSON.stringify([className, f.subclass, pickLevel, f.name]);
          if (f.choice) {
            const text = f.description || "";
            const availableOptions = choiceOptions(f, data, entries, current);
            const two = /(?:^|[.!?]\s+)Choose 2\b/i.test(text);
            const spellOptions = (filter) => spells.filter((spell) => !Object.hasOwn(rules.classes, spell.school) && filter(spell))
              .map((spell) => ({ name: spell.name, spell }));
            const spellPair = (school) => [
              spellOptions((spell) => spell.school === school && !spell.is_utility && spell.tier === 0),
              spellOptions((spell) => spell.school === school && spell.tier > 0 && spell.tier <= rules.maxTier({ ...current, level: f.level }))
            ];
            const avatarOptions = () => spellOptions((spell) => spell.tier > 0 && ["Fire", "Ice", "Lightning", "Wind", "Earth"].includes(spell.school));
            const pools = /invention and 1 new gadget/i.test(text)
              ? [data.catalogs["Eureka!"] || [], data.catalogs.Gadgets || []]
              : /^Master of Twilight/.test(f.name)
                ? [subclass === "The Forge (story)" ? "Fire" : "Necrotic", "Radiant"]
                  .map((school) => spellOptions((spell) => spell.school === school && spell.is_utility))
                : /^Deep Knowledge/.test(f.name) ? [
                    spellOptions((spell) => !spell.is_utility && spell.tier <= Number(text.match(/tier (\d+)/i)[1])),
                    spellOptions((spell) => spell.is_utility)
                  ]
                : f.name === "At Any Cost" ? spellPair("Necrotic")
                : f.name === "Tempest Mage" ? spellPair("Wind")
                : f.name === "Electrical Dedication" ? [spellOptions((spell) => spell.school === "Fire" && !spell.is_utility && spell.tier <= rules.maxTier({ ...current, level: f.level }))]
                : f.name === "Elemental Avatar" ? Array.from({ length: 3 }, avatarOptions)
                : f.name === "Mighty Avatar" ? [avatarOptions()]
                : /^I Know Just the Song/.test(f.name) ? ["Wind", featurePicks[JSON.stringify([className, "", 2, "Wind Spellcasting and…"])]]
                    .filter(Boolean).map((school) => spellOptions((spell) => spell.school === school && spell.is_utility))
                : f.name === "A “People“ Person" ? [[], []]
                : two ? [availableOptions, availableOptions] : [availableOptions];
            let hasSpellChoices = false;
            for (const [slot, pool] of pools.entries()) {
              const storedKey = slot === 0 ? key : `${key}:${slot}`;
              if (pool.length && pool.every((option) => option.spell)) {
                const available = pool.map(({ spell }) => spell).filter((spell) => rules.availability(spell, current) !== "known");
                if (!available.length) continue;
                hasSpellChoices = true;
                const choice = { feature: f, storedKey, spells: available };
                for (const spell of choice.spells) {
                  if (!spellChoices.has(spell)) spellChoices.set(spell, []);
                  spellChoices.get(spell).push(choice);
                }
                continue;
              }
              const label = node("label", "character-feature-note");
              label.append(node("span", "", `Your pick${pools.length > 1 ? ` ${slot + 1}` : ""} for ${f.name} (level ${f.level})`));
              const select = node("select");
              const options = new Map(pool.map((option) => [option.name, option]));
              if (f.name === "A “People“ Person") {
                const input = node("input");
                input.maxLength = 120;
                input.value = featurePicks[storedKey] ?? "";
                input.addEventListener("change", () => { featurePicks[storedKey] = input.value; autosave(); });
                label.append(input);
                item.append(label);
                continue;
              }
              select.dataset.featurePick = storedKey;
              select.add(new Option("Not selected", ""));
              for (const name of options.keys()) select.add(new Option(name, name));
              select.add(new Option("Other — record in notes", "__custom"));
              const explanation = node("p", "feature-description");
              selectedOptions.push({ feature: f, options, storedKey, select, explanation });
              select.addEventListener("change", () => {
                const value = select.value;
                if (select.selectedOptions[0]?.disabled) {
                  refreshFeaturePicks();
                  return;
                }
                const { duplicates } = rules.resolveFeaturePicks(selectedOptions, featurePicks, knownFeatures);
                for (const duplicate of duplicates) delete featurePicks[duplicate];
                featurePicks[storedKey] = value;
                autosave();
                if (value === "__custom") byId("my-notes-panel").open = true;
                if (/^Wind Spellcasting/.test(f.name) || f.name === "Beastmaster Companion") {
                  render();
                  [...featureChoices.querySelectorAll("select")].find((item) => item.dataset.featurePick === storedKey)?.focus();
                  return;
                }
                refreshFeaturePicks();
                renderAbilities();
              });
              label.append(select);
              item.append(label, explanation);
            }
            if (hasSpellChoices) {
              const hint = node("p", "character-note", "Choose the spells for this feature in the ");
              const link = node("a", "", "Selectable spells below");
              link.href = "#my-selectable-spells";
              link.addEventListener("click", (event) => {
                event.preventDefault();
                const panel = byId("my-selectable-spells");
                if (!panel) {
                  byId("my-spells-title")?.focus();
                  return;
                }
                openSections.add("spells");
                panel.open = true;
                panel.querySelector("summary").focus();
              });
              hint.append(link, ".");
              item.append(hint);
            }
          }
          list.append(item);
        }
        return list;
      };
      const choices = features.filter((f) => f.choice && f.name !== "Hexbinder Subclass");
      const subclassLabel = subclass || "Choose subclass";
      byId("my-choices-summary").textContent = `Feature Choices · ${choices.length} ${choices.length === 1 ? "option" : "options"}${subclassSelect.disabled ? "" : ` · ${subclassLabel}`}`;
      if (choices.length) featureChoices.append(makeFeatureList(choices));
      refreshFeaturePicks();
      renderAbilities();
      const notes = node("div", "class-sheet-notes");
      for (const note of data.notes) {
        const card = node("aside", "class-sheet-note");
        const description = note.name === "Making Your Own People"
          ? "With GM approval, create your own people in place of the defaults: one combat ally with damage that scales by level, one out-of-combat helper, one narrative contact, and one who provides occasional utility."
          : note.description;
        card.append(node("span", "keyword-badge", "Class note"), node("strong", "", ` ${note.name}`),
          node("p", "feature-description", description),
          node("small", "", `PDF page ${note.page}`));
        notes.append(card);
      }
      if (notes.childElementCount) output.append(optional("class-notes", "Class sheet notes & hints", notes));

      if (entries.length || spellChoices.size) {
        spellOutput.append(node("p", "character-note", rules.explanation(current)));
        const keyFor = (spell) => JSON.stringify([className, subclass, spell.school, spell.name]);
        const states = new Map(entries.map(({ spell, state }) => [spell, state]));
        for (const spell of spellChoices.keys()) if (!states.has(spell)) states.set(spell, "option");
        const chosenIn = (spell, slot) => featurePicks[slot.storedKey] === spell.name;
        const occupied = (slot) => slot.spells.some((spell) => chosenIn(spell, slot));
        const learned = (spell) => Boolean(picks[keyFor(spell)] && states.get(spell) === "option") ||
          spellChoices.get(spell)?.some((slot) => chosenIn(spell, slot));
        const cards = [...states].map(([spell, state]) => ({
          spell, state: state === "option" && learned(spell) ? "known" : state
        }));
        const isSelectable = ({ spell }) => !learned(spell) &&
          (states.get(spell) === "option" || (states.get(spell) === "conditional" && spellChoices.has(spell)));
        const selectable = cards.filter(isSelectable);
        const characterSpells = cards.filter((entry) => !isSelectable(entry));
        const decorateCard = (card, spell) => {
          const slots = spellChoices.get(spell) || [];
          const state = states.get(spell);
          if (state === "known" || (state !== "option" && !slots.length)) return;
          if (slots.length) {
            const assigned = slots.filter((slot) => chosenIn(spell, slot));
            const sources = [...new Set((assigned.length ? assigned : slots)
              .map(({ feature }) => `${feature.name} (Level ${feature.level})`))];
            card.append(node("p", "character-note", `${assigned.length ? "Learned via" : "Can learn via"}: ${sources.join("; ")}`));
          }
          const label = node("label", "character-pick");
          const checkbox = node("input");
          checkbox.type = "checkbox";
          checkbox.value = keyFor(spell);
          checkbox.checked = Boolean(learned(spell));
          checkbox.disabled = !checkbox.checked && slots.length > 0 && slots.every(occupied);
          checkbox.addEventListener("change", () => {
            const learning = checkbox.checked;
            const scrollTop = window.scrollY;
            if (checkbox.closest("#my-selectable-spells")?.open) openSections.add("spells");
            if (learning) {
              const next = slots.filter((slot) => !occupied(slot)).sort((a, b) => a.spells.length - b.spells.length)[0];
              if (next) featurePicks[next.storedKey] = spell.name;
              else if (!slots.length) picks[keyFor(spell)] = true;
            } else {
              delete picks[keyFor(spell)];
              for (const slot of slots) if (chosenIn(spell, slot)) delete featurePicks[slot.storedKey];
            }
            render();
            autosave();
            const replacement = [...spellOutput.querySelectorAll(".character-pick input")].find((input) =>
              input.value === keyFor(spell) && !input.disabled);
            const panel = replacement?.closest("#my-selectable-spells");
            if (learning) {
              const focusTarget = byId("my-selectable-spells")?.querySelector("summary") || replacement;
              focusTarget?.focus({ preventScroll: true });
              window.scrollTo({ top: scrollTop, behavior: "instant" });
            } else if (panel && !panel.open) panel.querySelector("summary").focus();
            else (replacement || byId("my-spells-title"))?.focus();
          });
          label.append(checkbox, document.createTextNode(` Learned: ${spell.name}`));
          card.append(label);
          if (checkbox.disabled) card.append(node("p", "character-note", "All matching feature picks are in use."));
        };
        const section = heading("Character spells", characterSpells.length
          ? spellList(characterSpells, decorateCard)
          : node("p", "character-note", "No spells known yet. Choose from Selectable spells below."));
        section.firstElementChild.id = "my-spells-title";
        section.firstElementChild.tabIndex = -1;
        spellOutput.append(section);
        if (selectable.length) {
          const panel = optional("spells", `Selectable spells (${selectable.length})`, spellList(selectable, decorateCard));
          panel.id = "my-selectable-spells";
          spellOutput.append(panel);
        }
      } else {
        spellOutput.append(node("p", "character-note", "No spells are listed for this class, subclass, and level."));
      }
      if (subclass.endsWith(" (story)")) output.append(node("p", "character-note", "Story-based subclasses require GM approval."));
    }
  }

  classSelect.addEventListener("change", () => { updateSubclass(); render(); autosave(); });
  subclassSelect.addEventListener("change", () => { render(); autosave(); });
  levelSelect.addEventListener("change", () => { updateLevel(); render(); autosave(); });
  manaInput.addEventListener("input", () => {
    const resource = rules.castingResource(character());
    if (!resource.stat) return;
    manaStats[resource.stat] = manaInput.value;
    updateMana(resource);
  });
  manaInput.addEventListener("change", () => autosave());

  function showProfile(name) {
    activeName = name;
    refreshProfiles(name);
    updateProfileControls();
    const saved = Object.hasOwn(profiles, name) ? profiles[name] : null;
    nameInput.value = name;
    classSelect.value = saved?.className || "";
    levelSelect.value = String(saved?.level || 1);
    updateSubclass(saved?.subclass);
    ancestrySelect.value = saved?.ancestry || "";
    backgroundSelect.value = saved?.background || "";
    secondBackground.value = saved?.secondBackground || "";
    backgroundSpell.value = saved?.backgroundSpell || "";
    extraAbilities = saved?.extraAbilities?.map((row) => ({ ...row })) ??
      (saved?.extras || "").split("\n").map((line) => line.trim()).filter(Boolean)
        .map((name) => ({ kind: "Other", name, description: "" }));
    resetExtraForm();
    renderExtraChoices();
    renderOrigins();
    picks = { ...saved?.picks };
    featurePicks = { ...saved?.featurePicks };
    manaStats = { ...saved?.manaStats };
    const legacyNotes = Object.entries(saved?.featureNotes || {}).flatMap(([key, text]) => {
      if (!text) return [];
      const [, , level, feature] = JSON.parse(key);
      featurePicks[key] ??= "__custom";
      return [`${feature} (Level ${level}): ${text}`];
    });
    notePages = saved?.notePages?.length
      ? saved.notePages.map((page) => ({ ...page }))
      : [{ title: "General", text: saved?.notes ?? legacyNotes.join("\n\n") }];
    activeNotePage = 0;
    renderNotePages();
    render();
    savedSnapshot = saved ? JSON.stringify(currentProfile()) : "";
    status.textContent = saved ? `Loaded ${name}. Changes save automatically.`
      : "Choose a class and name, then select Create character.";
  }

  function updateProfileControls() {
    saveButton.disabled = profileBusy;
    saveButton.textContent = activeName ? "Save now" : "Create character";
    profileSelect.disabled = profileBusy;
    deleteButton.hidden = !activeName;
    deleteButton.disabled = profileBusy;
    classSelect.options[0].disabled = Boolean(activeName);
  }

  function setProfileBusy(busy) {
    profileBusy = busy;
    updateProfileControls();
  }

  async function loadAccountProfiles() {
    setProfileBusy(true);
    status.textContent = "Loading your Tavern characters…";
    try {
      profiles = await accountStore.load();
      refreshProfiles(activeName);
      status.textContent = "Create or select a character to save changes to your Tavern account.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      setProfileBusy(false);
    }
  }

  function currentProfile() {
    return { ...character(), notePages: notePages.map((page) => ({ ...page })),
      ancestry: ancestrySelect.value, background: backgroundSelect.value, secondBackground: secondBackground.value,
      backgroundSpell: backgroundSpell.value, extraAbilities: extraAbilities.map((entry) => ({ ...entry })),
      picks: { ...picks }, featurePicks: { ...featurePicks }, manaStats: { ...manaStats } };
  }

  function queueSave(requestedName) {
    const profile = currentProfile();
    const snapshot = JSON.stringify(profile);
    writes = writes.then(async () => {
      const previousName = activeName;
      const name = requestedName ?? previousName;
      if (!name || !profile.className) {
        status.textContent = "Choose a class and enter a name to save.";
        return false;
      }
      if (name === previousName && snapshot === savedSnapshot) return true;
      if (name !== previousName && Object.hasOwn(profiles, name)) {
        status.textContent = "That name already exists. Choose a different name.";
        return false;
      }

      status.textContent = `Saving ${name}…`;
      try {
        const next = { ...profiles };
        if (previousName) delete next[previousName];
        const updated = { ...next, [name]: profile };
        if (accountStore) await accountStore.save(name, profile, previousName || null);
        else localStorage.setItem(storageKey, JSON.stringify(updated));
        profiles = updated;
        savedSnapshot = snapshot;
        activeName = name;
        if (name !== previousName) refreshProfiles(name);
        updateProfileControls();
        status.textContent = `Saved ${name} to ${accountStore ? "your Tavern account" : "this browser"}.`;
        return true;
      } catch (error) {
        status.textContent = accountStore ? error.message
          : "This browser does not allow saving profiles. Your changes are still on screen.";
        return false;
      }
    });
    return writes;
  }

  function autosave() {
    if (activeName) queueSave();
  }

  nameInput.addEventListener("blur", () => {
    const name = nameInput.value.trim();
    nameInput.value = name;
    if (activeName && name !== activeName && !profileBusy) queueSave(name);
  });
  saveButton.addEventListener("click", async () => {
    if (activeName) {
      queueSave(nameInput.value.trim());
      return;
    }
    setProfileBusy(true);
    const name = nameInput.value.trim();
    nameInput.value = name;
    if (await queueSave(name)) autosave();
    setProfileBusy(false);
  });

  profileSelect.addEventListener("change", async () => {
    const nextName = profileSelect.value;
    if (nextName === activeName) return;
    profileSelect.value = activeName;
    setProfileBusy(true);
    if (!activeName) {
      showProfile(nextName);
      setProfileBusy(false);
      profileSelect.focus();
      return;
    }
    let pending = queueSave(nameInput.value.trim());
    let saved = await pending;
    while (pending !== writes) {
      pending = writes;
      saved = await pending;
    }
    if (saved) showProfile(nextName);
    setProfileBusy(false);
    profileSelect.focus();
  });

  deleteButton.addEventListener("click", async () => {
    if (!activeName || !window.confirm(`Delete “${activeName}” and all its notes? This cannot be undone.`)) return;
    setProfileBusy(true);
    editor.inert = true;
    try {
      await writes;
      const name = activeName;
      const next = { ...profiles };
      delete next[name];
      if (accountStore) await accountStore.remove(name);
      else localStorage.setItem(storageKey, JSON.stringify(next));
      profiles = next;
      showProfile("");
      status.textContent = `Deleted ${name}.`;
    } catch (error) {
      status.textContent = accountStore ? error.message : "This browser does not allow deleting profiles.";
    } finally {
      editor.inert = false;
      setProfileBusy(false);
      profileSelect.focus();
    }
  });
  updateProfileControls();
  updateSubclass();
  renderNotePages();
  renderOrigins();
  render();
  if (accountStore) {
    function loadWhenOpened() {
      if (location.hash !== "#character") return;
      window.removeEventListener("hashchange", loadWhenOpened);
      loadAccountProfiles();
    }
    window.addEventListener("hashchange", loadWhenOpened);
    loadWhenOpened();
  }
})();
