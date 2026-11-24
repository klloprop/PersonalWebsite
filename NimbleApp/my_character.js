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
  const createButton = byId("my-create");
  const deleteButton = byId("my-delete");
  const editor = byId("my-character-title").closest(".library");
  let profiles = {};
  let activeName = "";
  let savedSnapshot = "";
  let writes = Promise.resolve(true);
  let profileBusy = false;
  let picks = {};
  let manaStats = {};
  const sheetRules = window.CharacterSheetRules;
  let sheet = {};
  let sheetTotals;
  let pendingLevel = 0;
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
    const secondary = rules.secondaryResource(current);
    const artificer = current.className === "Manawright (Artificer)";
    byId("my-resource-label").textContent = artificer ? "Max Mana Dice" : "Mana";
    byId("my-mana-box").hidden = !resource.stat && Boolean(secondary);
    byId("my-tier-box").hidden = Boolean(secondary) && (!resource.stat || artificer);
    byId("my-dice-box").hidden = !secondary;
    byId("my-dice-label").textContent = secondary?.label || "";
    byId("my-dice").textContent = secondary?.value || "";
    byId("my-casting").hidden = false;
    byId("my-mana-stat-field").hidden = !resource.stat;
    byId("my-mana-stat-label").textContent = resource.stat ? `Current ${resource.stat} score` : "";
    manaInput.value = manaStats[resource.stat] ?? sheetTotals?.stats[resource.stat]?.total ?? "";
    manaInput.placeholder = "From sheet";
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
        if (entry.page) addAbilityEdit(item, `ability:origin:${JSON.stringify([kind, entry.name])}`);
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
    if (feature.replacement === "Arcane Command") return rules.arcaneCommandOptions(data.catalogs["Commander’s Orders"], spells);
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
    if (name === "Powerful Mind" || name === "Shieldstorm") return data.catalogs["Psionic Abilities"]
      .filter((option) => option.requiredLevel > 0 && option.requiredLevel <= feature.level);
    if (name === "Fit for Any Battlefield") return [
      ...data.catalogs["Commander’s Orders"].filter((option) => option.tactic),
      ...(feature.level > 2 ? [{ name: "+1 max Combat Die", description: "Increase your maximum Combat Dice by 1.", page: feature.page, repeatable: true }] : [])
    ];
    if (name === "Commander’s Orders") return data.catalogs[name].filter((option) => !option.tactic);
    if (name === "Afflictions") return data.catalogs[name].filter(({ name: option }) =>
      !["Withered", "Frenzied"].includes(option) && !(option === "Pestilent" && current.subclass === "The Hex" && feature.level >= 11));
    if (["Hexbinder’s Familiar", "Empowered Familiar", "Mighty Familiar"].includes(name)) return data.catalogs["Familiar Boons"];
    if (feature.subclass === "Elemental Lord" && name === "Elemental Mastery") return data.catalogs["Elemental Prowess"];
    if (!feature.subclass && name === "Elemental Mastery") return direct(["Fire", "Ice", "Lightning"]);
    if (name === "Old Habits…") return data.catalogs["Underhanded Ability"] || [];
    if (name === "Eureka!") return [...rules.artificerCatalog(data, "Eureka!"), ...rules.artificerCatalog(data, "Gadgets")];
    if (name === "Chimeric Boon") return data.catalogs[name].slice(0, data.catalogs[name].findIndex(({ activation }) => activation));
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

  function writeSheet(key, value) {
    if (value === "") delete sheet[key];
    else sheet[key] = value;
    autosave();
  }

  function sheetInput(label, key, { value = sheet[key] ?? "", type = "number", choices, onChange, multiline, className = "" } = {}) {
    const field = node("label", "sheet-control", label);
    if (className) field.classList.add(className);
    const input = node(choices ? "select" : multiline ? "textarea" : "input");
    input.dataset.sheetField = key;
    if (choices) {
      for (const [option, caption] of choices) input.add(new Option(caption, option));
    } else if (multiline) {
      input.rows = 3;
      input.maxLength = 4000;
    } else {
      input.type = type;
      if (type === "number") {
        input.step = "1";
        input.min = "-9999";
        input.max = "9999";
      } else input.maxLength = 400;
    }
    input.value = value;
    input.addEventListener("change", () => {
      if (!input.reportValidity()) return;
      if (onChange) onChange(input.value);
      else writeSheet(key, input.value);
      if (key === "preset" || key === "weaponCatalog") input.value = "";
      renderSheet(character(), currentFeatures(), true);
    });
    field.append(input);
    return field;
  }

  function currentFeatures(current = character()) {
    const data = classIndex[current.className];
    const companionSize = featurePicks[JSON.stringify([current.className, current.subclass, 3, "Beastmaster Companion"])];
    return data ? rules.unlockedFeatures(data.features, { ...current, companionSize }) : [];
  }

  function sheetValue(name, { parts, total }, { suffix = "", caption = "", signed = false } = {}) {
    const card = node("div", "sheet-value");
    const breakdown = parts.filter(([, value], index) => value !== 0 || !index)
      .map(([source, value]) => `${source}: ${value >= 0 ? "+" : ""}${value}`).join(" · ");
    const tooltip = node("span", "sheet-breakdown", breakdown);
    tooltip.id = `sheet-breakdown-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    tooltip.setAttribute("role", "tooltip");
    card.tabIndex = 0;
    card.setAttribute("aria-describedby", tooltip.id);
    card.append(node("span", "sheet-label", name), node("output", "", `${signed && total >= 0 ? "+" : ""}${total}${suffix}`));
    if (caption) card.append(node("small", "sheet-caption", caption));
    card.append(tooltip);
    return card;
  }

  function renderVitals(metrics, hitDie, refreshOnly) {
    const groups = [
      ["my-health-values", [
        ["currentHP", "Current HP", metrics["Max HP"].total],
        ["tempHP", "Temp HP", 0],
        ["Max HP"],
        ["wounds", "Wounds taken", 0],
        ["Max Wounds"],
        ["currentHitDice", "Hit Dice left", metrics["Hit Dice"].total],
        ["Hit Dice", undefined, undefined, ` × d${hitDie}`, "Max Hit Dice"]
      ]],
      ["my-combat-values", [
        ["currentActions", "Actions left", metrics.Actions.total],
        ["Actions", undefined, undefined, "", "Max Actions"], ["Defense"], ["Initiative"], ["Speed", undefined, undefined, " spaces"]
      ]]
    ];
    for (const [id, fields] of groups) {
      const wrapper = byId(id);
      const cards = fields.map(([key, label, fallback, suffix, heading]) => {
        if (!label) return sheetValue(heading ?? key, metrics[key], { suffix });
        const field = sheetInput(label, key, { className: "sheet-tracker" });
        const input = field.querySelector("input");
        input.placeholder = String(fallback);
        input.title = `Defaults to ${fallback} when left blank`;
        return field;
      });
      if (!refreshOnly) {
        wrapper.replaceChildren(...cards);
        continue;
      }
      cards.forEach((card, index) => {
        const existing = wrapper.children[index];
        if (existing.classList.contains("sheet-tracker")) {
          const input = existing.querySelector("input");
          const next = card.querySelector("input");
          input.placeholder = next.placeholder;
          input.title = next.title;
        } else {
          existing.querySelector("output").textContent = card.querySelector("output").textContent;
          existing.querySelector(".sheet-breakdown").textContent = card.querySelector(".sheet-breakdown").textContent;
        }
      });
    }
  }

  function sheetGrid(...content) {
    const grid = node("div", "sheet-grid");
    grid.append(...content);
    return grid;
  }

  function sheetOptions(values, empty) {
    return Object.keys(values).map((value) => [value, value || empty]);
  }

  function renderSheet(current, features, refreshOnly = false) {
    const { className, subclass, level } = current;
    const panel = byId("my-sheet");
    panel.hidden = !className;
    if (!className) {
      sheetTotals = undefined;
      return;
    }
    const [keyStats, , , saves, starterArmor, starterShield, starterWeapons, starterGear] = sheetRules.classes[className];
    const ancestry = ancestries.get(ancestrySelect.value);
    byId("my-sheet-subtitle").textContent = [nameInput.value.trim(), `${className} · Level ${level}`, subclass,
      ancestry?.name].filter(Boolean).join(" · ");
    byId("my-level-up").disabled = level >= 20;
    sheetTotals = sheetRules.derived(current, sheet, features, featurePicks);
    const { stats, metrics, skills, hitDie } = sheetTotals;
    renderVitals(metrics, hitDie, refreshOnly);

    const statFields = byId("my-sheet-stat-fields");
    const base = sheetRules.baseArray(className, "Standard");
    const [advantage, disadvantage] = saves.split(" ");
    const saveMode = (stat) => sheet[`save:${stat}`] ?? (stat === advantage ? "Advantage" : stat === disadvantage ? "Disadvantage" : "Normal");
    byId("my-sheet-attributes").replaceChildren(...sheetRules.stats.map((stat) => {
      const value = stats[stat];
      const isKey = keyStats.split(" ").includes(stat);
      const save = saveMode(stat);
      return sheetValue(stat, value, { signed: true,
        caption: `${isKey ? "Key stat · " : ""}Base ${value.parts[0][1] >= 0 ? "+" : ""}${value.parts[0][1]}${save !== "Normal" ? ` · ${save} on saves` : ""}` });
    }));
    byId("my-sheet-skills").replaceChildren(...Object.entries(skills).map(([skill, value]) => sheetValue(skill, value, { signed: true })));
    const preset = sheetInput("Apply a starting array", "preset", {
      value: "", choices: [["", "Choose a preset"], ...sheetOptions(sheetRules.arrays)],
      onChange: (choice) => {
        if (!choice) return;
        for (const [stat, value] of Object.entries(sheetRules.baseArray(className, choice))) sheet[`base:${stat}`] = String(value);
        autosave();
      }
    });
    const statCards = sheetRules.stats.map((stat) => {
      const card = node("div", "");
      card.append(
        sheetInput(`${stat} base`, `base:${stat}`, { value: sheet[`base:${stat}`] ?? base[stat] }),
        sheetInput(`${stat} manual bonus`, `bonus:${stat}`),
        sheetInput(`${stat} save`, `save:${stat}`, { value: saveMode(stat),
          choices: ["Normal", "Advantage", "Disadvantage"].map((value) => [value, value]) }));
      return card;
    });
    const grants = sheetRules.skillGrants(level, sheet);
    const allocated = Object.keys(skills).reduce((sum, skill) => sum + grants[skill] + sheetRules.number(sheet[`skill:${skill}`]), 0);
    const budget = level - 1 + sheetRules.number(sheet.extraSkillPoints);
    const skillsGrid = sheetGrid(...Object.keys(skills).map((skill) => sheetInput(`${skill} points / adjustment`, `skill:${skill}`)));
    const skillBudget = `${allocated} allocated · ${budget} available from levels and optional points. Overrides are allowed.`;
    if (refreshOnly) {
      for (const stat of sheetRules.stats) {
        statFields.querySelector(`[data-sheet-field="base:${stat}"]`).value = sheet[`base:${stat}`] ?? base[stat];
      }
      statFields.querySelector(".character-note").textContent = skillBudget;
    } else {
      statFields.replaceChildren(preset, sheetGrid(...statCards), node("h3", "", "Skills"),
        node("p", "character-note", skillBudget), sheetInput("Extra skill points", "extraSkillPoints"), skillsGrid);
      const final = sheetRules.capstone(features);
      if (final) {
        const options = [["", "Choose a stat"], ...sheetRules.stats.map((stat) => [stat, stat])];
        statFields.prepend(sheetGrid(sheetInput(`${final.name}: first +1`, "capstoneFirst", { choices: options }),
          sheetInput(`${final.name}: second +1`, "capstoneSecond", { choices: options })));
      }
    }
    for (const [key, other] of [["capstoneFirst", "capstoneSecond"], ["capstoneSecond", "capstoneFirst"]]) {
      const input = statFields.querySelector(`[data-sheet-field="${key}"]`);
      if (input) for (const option of input.options) option.disabled = Boolean(option.value && option.value === sheet[other]);
    }

    const gear = byId("my-sheet-gear-fields");
    const applyGear = node("button", "school-button", "Use class starting gear");
    applyGear.type = "button";
    applyGear.addEventListener("click", () => {
      if (["armor", "shield", "weapons", "inventory"].some((key) => sheet[key]) &&
          !window.confirm("Replace your equipped armor, shield, weapons, and inventory with the class starting gear?")) return;
      Object.assign(sheet, sheetRules.startingGear(className));
      autosave();
      renderSheet(current, features);
      gear.querySelector("button")?.focus({ preventScroll: true });
    });
    const addWeapon = sheetInput("Add a weapon from the catalog", "weaponCatalog", {
      value: "", choices: [["", "Choose a weapon"], ...sheetOptions(sheetRules.weapons)],
      onChange: (weapon) => { if (weapon) writeSheet("weapons", [sheet.weapons, weapon].filter(Boolean).join(", ")); }
    });
    const equipment = byId("my-sheet-equipped");
    const splitItems = (text, separator) => (text || "").split(separator).map((item) => item.trim()).filter(Boolean);
    const itemCard = (name, kind) => {
      const card = node("li", "sheet-item");
      card.append(node("span", "sheet-label", kind), node("strong", "", name));
      return card;
    };
    const armorName = sheet.armor || "Unarmored";
    const armorCard = itemCard(armorName, "Armor");
    const equipped = splitItems(sheet.weapons, /\r?\n|,\s*(?![^()]*\))/);
    equipment.replaceChildren(armorCard);
    if (sheet.shield) equipment.append(itemCard(sheet.shield, "Shield"));
    for (const weapon of equipped.length ? equipped : ["Unarmed Strike"]) {
      const entry = Object.hasOwn(sheetRules.weapons, weapon) && sheetRules.weapons[weapon];
      const card = itemCard(weapon, equipped.length ? "Weapon" : "Unarmed");
      equipment.append(card);
      if (!entry) continue;
      const [dice, statNames, reach] = entry;
      const modifiers = statNames.split("/").map((stat) => `${dice}${stats[stat].total >= 0 ? "+" : ""}${stats[stat].total} (${stat})`);
      const attack = node("div", "sheet-item-action");
      attack.append(node("span", "sheet-label", "Attack · 1 action"), node("strong", "", modifiers.join(" or ")), node("span", "", reach));
      card.append(attack);
    }
    const inventory = splitItems(sheet.inventory, sheet.inventory?.includes("\n") ? /\r?\n/ : /,\s*(?![^()]*\))/);
    byId("my-sheet-inventory").replaceChildren(...(inventory.length ? inventory : ["Nothing carried yet"]).map((item) => node("li", "", item)));
    byId("my-sheet-purse").replaceChildren(
      node("strong", "sheet-gold", `${sheetRules.number(sheet.gold)} gp`),
      sheetValue("Inventory slots", metrics["Inventory slots"], { caption: `${sheetRules.number(sheet.usedSlots)} used` }));
    if (refreshOnly) {
      gear.querySelector('[data-sheet-field="weapons"]').value = sheet.weapons ?? "";
      gear.querySelector('[data-sheet-field="customArmor"]').parentElement.hidden = sheet.armor !== "Custom";
    } else {
      const customArmor = sheetInput("Custom armor Defense", "customArmor");
      customArmor.hidden = sheet.armor !== "Custom";
      gear.replaceChildren(node("p", "character-note", `Starting gear: ${[starterArmor, starterShield, starterWeapons, starterGear].filter(Boolean).join(", ")}. Alternatively, start with ${25 * level} gp to buy gear. Add background gear or custom items below.`),
        applyGear, sheetGrid(sheetInput("Armor", "armor", { choices: sheetOptions(sheetRules.armor, "Unarmored") }),
          sheetInput("Shield", "shield", { choices: sheetOptions(sheetRules.shields, "No shield") }),
          customArmor, sheetInput("Gold (gp)", "gold"), sheetInput("Inventory slots used", "usedSlots")),
        addWeapon, sheetInput("Equipped weapons (comma or line separated; custom text allowed)", "weapons", { multiline: true }),
        sheetInput("Inventory and carried gear", "inventory", { multiline: true }));
    }

    const adjustments = byId("my-sheet-adjustments");
    const climbs = features.some(({ name }) => name === "Explorer of the Wilds") ? " Class movement: climbing Speed (Explorer of the Wilds)." : "";
    const movement = [sheet.movement, climbs && "Climbing Speed"].filter(Boolean).join(" · ");
    byId("my-sheet-traits-summary").replaceChildren(...[
      ["Known languages", sheet.languages?.trim() || "Common"], ["Size", sheet.size || ancestry?.size || "Medium"],
      ["Movement", [`${metrics.Speed.total} spaces`, movement].filter(Boolean).join(" · ")]
    ].map(([label, text]) => {
      const pair = node("div", "");
      pair.append(node("dt", "sheet-label", label), node("dd", "", text));
      return pair;
    }));
    const languageHint = `Common plus ${Math.max(0, stats.INT.total)} additional language(s) from INT.${climbs} Add ancestry or custom movement and bonuses here.`;
    if (refreshOnly) adjustments.querySelector(".character-note").textContent = languageHint;
    else adjustments.replaceChildren(
      sheetGrid(sheetInput("Size", "size", { type: "text", value: sheet.size ?? ancestry?.size ?? "Medium" }),
        sheetInput("Other movement (climb, swim, fly)", "movement", { type: "text" }),
        sheetInput("Languages", "languages", { type: "text", value: sheet.languages ?? "Common" })),
      node("p", "character-note", languageHint),
      node("h3", "", "Manual adjustments"),
      sheetGrid(...Object.keys(metrics).map((name) => sheetInput(`${name} bonus`, `bonus:${name}`))));
    const resource = rules.castingResource(current);
    if (resource.stat && !manaStats[resource.stat] && manaInput !== document.activeElement) {
      manaInput.value = stats[resource.stat].total;
      updateMana(resource);
    }
  }

  function addAbilityEdit(item, key) {
    const override = sheet[key];
    const details = node("details", "sheet-ability-edit");
    details.append(node("summary", "", override !== undefined ? "Edit rules override" : "Customize ability rules"));
    const field = node("label", "sheet-control", "Custom rules (leave blank to restore the original)");
    const input = node("textarea");
    input.value = override ?? "";
    input.rows = 2;
    input.maxLength = 4000;
    const save = node("button", "school-button", "Apply rules override");
    save.type = "button";
    save.addEventListener("click", () => {
      writeSheet(key, input.value.trim());
      if (key.startsWith("ability:origin:")) renderOrigins();
      else render();
    });
    field.append(input);
    details.append(field, save);
    if (override !== undefined) {
      const original = node("details", "sheet-ability-edit");
      original.append(node("summary", "", "Original rules"));
      for (const child of [...item.children].slice(1).filter((child) => !child.classList.contains("arsenal-badge"))) original.append(child);
      item.append(node("p", "feature-description", override), original);
    }
    item.append(details);
  }

  function closeLevelGuide() {
    pendingLevel = 0;
    byId("my-level-guide").hidden = true;
    byId("my-sheet-status").textContent = "";
  }

  function previewLevel() {
    const current = character();
    const subclass = pendingLevel === 3 ? byId("my-level-subclass").value : current.subclass;
    const old = new Set(currentFeatures(current).map((row) => JSON.stringify([row.level, row.subclass, row.name])));
    const next = { ...current, level: pendingLevel, subclass };
    const fresh = [...currentFeatures(next), ...rules.automaticAbilities(classIndex[current.className], next).filter(({ level }) => level === pendingLevel)].filter((row, index, rows) =>
      rows.findIndex((other) => other.name === row.name && other.level === row.level) === index &&
      !old.has(JSON.stringify([row.level, row.subclass, row.name])));
    const list = byId("my-new-features");
    list.replaceChildren(...fresh.map((row) => {
      const item = node("li", "", `${row.name}${row.choice ? " · choice" : ""}`);
      if (row.description) item.append(node("p", "character-note", row.description));
      return item;
    }));
    if (!fresh.length) list.append(node("li", "", "No additional features listed at this level."));
  }

  byId("my-level-up").addEventListener("click", () => {
    const { className, level } = character();
    if (!className || level >= 20) return;
    pendingLevel = level + 1;
    byId("my-level-guide-title").textContent = `Level up to ${pendingLevel}`;
    byId("my-level-hp").value = sheet[`hp:${pendingLevel}`] ?? sheetRules.classes[className][1] / 2;
    byId("my-level-roll-result").textContent = "The default is the flat HP increase. Roll or enter your own result.";
    byId("my-level-skill").replaceChildren(new Option("Allocate later", ""));
    for (const skill of Object.keys(sheetRules.skills)) byId("my-level-skill").add(new Option(skill));
    byId("my-level-skill").value = sheet[`levelSkill:${pendingLevel}`] || "";
    const subclass = byId("my-level-subclass");
    subclass.replaceChildren(new Option("Choose later", ""));
    for (const option of rules.classes[className]) subclass.add(new Option(option));
    byId("my-level-subclass-field").hidden = pendingLevel !== 3;
    byId("my-level-guide").hidden = false;
    previewLevel();
    byId("my-level-guide-title").focus();
  });
  byId("my-level-subclass").addEventListener("change", previewLevel);
  byId("my-level-roll").addEventListener("click", () => {
    const size = sheetRules.classes[character().className][1];
    const roll = () => Math.floor(Math.random() * size) + 1;
    const first = roll(), second = roll();
    byId("my-level-hp").value = Math.max(first, second);
    byId("my-level-roll-result").textContent = `Rolled ${first} and ${second}; kept ${Math.max(first, second)}.`;
  });
  byId("my-level-cancel").addEventListener("click", () => {
    closeLevelGuide();
    byId("my-level-up").focus();
  });
  byId("my-level-apply").addEventListener("click", () => {
    const current = character();
    if (pendingLevel !== current.level + 1 || pendingLevel > 20 || !byId("my-level-hp").reportValidity()) return;
    const level = pendingLevel;
    const skill = byId("my-level-skill").value;
    sheet[`hp:${level}`] = String(sheetRules.number(byId("my-level-hp").value, sheetRules.classes[current.className][1] / 2));
    if (skill) sheet[`levelSkill:${level}`] = skill;
    else delete sheet[`levelSkill:${level}`];
    const subclass = level === 3 ? byId("my-level-subclass").value : current.subclass;
    closeLevelGuide();
    levelSelect.value = String(level);
    updateSubclass(subclass);
    render();
    autosave();
    byId("my-sheet-status").textContent = `Level ${level} applied. Review any new picks in Feature Choices.`;
    if (sheetRules.capstone(currentFeatures())) {
      byId("my-sheet-stats").open = true;
      byId("my-sheet-status").textContent = `Level ${level} applied. Choose your two stat increases in Stats, saves & skills.`;
      byId("my-sheet-stats").querySelector('[data-sheet-field="capstoneFirst"]')?.focus();
      return;
    }
    const choices = byId("my-choices");
    choices.open = true;
    const latest = featureChoices.querySelector(`[data-unlock-level="${level}"] select:not(:disabled)`);
    (latest || byId("my-choices-summary")).focus();
  });
  function spellList(entries, decorateCard, describeSpell) {
    const list = node("div", "character-spell-list");
    window.SpellbookCards.renderSpellGroups(list, entries.map(({ spell, state }) => ({
      spell, availability: state, description: describeSpell?.(spell)
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
    const features = currentFeatures(current);
    renderSheet(current, features);
    if (data) {
      const entries = spells.flatMap((spell) => {
        const state = rules.availability(spell, current);
        return state ? [{ spell, state }] : [];
      });
      renderCasting(current, entries);
      const selectedOptions = [];
      const upgradeSlots = [];
      const automatic = rules.automaticAbilities(data, current);
      const replacedByAbility = new Set(automatic.filter(({ name }) =>
        ["Psionic Strike", "Thunder Gauntlets"].includes(name)).map(({ name }) => name));
      const knownFeatures = [...features.filter((feature) => !feature.choice).map(({ name }) => name),
        ...automatic.filter(({ source }) => !["Pestilential Reign", "Chimeric Sovereign"].includes(source)).map(({ name }) => name)];
      const optionRows = (beforeLevel = Infinity) => {
        const { duplicates } = rules.resolveFeaturePicks(selectedOptions, featurePicks, knownFeatures);
        return selectedOptions.flatMap(({ feature, storedKey, options }) => {
          const pick = options.get(featurePicks[storedKey]);
          return pick && feature.level <= beforeLevel && !duplicates.includes(storedKey)
            ? [{ ...pick, level: feature.level, subclass: feature.subclass, source: feature.replacement || feature.name }] : [];
        });
      };
      function refreshFeaturePicks() {
        const { claimed, duplicates } = rules.resolveFeaturePicks(selectedOptions, featurePicks, knownFeatures);
        for (const { storedKey, options, select, explanation } of selectedOptions) {
          for (const item of select.options) {
            const option = options.get(item.value);
            if (!option) continue;
            item.disabled = !option.repeatable && claimed.has(option.name) && claimed.get(option.name) !== storedKey;
            const spell = option.spell;
            const label = spell ? `${option.name} (${spell.tier ? "tier 1" : spell.is_utility ? "utility cantrip" : "cantrip"})` : option.name;
            item.textContent = item.disabled ? `${label} (already learned)` : label;
          }
          const value = featurePicks[storedKey];
          select.value = !duplicates.includes(storedKey) && (options.has(value) || value === "__custom") ? value : "";
          const pick = options.get(select.value);
          explanation.textContent = pick?.description || pick?.spell?.description || "";
          explanation.hidden = !explanation.textContent;
        }
      }
      const spellChoices = new Map();
      const unlocked = node("div", "ability-categories");
      const unlockedSection = heading("Unlocked class features", unlocked);
      output.append(unlockedSection);
      function renderAbilities() {
        unlocked.replaceChildren();
        const selected = optionRows().filter(({ description }) => description)
          .map((row) => ({ ...row, category: /^Savage Arsenal\b/.test(row.source) ? "Attacks & combat actions" : featureCategory(row) }));
        const uniquePicks = selected.filter((item, index) => selected.findIndex((other) =>
          other.name === item.name && other.page === item.page && other.description === item.description) === index);
        const granted = automatic.filter((row) => !uniquePicks.some((pick) => pick.name === row.name));
        const upgrades = upgradeSlots.map(({ select, options }) => options.get(select.value)).filter(Boolean);
        const groups = groupFeatures([...features.filter((f) => (!f.choice && !replacedByAbility.has(f.name)) ||
          /^(?:Fit for Any Battlefield|Weapon Mastery|Shadowrime|We’ll ALL Burn!|Electrical Dedication|(?:Mighty |Elemental )Avatar|Elemental Prowess)$/.test(f.name)), ...uniquePicks, ...granted]
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
            const summary = rules.abilityUpgradeSummary(className, name, features) ||
              (rows[0].subclass || source ? null : rules.featureSummary(current, name, rows));
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
              for (const upgrade of upgrades.filter(({ target }) => target === row.name)) {
                const line = node("p", "feature-description");
                line.append(node("strong", "", `Upgrade: ${upgrade.upgrade}. `), document.createTextNode(upgrade.description));
                detail.append(line);
              }
              progression.append(detail);
            }
            addAbilityEdit(item, `ability:class:${JSON.stringify([className, rows[0].subclass, name])}`);
            list.append(item);
          }
          section.append(node("h3", "", category), list);
          unlocked.append(section);
        }
        unlockedSection.hidden = !unlocked.childElementCount;
      }
      function rerenderPick(key) {
        render();
        [...featureChoices.querySelectorAll("select")].find((item) => item.dataset.featurePick === key)?.focus();
      }
      const makeFeatureList = (items) => {
        const list = node("ul", "character-feature-list");
        const applied = new Set();
        for (const f of items) {
          const listed = choiceOptions(f, data, entries, current).some((option) => option.description);
          const item = node("li", listed ? "arsenal-feature" : "");
          item.dataset.unlockLevel = String(f.level);
          item.append(node("span", "keyword-badge", `Level ${f.level}`), node("strong", "", ` ${f.name}`),
            node("small", "", ` · ${f.sourceLabel || f.subclass || className} · PDF page ${f.page}`));
          if (listed) item.append(document.createTextNode(" "), node("span", "keyword-badge arsenal-badge", "Ability choice"));
          if (f.description) item.append(node("p", "feature-description", f.description));
          // Reuse the old level-3 storage key for the first Gambit so saved picks survive.
          const pickLevel = f.name === "Honorable Gambits" && f.level === 4 ? 3 : f.level;
          const key = JSON.stringify([className, f.subclass, pickLevel, f.name]);
          if (f.name === "Constant Tinkering" || f.name === "Aetheric Infusions (2)") {
            const pool = rules.upgradeOptions(f, [...automatic, ...optionRows(f.level)], applied);
            const options = new Map(pool.map((option) => [option.name, option]));
            const label = node("label", "character-feature-note");
            label.append(node("span", "", `Choose an upgrade for ${f.name} (level ${f.level})`));
            const select = node("select");
            select.dataset.featurePick = key;
            select.add(new Option(pool.length ? "No upgrade selected" : "No eligible upgrades", ""));
            for (const name of options.keys()) select.add(new Option(name, name));
            select.value = options.has(featurePicks[key]) ? featurePicks[key] : "";
            select.disabled = !pool.length;
            if (select.value) applied.add(select.value);
            select.addEventListener("change", () => {
              featurePicks[key] = select.value;
              autosave();
              rerenderPick(key);
            });
            label.append(select);
            item.append(label);
            if (select.value) item.append(node("p", "feature-description", options.get(select.value).description));
            upgradeSlots.push({ select, options });
          } else if (f.choice || f.name === "Shieldstorm") {
            if (f.name === "Shieldstorm") {
              const grant = rules.shieldstormGrant(data, optionRows(f.level));
              if (grant) {
                automatic.push(grant);
                knownFeatures.push(grant.name);
                list.append(item);
                continue;
              }
            }
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
              ? [rules.artificerCatalog(data, "Eureka!"), rules.artificerCatalog(data, "Gadgets")]
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
              if (!f.replacement) select.add(new Option("Other — record in notes", "__custom"));
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
                if (f.replacement || /^(?:Wind Spellcasting|Eureka!|Powerful Mind)/.test(f.name) || f.name === "Beastmaster Companion") {
                  rerenderPick(storedKey);
                  return;
                }
                refreshFeaturePicks();
                renderAbilities();
                if (/(?:key|secondary) stat/i.test(f.name)) renderSheet(current, features);
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
      const choices = features.filter((f) => (f.choice && f.name !== "Hexbinder Subclass" &&
        !(subclass === "Fang & Claw" && f.level >= 15 && /^Chimeric Boon/.test(f.name))) ||
        ["Aetheric Infusions (2)", "Shieldstorm"].includes(f.name));
      const subclassLabel = subclass || "Choose subclass";
      byId("my-choices-summary").textContent = `Feature Choices · ${choices.length} ${choices.length === 1 ? "option" : "options"}${subclassSelect.disabled ? "" : ` · ${subclassLabel}`}`;
      if (choices.length) featureChoices.append(makeFeatureList(choices));
      if (subclass === "Spellblade (story)") {
        for (const [spell, slots] of spellChoices) {
          if (slots.some(({ storedKey }) => featurePicks[storedKey] === spell.name)) knownFeatures.push(spell.name);
        }
      }
      const appliedUpgrades = new Set(upgradeSlots.map(({ select }) => select.value).filter(Boolean));
      for (const { select } of upgradeSlots) {
        for (const option of select.options) {
          if (option.value && option.value !== select.value && appliedUpgrades.has(option.value)) option.disabled = true;
        }
      }
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
        const arcaneSpells = new Map(optionRows().filter(({ spell, source }) => spell && source === "Arcane Command")
          .map(({ spell, level }) => [spell, level]));
        for (const spell of arcaneSpells.keys()) states.set(spell, "known");
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
          if (arcaneSpells.has(spell)) {
            card.append(node("p", "character-note", `Learned via: Arcane Command (Level ${arcaneSpells.get(spell)}). Change this pick in Feature Choices.`));
            return;
          }
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
        const describeSpell = (spell) => rules.characterSpellDescription(spell, className, features);
        const section = heading("Character spells", characterSpells.length
          ? spellList(characterSpells, decorateCard, describeSpell)
          : node("p", "character-note", "No spells known yet. Choose from Selectable spells below."));
        section.firstElementChild.id = "my-spells-title";
        section.firstElementChild.tabIndex = -1;
        spellOutput.append(section);
        if (selectable.length) {
          const panel = optional("spells", `Selectable spells (${selectable.length})`, spellList(selectable, decorateCard, describeSpell));
          panel.id = "my-selectable-spells";
          spellOutput.append(panel);
        }
      } else {
        spellOutput.append(node("p", "character-note", "No spells are listed for this class, subclass, and level."));
      }
      if (subclass.endsWith(" (story)")) output.append(node("p", "character-note", "Story-based subclasses require GM approval."));
    }
  }

  classSelect.addEventListener("change", () => { closeLevelGuide(); updateSubclass(); render(); autosave(); });
  subclassSelect.addEventListener("change", () => { closeLevelGuide(); render(); autosave(); });
  levelSelect.addEventListener("change", () => { closeLevelGuide(); updateLevel(); render(); autosave(); });
  ancestrySelect.addEventListener("change", () => renderSheet(character(), currentFeatures()));
  manaInput.addEventListener("input", () => {
    const resource = rules.castingResource(character());
    if (!resource.stat) return;
    if (manaInput.value === "") delete manaStats[resource.stat];
    else manaStats[resource.stat] = manaInput.value;
    updateMana(resource);
  });
  manaInput.addEventListener("change", () => {
    if (!manaInput.value) {
      const resource = rules.castingResource(character());
      manaInput.value = sheetTotals?.stats[resource.stat]?.total ?? "";
      updateMana(resource);
    }
    autosave();
  });

  function showProfile(name) {
    closeLevelGuide();
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
    sheet = { ...saved?.sheet };
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
      : "Choose Create Character for guided setup, or fill out the sheet manually.";
  }

  function updateProfileControls() {
    saveButton.disabled = profileBusy;
    saveButton.textContent = activeName ? "Save now" : "Save manual sheet";
    createButton.disabled = profileBusy;
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
      picks: { ...picks }, featurePicks: { ...featurePicks }, manaStats: { ...manaStats }, sheet: { ...sheet } };
  }

  async function persistProfile(name, profile, previousName = null) {
    const remaining = { ...profiles };
    if (previousName) delete remaining[previousName];
    const updated = { ...remaining, [name]: profile };
    if (accountStore) await accountStore.save(name, profile, previousName);
    else localStorage.setItem(storageKey, JSON.stringify(updated));
    profiles = updated;
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
        await persistProfile(name, profile, previousName || null);
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

  const createDialog = byId("my-create-dialog");
  const createForm = byId("my-create-form");
  const createFields = byId("my-create-fields");
  const createTitle = byId("my-create-title");
  const createError = byId("my-create-error");
  const createBack = byId("my-create-back");
  const createNext = byId("my-create-next");
  const createCancel = byId("my-create-cancel");
  const createSteps = ["Choose a class", "Choose your origin", "Set base stats", "Choose starting equipment", "Name and review"];
  let draft;
  let createStep = 0;
  let creating = false;

  function createField(label, key, { choices, type = "text", required = false, change } = {}) {
    const field = node("label", "sheet-control", label);
    const input = node(choices ? "select" : "input");
    if (choices) {
      for (const [value, caption] of choices) input.add(new Option(caption, value));
    } else if (type === "number") {
      input.type = type;
      input.min = "-9999";
      input.max = "9999";
    } else {
      input.maxLength = 80;
    }
    input.required = required;
    input.value = draft[key] ?? "";
    input.addEventListener("input", () => { draft[key] = input.value; });
    if (change) input.addEventListener("change", () => change(input.value));
    field.append(input);
    return field;
  }

  function renderCreateStep() {
    createError.textContent = "";
    byId("my-create-progress").textContent = `Step ${createStep + 1} of ${createSteps.length}`;
    createTitle.textContent = createSteps[createStep];
    createBack.hidden = createStep === 0;
    createNext.textContent = createStep === createSteps.length - 1 ? "Create Character" : "Next";
    const hint = (text) => node("p", "character-note", text);
    const view = (value) => [...value.keys()].sort().map((name) => [name, name]);
    if (createStep === 0) {
      createFields.replaceChildren(hint("Your character starts at level 1. You can level up or set another level on the finished sheet."),
        createField("Class", "className", { required: true,
          choices: [["", "Choose a class"], ...sheetOptions(rules.classes)], change: () => { draft.base = null; } }));
    } else if (createStep === 1) {
      createFields.replaceChildren(hint("Choose an ancestry and background now, or leave them for later."),
        createField("Ancestry", "ancestry", { choices: [["", "Choose later"], ...view(ancestries)] }),
        createField("Background", "background", { choices: [["", "Choose later"], ...view(backgrounds)] }));
    } else if (createStep === 2) {
      const setArray = (name) => {
        draft.base = sheetRules.baseArray(draft.className, name);
        for (const stat of sheetRules.stats) draft[stat] = String(draft.base[stat]);
      };
      if (!draft.base) setArray(draft.array = "Standard");
      const preset = createField("Starting array", "array", {
        choices: [...sheetOptions(sheetRules.arrays), ["Custom", "Custom"]],
        change: (name) => {
          if (name !== "Custom") setArray(name);
          renderCreateStep();
        }
      });
      const scores = sheetRules.stats.map((stat) => {
        const field = createField(stat, stat, { type: "number", required: true });
        field.querySelector("input").addEventListener("input", () => {
          draft.array = "Custom";
          preset.querySelector("select").value = draft.array;
        });
        return field;
      });
      createFields.replaceChildren(hint(`Key stats: ${sheetRules.classes[draft.className][0].replace(" ", " and ")}. Choose an array or edit the scores.`),
        preset, sheetGrid(...scores));
    } else if (createStep === 3) {
      const gear = Object.values(sheetRules.startingGear(draft.className)).filter(Boolean).join(", ");
      createFields.replaceChildren(createField("Starting equipment", "equipment", { choices: [
        ["class", "Class starting gear"], ["gold", "25 gp to buy equipment"], ["custom", "Add my own later"]
      ] }), hint(`Class starting gear: ${gear}. You can edit equipment and add background gear on the finished sheet.`));
    } else {
      const review = node("ul", "sheet-list");
      for (const text of [
        `Level 1 ${draft.className}`, `Ancestry: ${draft.ancestry || "Choose later"}`, `Background: ${draft.background || "Choose later"}`,
        sheetRules.stats.map((stat) => `${stat} ${draft[stat]}`).join(" · "),
        { class: "Class starting gear", gold: "25 gp", custom: "Equipment to be added later" }[draft.equipment]
      ]) review.append(node("li", "", text));
      createFields.replaceChildren(createField("Character name", "name", { required: true }), review);
    }
    createFields.scrollTop = 0;
    createTitle.focus();
  }

  function positionCreateDialog() {
    const frame = window.frameElement;
    if (!frame?.matches(".nimble-reference") || !createDialog.open) return;
    const rect = frame.getBoundingClientRect();
    const top = Math.max(0, -rect.top);
    const bottom = Math.min(rect.height, window.parent.innerHeight - rect.top);
    if (bottom <= top) return;
    createDialog.style.setProperty("--create-top", `${top + 8}px`);
    createDialog.style.setProperty("--create-height", `${bottom - top - 16}px`);
  }

  const createViewport = window.frameElement?.matches(".nimble-reference") ? window.parent : null;
  createButton.addEventListener("click", () => {
    draft = { className: "", ancestry: "", background: "", equipment: "class", name: "" };
    createStep = 0;
    createDialog.showModal();
    positionCreateDialog();
    createViewport?.addEventListener("scroll", positionCreateDialog, { passive: true });
    createViewport?.addEventListener("resize", positionCreateDialog);
    renderCreateStep();
  });
  createDialog.addEventListener("close", () => {
    if (createDialog.open) return;
    createViewport?.removeEventListener("scroll", positionCreateDialog);
    createViewport?.removeEventListener("resize", positionCreateDialog);
    draft = null;
  });
  createDialog.addEventListener("cancel", (event) => {
    if (creating) event.preventDefault();
  });
  createCancel.addEventListener("click", () => createDialog.close());
  createBack.addEventListener("click", () => {
    createStep -= 1;
    renderCreateStep();
  });
  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (creating) return;
    if (createStep < createSteps.length - 1) {
      createStep += 1;
      renderCreateStep();
      return;
    }
    const name = draft.name.trim();
    if (!name) {
      createError.textContent = "Enter a character name.";
      createFields.querySelector("input").focus();
      return;
    }
    const newSheet = Object.fromEntries(sheetRules.stats.map((stat) => [`base:${stat}`, draft[stat]]));
    if (draft.equipment === "class") Object.assign(newSheet, sheetRules.startingGear(draft.className));
    else if (draft.equipment === "gold") newSheet.gold = "25";
    const profile = {
      className: draft.className, level: 1, subclass: "", ancestry: draft.ancestry, background: draft.background,
      secondBackground: "", backgroundSpell: "", notePages: [{ title: "General", text: "" }],
      extraAbilities: [], picks: {}, featurePicks: {}, manaStats: {}, sheet: newSheet
    };
    creating = true;
    setProfileBusy(true);
    createCancel.disabled = createBack.disabled = createNext.disabled = true;
    createError.textContent = "Saving your character…";
    try {
      await writes;
      if (Object.hasOwn(profiles, name)) {
        createError.textContent = "That name already exists. Choose a different name.";
        createFields.querySelector("input").focus();
        return;
      }
      await persistProfile(name, profile);
      showProfile(name);
      createDialog.close();
      status.textContent = `Saved ${name} to ${accountStore ? "your Tavern account" : "this browser"}.`;
      byId("my-sheet-title").focus();
    } catch (error) {
      createError.textContent = accountStore ? error.message : "This browser does not allow saving profiles. Your choices are still here.";
    } finally {
      creating = false;
      setProfileBusy(false);
      createCancel.disabled = createBack.disabled = createNext.disabled = false;
    }
  });

  nameInput.addEventListener("blur", () => {
    const name = nameInput.value.trim();
    nameInput.value = name;
    if (character().className) renderSheet(character(), currentFeatures(), true);
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
