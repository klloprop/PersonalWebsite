const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const sheetRules = require("./sheet.js");
const { availability, castingResource, featureCategory, maxTier, featureSummary, rageSummary,
  unlockedFeatures, resolveFeaturePicks, companionOptions, epicBoons,
  artificerCatalog, automaticAbilities, upgradeOptions, shieldstormGrant, secondaryResource,
  abilityUpgradeSummary, characterSpellDescription, arcaneCommandOptions } = require("./character.js");

const offlineHtml = readFileSync(join(__dirname, "Nimble-Spellbook-Offline.html"), "utf8");
const classSheets = JSON.parse(offlineHtml.match(/<script id="offline-features" type="application\/json">(.*?)<\/script>/s)[1]);

test("play spell timing separates defense reactions, dual-mode casting and rituals", () => {
  const timing = (description, casting_time, tier) => sheetRules.spellTiming({ description, casting_time, tier });
  assert.deepEqual(timing("Castable only while Defending.", "0 Actions", 3),
    { modes: ["exploration", "reactions"], reactionCost: 3 });
  assert.deepEqual(timing("Cast as a Reaction for 1 mana.", "1 Action", 0),
    { modes: ["exploration", "actions", "reactions"], reactionCost: 1 });
  assert.deepEqual(timing("Spend one hour preparing.", "1 hour", 2).modes, ["exploration"]);
});

test("combat passives can appear in both combat tabs without promoting exploration or active abilities", () => {
  const exploration = new Set(["exploration"]);
  assert.equal(sheetRules.isCombatPassive("", "Gain advantage on ranged attacks.", exploration), true);
  assert.equal(sheetRules.isCombatPassive("", "Advantage on checks to find food and water.", exploration), false);
  assert.equal(sheetRules.isCombatPassive("", "Discern the events of a past encounter by studying tracks.", exploration), false);
  assert.equal(sheetRules.isCombatPassive("Reaction", "Reduce damage from an attack.", new Set(["reactions"])), false);
});

test("ability cost labels distinguish explicit costs, triggered effects, and missing rules", () => {
  assert.equal(sheetRules.abilityCost({ activation: "2 Actions" }, "actions"), "2 actions");
  assert.equal(sheetRules.abilityCost({ activation: "0 Actions" }, "actions"), "Free action");
  assert.equal(sheetRules.abilityCost({ description: "Free Reaction. Help an ally." }, "reactions"), "Free reaction");
  assert.equal(sheetRules.abilityCost({ description: "Reaction. Push your ally." }, "reactions"), "1 action");
  assert.equal(sheetRules.abilityCost({ description: "2 actions: Reaction." }, "reactions"), "2 actions");
  assert.equal(sheetRules.abilityCost({ description: "Castable only while Defending." }, "reactions"), "When Defending");
  assert.equal(sheetRules.abilityCost({ activation: "Passive" }, "actions"), "Passive");
  assert.equal(sheetRules.abilityCost({ description: "An ally gains 1 action." }, "actions"), "No listed cost");
});

test("KEY uses the highest current class KEY stat and ignores higher secondary stats", () => {
  const character = { className: "Hexbinder", subclass: "", level: 7 };
  const features = unlockedFeatures(classSheets.Hexbinder.features, character);
  const extras = [{ name: "Potent Bloom" }];
  const sheet = { "base:INT": "2", "base:WIL": "3", "base:DEX": "8", "bonus:INT": "2" };
  const totals = sheetRules.derived(character, sheet, [...features.filter((f) => f.name !== "Potent Bloom"), ...extras], {});
  assert.equal(totals.key, 4);
  assert.equal(totals.metrics["Hit Dice"].total, 11);
  assert.equal(sheetRules.derived(character, { ...sheet, "bonus:WIL": "2" }, [], {}).key, 5);
});

test("KEY resolves fixed arithmetic but preserves dice and key stat choice wording", () => {
  assert.equal(sheetRules.resolveKey("10+KEY damage; 2×KEY temp HP; 1d8+KEY HP; choose a KEY stat.", 3),
    "13 damage; 6 temp HP; 1d8+3 HP; choose a KEY stat.");
  assert.equal(sheetRules.resolveKey("1d8 + KEY HP; gain +KEY damage.", -1), "1d8 -1 HP; gain -1 damage.");
});

