const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { availability, castingResource, featureCategory, maxTier, featureSummary, rageSummary,
  unlockedFeatures, resolveFeaturePicks, companionOptions, epicBoons } = require("./character.js");

const offlineHtml = readFileSync(join(__dirname, "Nimble-Spellbook-Offline.html"), "utf8");
const classSheets = JSON.parse(offlineHtml.match(/<script id="offline-features" type="application\/json">(.*?)<\/script>/s)[1]);

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
