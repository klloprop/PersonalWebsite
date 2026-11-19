const test = require("node:test");
const assert = require("node:assert/strict");
const { availability, castingResource, featureCategory, maxTier, featureSummary, rageSummary } = require("./character.js");

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