test("sheet totals separate starting stats, feature picks, and manual bonuses", () => {
  const character = { className: "Commander", subclass: "", level: 4 };
  const features = unlockedFeatures(classSheets.Commander.features, character);
  const increase = features.find(({ name }) => name === "Key Stat Increase");
  assert.ok(increase);
  const picks = { [JSON.stringify([character.className, "", increase.level, increase.name])]: "STR" };
  const result = sheetRules.derived(character, { "base:STR": "3", "bonus:STR": "1", "base:DEX": "4",
    armor: "Rusty Mail", shield: "Wooden Buckler" }, features, picks);
  assert.deepEqual(result.stats.STR.parts, [["Base", 3], ["Manual bonus", 1], [`Key Stat Increase (level ${increase.level})`, 1]]);
  assert.equal(result.metrics.Defense.total, 10);
  assert.equal(result.metrics.Initiative.total, 4);
  assert.equal(result.metrics["Inventory slots"].total, 15);
  assert.equal(result.skills.Examination.total, 3);
});

test("sheet respects recorded advancement and does not apply it before its level", () => {
  const model = { "hp:2": "7", "levelSkill:2": "Might", "hp:4": "8", "levelSkill:4": "Might",
    capstoneFirst: "STR", capstoneSecond: "INT" };
  const at = (level) => {
    const character = { className: "Commander", level };
    return sheetRules.derived(character, model, unlockedFeatures(classSheets.Commander.features, character), {});
  };
  assert.equal(at(1).metrics["Max HP"].total, 17);
  assert.equal(at(2).metrics["Max HP"].total, 24);
  assert.equal(at(3).metrics["Max HP"].total, 29);
  assert.equal(at(3).skills.Might.total, 3);
  assert.equal(at(4).skills.Might.total, 4);
  assert.equal(at(19).stats.STR.total, 2);
  assert.equal(at(20).stats.STR.total, 3);
});

test("Spellblade replaces tactic and mastery choices without granting a pick for automatic mastery", () => {
  const { features } = classSheets.Commander;
  const at = (level, subclass = "Spellblade (story)") => unlockedFeatures(features, { level, subclass });
  const replacements = (level) => at(level).filter(({ replacement }) => replacement === "Arcane Command");
  assert.ok(at(2).some(({ name }) => name === "Fit for Any Battlefield"));
  assert.equal(replacements(3).length, 1);
  assert.equal(replacements(3)[0].level, 3);
  assert.equal(replacements(6).filter(({ level }) => level === 6).length, 2);
  assert.deepEqual(replacements(20).map(({ level }) => level), [3, 6, 6, 8, 10, 10, 12, 16]);
  assert.ok(!at(20).some(({ name }) => /^(?:Fit for Any Battlefield|Weapon Mastery)/.test(name)));
  assert.ok(at(20).some(({ name }) => name === "Commander’s Orders"));
  assert.ok(at(6, "Bulwark").some(({ name }) => name === "Weapon Mastery"));
});

test("Arcane Command offers orders and public tier 1 or lower spells, not tactics", () => {
  const orders = classSheets.Commander.catalogs["Commander’s Orders"];
  const spells = [{ name: "Cantrip", school: "Wind", tier: 0 }, { name: "Tier one", school: "Fire", tier: 1 },
    { name: "Tier two", school: "Ice", tier: 2 }, { name: "Secret", school: "Radiant", tier: 1, is_secret: 1 },
    { name: "Class exclusive", school: "Hexbinder", tier: 1 }];
  const options = arcaneCommandOptions(orders, spells);
  assert.ok(options.some((row) => row === orders.find(({ tactic }) => !tactic)));
  assert.ok(!options.some(({ tactic }) => tactic));
  assert.deepEqual(options.flatMap(({ spell }) => spell ? [spell.name] : []), ["Cantrip", "Tier one"]);
});

test("Hex and Misery cards show only the upgrades the Hexbinder has unlocked", () => {
  const features = (level, subclass) => unlockedFeatures(classSheets.Hexbinder.features, { level, subclass });
  const hex = (level, subclass) => abilityUpgradeSummary("Hexbinder", "Hex", features(level, subclass));
  assert.equal(hex(4), null);
  assert.match(Object.fromEntries(hex(5))["Blightwielder’s Touch"], /advantage.*Reach 1/);
  assert.equal(Object.fromEntries(hex(7))["Cursed Fate"], undefined);
  assert.match(Object.fromEntries(hex(7, "The Sight"))["Cursed Fate"], /Double.*Futuresight Die/);
  assert.match(Object.fromEntries(hex(19))["On hit"], /LVL damage or apply 1 Affliction\./);
  assert.match(Object.fromEntries(hex(20))["On hit"], /LVL damage or apply 2 Afflictions\./);
  assert.match(Object.fromEntries(hex(20))["On crit"], /Afflictions and add LVL damage/);

  const spells = JSON.parse(offlineHtml.match(/<script id="offline-spells" type="application\/json">(.*?)<\/script>/s)[1]);
  const misery = spells.find(({ name, school }) => name === "Misery" && school === "Hexbinder");
  const base = misery.description;
  assert.equal(characterSpellDescription(misery, "Hexbinder", features(19)), base);
  assert.match(characterSpellDescription(misery, "Hexbinder", features(20)), /On hit: apply 2 Afflictions\. On crit: apply 3 Afflictions instead\./);
  assert.equal(characterSpellDescription(misery, "Mage", features(20)), base);
  assert.equal(misery.description, base);
});

test("Singularity updates all three affected Gravity abilities at level 15", () => {
  const summary = (name, level, subclass = "Gravity") => abilityUpgradeSummary("Psion", name,
    unlockedFeatures(classSheets.Psion.features, { level, subclass }));
  assert.equal(summary("Gravity Well", 14), null);
  assert.equal(summary("Gravity Well", 15, "Bladestorm"), null);
  assert.match(Object.fromEntries(summary("Gravity Well", 15)).Movement, /2 spaces per Strain Die.*2 Strain instead.*Large/);
  assert.match(Object.fromEntries(summary("Catastrophic Release", 15))["When Concentration ends"], /2 spaces per Strain Die.*at least 2 spaces.*Prone/);
  assert.match(Object.fromEntries(summary("Crushing Mass", 15))["Free reaction, once per round"], /1 Strain.*Weakened 10 or gain 2 Strain.*Weakened 20/);
});

test("Constant Tinkering offers unused upgrades only for items learned by that level", () => {
  const data = classSheets["Manawright (Artificer)"];
  const gauntlets = artificerCatalog(data, "Eureka!").find(({ name }) => name === "Thunder Gauntlets");
  const stim = artificerCatalog(data, "Gadgets").find(({ name }) => name === "Stim Bot");
  assert.match(gauntlets.description, /1d6 \+ INT.*Mishap/);
  const learned = [{ ...gauntlets, level: 2 }, { ...stim, level: 4 }];
  const used = new Set(["Thunder Gauntlets — Extended Arc Coils"]);
  const names = (level) => upgradeOptions({ name: "Constant Tinkering", level }, learned, used).map(({ name }) => name);
  assert.deepEqual(names(3), ["Thunder Gauntlets — Kinetic Redirect", "Thunder Gauntlets — Paired Resonators"]);
  assert.ok(names(4).includes("Stim Bot — Improved Dosing"));
});

test("subclass items and automatic catalog abilities unlock at their printed levels", () => {
  const grants = (className, level, subclass) => automaticAbilities(classSheets[className], { className, level, subclass });
  const artificer = "Manawright (Artificer)";
  assert.deepEqual(grants(artificer, 2).map(({ name }) => name), ["Thunder Gauntlets"]);
  const alchemy = (level) => grants(artificer, level, "Alchemist").filter(({ subclass }) => subclass === "Alchemist");
  assert.deepEqual(alchemy(3).map(({ name }) => name), ["Aetheric Infuser", "Alchemist’s Fire", "Propulsion Potion"]);
  assert.equal(alchemy(15).length, 8);
  assert.ok(alchemy(7).some(({ name }) => name === "Cryowall"));
  const upgrades = upgradeOptions({ name: "Aetheric Infusions (2)", level: 7 }, alchemy(7), new Set());
  assert.equal(upgrades.length, 3);
  assert.ok(upgrades.every(({ target }) => target === "Aetheric Infuser"));
  assert.ok(grants(artificer, 3, "Gadgeteer").some(({ name }) => name === "Cheer Bot"));
  assert.ok(grants(artificer, 3, "Inventor").some(({ name }) => name === "Tethercoil"));
  assert.ok(grants(artificer, 3, "Chronurgist").some(({ name }) => name === "Chronal Device"));
  assert.deepEqual(grants("Hexbinder", 1).map(({ name }) => name), ["Frenzied", "Withered"]);
  assert.ok(grants("Hexbinder", 11, "The Hex").some(({ name }) => name === "Pestilent"));
  assert.equal(grants("Psion", 1)[0].name, "Psionic Strike");
  const bastion = shieldstormGrant(classSheets.Psion, []);
  assert.match(bastion.description, /Shield/);
  assert.equal(shieldstormGrant(classSheets.Psion, [bastion]), null);
  assert.equal(grants("Stormshifter", 14, "Fang & Claw").length, 0);
  assert.equal(grants("Stormshifter", 15, "Fang & Claw").length, 9);
});

test("resource summaries reflect dice upgrades and subclass exceptions", () => {
  const resource = (className, level, subclass) => secondaryResource({ className, level, subclass });
  assert.equal(resource("Manawright (Artificer)", 13).value, "d8");
  assert.equal(resource("Manawright (Artificer)", 20).value, "d10");
  assert.equal(resource("Manawright (Artificer)", 20, "Inventor").value, "d12");
  assert.match(resource("Commander", 17).value, /^d20\b/);
  assert.equal(resource("Commander", 17, "Spellblade (story)"), null);
  assert.match(resource("Berserker", 17, "Burning Rage").value, /^d4\b/);
  assert.match(resource("Berserker", 17).value, /^d12\b/);
  assert.equal(resource("Oathsworn", 14).value, "3d20");
  assert.equal(resource("Hexbinder", 17, "The Sight").value, "3d8");
  assert.equal(resource("Psion", 13).value, "d10");
});

test("Beastmaster automatically replaces the first two Hunt picks at level 3", () => {
  const { features } = classSheets.Hunter;
  const atLevel = (level, subclass = "Beastmaster (story)") => unlockedFeatures(features, { level, subclass });
  assert.ok(atLevel(2).some(({ name, choice }) => name === "Thrill of the Hunt" && choice));
  assert.ok(!atLevel(2).some(({ name }) => name === "Protect Me!"));
  const unlocked = atLevel(4);
  assert.ok(!unlocked.some(({ name }) => name === "Thrill of the Hunt"));
  assert.ok(unlocked.some(({ name, choice }) => name === "Thrill of the Hunt (2)" && choice));
  assert.ok(unlocked.some(({ name, choice }) => name === "Beastmaster Companion" && choice));
  for (const ability of ["Go for the Throat!", "Protect Me!"]) {
    const feature = unlocked.find(({ name }) => name === ability);
    assert.equal(feature?.level, 3);
    assert.equal(feature.choice, false);
    assert.equal(feature.source, "Beastmaster Companion");
    assert.equal(feature.sourceLabel, "Hunter 3.0");
    assert.ok(!atLevel(4, "Pack").some(({ name }) => name === ability));
  }
});

test("Beastmaster shows each size's playable rules and level upgrades", () => {
  const companion = (level, companionSize) => Object.fromEntries(
    unlockedFeatures(classSheets.Hunter.features, { subclass: "Beastmaster (story)", level, companionSize })
      .map(({ name, description }) => [name, description]));
  const attack = "Go for the Throat!";
  const defense = "Protect Me!";
  assert.match(companion(3, "Small companion")[defense], /misses\. Move half your Speed/);
  assert.match(companion(7, "Small companion")[defense], /2 use/);
  assert.match(companion(11, "Small companion")[attack], /1d4.*2 uses per encounter\.$/);
  assert.match(companion(15, "Small companion")[attack], /1d4.*3 uses per encounter\.$/);
  assert.match(companion(11, "Medium companion")[attack], /1 action.*1d8.*2 use/);
  assert.match(companion(3, "Medium companion")[defense], /Defend, first attack.*1d8 \+ LVL.*Once per encounter/);
  assert.match(companion(3, "Large companion")[defense], /after you take a Wound/);
  assert.match(companion(15, "Large companion")[defense], /before you take a Wound.*2 use/);
  assert.match(companion(11, "Large companion")[attack], /2 actions and 1 Thrill of the Hunt charge\..*1d12.*Reach 4.*2 use/);
  assert.match(companion(3)[attack], /Small companion:.*Medium companion:.*Large companion:/s);
  assert.match(companionOptions(15)[1].description, /move up to 6 spaces/);
  assert.deepEqual(companionOptions(3).map(({ sourceLabel, page }) => [sourceLabel, page]),
    Array(3).fill(["Hunter 3.0", 7]));
});

test("Epic Boon opens a playable picker for every class instead of referring to the GM guide", () => {
  for (const { features } of Object.values(classSheets)) {
    const boon = unlockedFeatures(features, { level: 20 }).find(({ name }) => name === "Epic Boon");
    assert.ok(boon?.choice);
    assert.doesNotMatch(boon.description, /see|consult|refer to/i);
  }
  assert.match(epicBoons.find(({ name }) => name === "Epic Resistance").description, /once per encounter.*failed save/i);
  const boons = Object.fromEntries(epicBoons.map(({ name, description }) => [name, description]));
  assert.match(boons["Epic Defense"], /3 extra Defense/);
  assert.match(boons["Epic Knowledge"], /Once per Safe Rest/);
  assert.match(boons["Epic Mind"], /maximum mana by 8/);
  assert.equal(boons["Epic Senses"], "Gain Blindsight 6.");
});

test("feature choices reserve learned abilities but allow repeatable bonuses", () => {
  const options = new Map([
    ["Fleet Feet", { name: "Fleet Feet" }],
    ["Go for the Throat!", { name: "Go for the Throat!" }],
    ["DEX", { name: "DEX", repeatable: true }],
  ]);
  const slots = ["first", "second", "automatic", "stat1", "stat2"].map((storedKey) => ({ storedKey, options }));
  const picks = { first: "Fleet Feet", second: "Fleet Feet", automatic: "Go for the Throat!", stat1: "DEX", stat2: "DEX" };
  const known = ["Go for the Throat!"];
  const result = resolveFeaturePicks(slots, picks, known);
  assert.deepEqual(result.duplicates, ["second", "automatic"]);
  assert.equal(result.claimed.get("Fleet Feet"), "first");
  assert.equal(result.claimed.get("Go for the Throat!"), null);
  assert.equal(resolveFeaturePicks(slots, { ...picks, first: "" }, known).claimed.get("Fleet Feet"), "second");
});

test("Legends and Honorseeker replace their normal choices without granting extra picks", () => {
  const legends = unlockedFeatures(classSheets.Songweaver.features, { subclass: "Legends (story)", level: 17 });
  assert.ok(legends.some(({ name }) => name === "Legend’s Tale"));
  assert.ok(!legends.some(({ name }) => name.startsWith("Lyrical Weaponry")));
  const cheat = classSheets["The Cheat"].features;
  const honorseeker = (level) => unlockedFeatures(cheat, { subclass: "The Honorseeker (story)", level });
  assert.ok(!honorseeker(3).some(({ name }) => name === "Honorable Gambits"));
  const veteran = honorseeker(18);
  assert.deepEqual(veteran.filter(({ name }) => name === "Honorable Gambits").map(({ level }) => level),
    cheat.filter(({ name }) => name.startsWith("Underhanded Ability")).map(({ level }) => level));
  assert.ok(veteran.some(({ name }) => name === "Old Habits…"));
  assert.ok(!veteran.some(({ name }) => name.startsWith("Underhanded Ability")));
});

test("fixed replacements take effect only when the replacement unlocks", () => {
  const names = (className, subclass, level) =>
    unlockedFeatures(classSheets[className].features, { subclass, level }).map(({ name }) => name);
  assert.ok(names("The Cheat", "Silent Blade", 10).includes("Leave No Trace"));
  const skulker = names("The Cheat", "Silent Blade", 11);
  assert.ok(skulker.includes("Professional Skulker"));
  assert.ok(!skulker.includes("Leave No Trace"));
  assert.ok(names("Commander", "", 19).includes("Unparalleled Tactics"));
  const commander = names("Commander", "", 20);
  assert.ok(commander.includes("Captain of Legions"));
  assert.ok(!commander.includes("Unparalleled Tactics"));
  const summary = Object.fromEntries(featureSummary({ className: "Commander", level: 20 },
    "Coordinated Strike!", [{ name: "Coordinated Strike!" }]));
  assert.match(summary.Strike, /INT allies/);
});

test("The Forge exchanges Necrotic for Fire, including utility spell choices", () => {
  const forge = { className: "Shepherd", subclass: "The Forge (story)", level: 6 };
  const utility = (school) => ({ school, tier: 0, is_utility: 1 });
  assert.equal(availability(utility("Fire"), forge), "option");
  assert.equal(availability(utility("Necrotic"), forge), null);
  assert.equal(availability(utility("Fire"), { ...forge, level: 11 }), "known");
  assert.equal(availability(utility("Necrotic"), { ...forge, subclass: "Mercy" }), "option");
  const choices = unlockedFeatures(classSheets.Shepherd.features, forge)
    .filter(({ name }) => name.startsWith("Master of Twilight"));
  assert.equal(choices.length, 2);
  for (const { description } of choices) {
    assert.match(description, /Fire/);
    assert.doesNotMatch(description, /Necrotic/);
  }
});

test("summarized features reflect current rules rather than older dice and limits", () => {
  const summary = (className, level, name) => Object.fromEntries(featureSummary({ className, level }, name, [{ description: "" }]));
  assert.match(summary("Oathsworn", 14, "Radiant Judgment")["Judgment Dice"], /3d20/);
  assert.match(summary("The Cheat", 17, "Sneak Attack")["On crit"], /\+3d20/);
  assert.match(summary("Commander", 13, "Coordinated Strike!").Strike, /INT \+ 2 extra uses/);
  assert.equal(summary("Zephyr", 5, "Iron Defense")["Unarmored Defense"], "(3×STR) + DEX");
});

test("linked upgrades consolidate current ability rules", () => {
  const summary = (className, level, name, titles) => Object.fromEntries(
    featureSummary({ className, level }, name, titles.map((title) => ({ name: title }))));
  assert.match(summary("Revenant", 1, "Spectral Blast", ["Spectral Blast"]).Attack, /while Dying/);
  const blast = summary("Revenant", 20, "Spectral Blast", ["Spectral Blast", "Empowered Blast"]).Attack;
  assert.match(blast, /twice your Wounds/);
  assert.doesNotMatch(blast, /while Dying/);
  assert.match(summary("The Cheat", 13, "Sneak Attack", ["Sneak Attack", "Twist the Blade", "Twist the Blade (2)"])["Twist the Blade"], /free once per turn/);
  assert.match(summary("Zephyr", 12, "Momentum", ["Momentum", "Kinetic Marvel"]).Movement, /2 damage per point/);
});

test("Rage summarizes current dice and end conditions without superseded rules", () => {
  const at = (level, subclass = "") => Object.fromEntries(rageSummary({ level, subclass }));
  assert.match(at(1).Rage, /1d4 Fury Die/);
  assert.match(at(17).Rage, /2d12 Fury Dice/);
  assert.match(at(17)["Ends when"], /drop to 0 HP/);
  assert.doesNotMatch(at(18)["Ends when"], /drop to 0 HP,/);
  assert.match(at(20)["While Raging"], /below 5 as 5/);
  const burning = at(20, "Burning Rage");
  assert.match(burning.Rage, /6d4 Fury Dice \(each counts as 5/);
  assert.match(burning["Overflowing Fury"], /Reach 4/);
  assert.match(burning["Level 20"], /when attacked/);
  assert.match(at(11, "Mountainheart")["Titan’s Fury"], /miss an attack/);
});

test("casting summary separates mana pools and special resources", () => {
  const mage = { className: "Mage", subclass: "Flame", level: 3 };
  assert.equal(maxTier(mage), 2);
  assert.deepEqual(castingResource(mage), { stat: "INT", multiplier: 3, bonus: 3, unit: "max mana" });
  assert.equal(castingResource({ className: "Hexbinder", level: 1 }).text, "No mana pool");
  assert.equal(castingResource({ className: "Shadowmancer", level: 7 }).text, "No mana pool; uses Pilfered Power.");
  assert.equal(castingResource({ className: "Commander", subclass: "Spellblade (story)", level: 7 }).unit, "mana at Initiative");
  assert.equal(castingResource({ className: "Manawright (Artificer)", subclass: "Inventor", level: 18 }).bonus, 3);
});

test("feature groups distinguish activation and purpose", () => {
  const category = (description) => featureCategory({ name: "Feature", description });
  assert.equal(featureCategory({ name: "Coordinated Strike!", description: "You and an ally each make a strike or cast a cantrip for free." }), "Attacks & combat actions");
  assert.equal(category("Action: Attack and deal 5 damage."), "Attacks & combat actions");
  assert.equal(category("Free Reaction: Allow an ally to reroll."), "Reactions");
  assert.equal(category("Whenever you Field Rest, friendly creatures heal."), "Utility & support");
  assert.equal(category("Your attacks deal +2 damage."), "Passives & upgrades");
});

function spell(school, tier, options = {}) {
  return { school, tier, name: "Example", is_utility: 0, is_secret: 0, ...options };
}
function character(className, level, subclass = "") {
  return { className, level, subclass };
}

test("mage progression and earlier dedicated-school unlocks", () => {
  assert.equal(availability(spell("Fire", 0), character("Mage", 1)), "known");
  assert.equal(availability(spell("Fire", 1), character("Mage", 1)), null);
  assert.equal(availability(spell("Fire", 2), character("Mage", 3, "Flame")), "known");
  assert.equal(availability(spell("Ice", 0), character("Mage", 3, "Flame")), null);
  assert.equal(availability(spell("Fire", 0, {is_utility: 1}), character("Mage", 3)), "option");
  assert.equal(availability(spell("Ice", 2), character("Mage", 7, "Flame")), "option");
});

test("chosen extra schools and utility spells are options", () => {
  assert.equal(availability(spell("Ice", 1), character("Songweaver", 2)), "option");
  assert.equal(availability(spell("Wind", 0, {is_utility: 1}), character("Songweaver", 2)), null);
  assert.equal(availability(spell("Wind", 0, {is_utility: 1}), character("Songweaver", 3)), "option");
  assert.equal(availability(spell("Ice", 1), character("Stormshifter", 3, "Sky & Storm")), "option");
  assert.equal(availability(spell("Fire", 0, {is_utility: 1}), character("Stormshifter", 4, "Cinder & Ash")), "option");
  assert.equal(availability(spell("Wind", 1), character("Stormshifter", 3, "Cinder & Ash")), "option");
});

test("class-exclusive spells, replacements and conditional castings", () => {
  assert.equal(availability(spell("Hexbinder", 1), character("Hexbinder", 1)), null);
  assert.equal(availability(spell("Hexbinder", 1), character("Hexbinder", 2)), "known");
  assert.equal(availability(spell("Fire", 2), character("Hexbinder", 4)), "option");
  assert.equal(availability(spell("Radiant", 1, {name: "Heal"}), character("Oathsworn", 3, "Oathbreaker (story)")), null);
  assert.equal(availability(spell("Necrotic", 1, {name: "Shadow Trap"}), character("Oathsworn", 3, "Oathbreaker (story)")), "known");
  assert.equal(availability(spell("Necrotic", 0, {is_utility: 1}), character("Oathsworn", 7, "Oathbreaker (story)")), "option");
  assert.equal(availability(spell("Ice", 4, {name: "Rimeblades"}), character("Shadowmancer", 7, "Abyssal Depths")), "conditional");
  assert.equal(availability(spell("Ice", 4, {name: "Rimeblades"}), character("Shadowmancer", 10, "Abyssal Depths")), "known");
  assert.equal(availability(spell("Muscle Mage", 0), character("Berserker", 3, "Muscle Mage (story)")), "conditional");
  assert.equal(availability(spell("Fire", 1, {is_secret: 1}), character("Mage", 2)), "conditional");
  assert.equal(availability(spell("Radiant", 1), character("Berserker", 3)), null);
  assert.equal(availability(spell("Songweaver", 0, {name: "Legend’s Tale"}), character("Songweaver", 2)), null);
  assert.equal(availability(spell("Songweaver", 0, {name: "Legend’s Tale"}), character("Songweaver", 3, "Legends (story)")), "known");
});
