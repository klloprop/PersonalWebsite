(function (root) {
  "use strict";

  const stats = ["STR", "DEX", "INT", "WIL"];
  const arrays = { Standard: [2, 2, 0, -1], Balanced: [2, 1, 1, 0], "Min-Max": [3, 1, -1, -1] };
  const skills = { Might: "STR", Finesse: "DEX", Stealth: "DEX", Arcana: "INT", Examination: "INT", Lore: "INT",
    Influence: "WIL", Insight: "WIL", Naturecraft: "WIL", Perception: "WIL" };
  // Class-sheet starting values, independent of the character's later progression.
  const classes = {
    "Manawright (Artificer)": ["INT STR", 8, 13, "INT WIL", "Armor Prototype", "", "", "Weapon Prototype, Wrench, Notebook"],
    Berserker: ["STR DEX", 12, 20, "STR INT", "", "", "Battleaxe", "Rations (meat), Rope (50 ft.)"],
    Commander: ["STR INT", 10, 17, "STR DEX", "Rusty Mail", "", "Short Sword, Javelins", ""],
    Hexbinder: ["INT WIL", 8, 13, "WIL DEX", "Adventurer’s Garb", "", "Dagger", "Portable Cauldron"],
    Hunter: ["DEX WIL", 8, 13, "DEX INT", "Cheap Hides", "", "Shortbow, Dagger", "Hunting Trap"],
    Mage: ["INT WIL", 6, 10, "INT STR", "Adventurer’s Garb", "", "Staff", "Soap"],
    Oathsworn: ["STR WIL", 10, 17, "STR DEX", "Rusty Mail", "Wooden Buckler", "Mace", "Manacles"],
    Psion: ["WIL INT", 8, 13, "WIL DEX", "Adventurer’s Garb", "", "Dagger", "Vial of Pitch"],
    Revenant: ["WIL STR", 4, 7, "WIL DEX", "Rusty Mail", "", "Longsword", "Cherished Memento"],
    Shadowmancer: ["INT DEX", 8, 13, "INT WIL", "Adventurer’s Garb", "", "Sickle", "Shovel"],
    Shepherd: ["WIL STR", 10, 17, "WIL DEX", "Rusty Mail", "Wooden Buckler", "Mace", "Bell"],
    Songweaver: ["WIL INT", 8, 13, "WIL STR", "Adventurer’s Garb", "", "Dagger", "Instrument, Mirror"],
    Stormshifter: ["WIL DEX", 8, 13, "WIL STR", "Cheap Hides", "", "Staff", "Strange Plant"],
    "The Cheat": ["DEX INT", 6, 10, "DEX WIL", "Cheap Hides", "", "Dagger, Dagger, Sling", "Chalk"],
    Zephyr: ["DEX STR", 8, 13, "DEX INT", "", "", "Staff", "Traveling robes and sandals"]
  };
  const armor = {
    "": [0, "DEX"], "Armor Prototype": [0, "DEX", undefined, "INT"],
    "Adventurer’s Garb": [2, "DEX"], "Minor Cloth Enchantment": [3, "DEX"], "Major Cloth Enchantment": [4, "DEX"], "Epic Cloth Enchantment": [5, "DEX"],
    "Cheap Hides": [3, "DEX"], "Ox Hide": [4, "DEX"], "Hard Leather": [5, "DEX"], Wyrmhide: [6, "DEX"],
    "Rusty Mail": [6, "DEX", 2], "Chain Shirt": [9, "DEX", 2], "Scale Mail": [12, "DEX", 2], Dragonscale: [15, "DEX", 2],
    "Rusty Plate": [10], "Half Plate": [14], "Full Plate": [18], "Adamantine Plate": [22], Custom: [0]
  };
  const shields = { "": 0, "Wooden Buckler": 2, "Iron Shield": 4, "Tower Shield": 6, "Dragon Shield": 8 };
  const weapons = {
    "Unarmed Strike": ["1d4", "STR", "Reach 1"], Dagger: ["1d4", "DEX", "Reach 1, Thrown 4, Light"],
    Sickle: ["1d4", "DEX", "Reach 1, Vicious"], Mace: ["1d6", "STR", "Reach 1"], Club: ["1d6", "STR", "Reach 1"],
    "Hand Axe": ["1d6", "STR", "Reach 1, Thrown 4"], Spear: ["1d6", "STR", "Reach 2"],
    "Short Sword": ["1d6", "STR/DEX", "Reach 1, Light"], Rapier: ["2d4", "DEX", "Reach 1"],
    Staff: ["1d8", "STR", "Reach 1, Two-handed"], Longsword: ["1d8", "STR", "Reach 1"],
    Battleaxe: ["1d10", "STR", "Reach 1, Two-handed"], "Pole Hammer": ["1d10", "STR", "Reach 2, Two-handed"],
    Glaive: ["1d10", "STR", "Reach 2, Two-handed"], "Great Spear": ["1d10", "STR", "Reach 2, Two-handed"],
    Greatmaul: ["3d4", "STR", "Reach 1, Two-handed"], Greataxe: ["2d6", "STR", "Reach 1, Two-handed"],
    Greatsword: ["1d12", "STR", "Reach 1, Two-handed"], Sling: ["1d4", "DEX", "Range 12, Vicious, Two-handed"],
    Javelins: ["1d6", "STR", "Range 8, Stack of 4"], "Throwing Hammers": ["1d8", "STR", "Range 4, Stack of 3"],
    Shortbow: ["1d6", "DEX", "Range 12, Two-handed"], Longbow: ["1d8", "DEX", "Range 16, Two-handed"],
    Crossbow: ["4d4", "DEX", "Range 8, Load 1 action, Two-handed"],
    "Handheld Ballista": ["1d20", "DEX", "Range 8, Load 2 actions, Two-handed"]
  };

  function number(value, fallback = 0) {
    return value !== undefined && value !== "" && Number.isInteger(Number(value)) ? Number(value) : fallback;
  }

  function baseArray(className, array) {
    const key = keyStats(className);
    const order = [...key, ...stats.filter((stat) => !key.includes(stat))];
    return Object.fromEntries(order.map((stat, index) => [stat, arrays[array][index]]));
  }

  function keyStats(className) {
    return classes[className][0].split(" ");
  }

  function resolveKey(text, key) {
    return text.replace(/(?:\b(\d+)\s*([+×])\s*)?(\+\s*)?\bKEY\b(?![-\s]+(?:[Ss]tats?|STATS?)\b)/g,
      (_match, operand, operator, plus) => {
        if (operator) return String(operator === "×" ? Number(operand) * key : Number(operand) + key);
        return plus && key >= 0 ? `+${key}` : String(key);
      });
  }

  function startingGear(className) {
    const [, , , , armor, shield, weapons, inventory] = classes[className];
    return { armor, shield, weapons, inventory };
  }

  function breakdown(parts) {
    return { parts, total: parts.reduce((sum, [, value]) => sum + value, 0) };
  }

  function capstone(features) {
    return features.find(({ level, description }) => level === 20 &&
      /(?:increase any 2 stats by 1|\+1 to any 2 of your stats)/i.test(description));
  }

  function skillGrants(level, sheet) {
    return Object.fromEntries(Object.keys(skills).map((skill) => [skill,
      Array.from({ length: level - 1 }, (_, index) => sheet[`levelSkill:${index + 2}`]).filter((picked) => picked === skill).length]));
  }

  function statTotals(character, sheet, features, picks) {
    const { className } = character;
    const defaults = baseArray(className, "Standard");
    const parts = Object.fromEntries(stats.map((stat) => [stat, [
      ["Base", number(sheet[`base:${stat}`], defaults[stat])], ["Manual bonus", number(sheet[`bonus:${stat}`])]
    ]]));
    for (const feature of features) {
      if (!feature.choice || !/(?:key|secondary) stat/i.test(feature.name)) continue;
      const selected = picks[JSON.stringify([className, feature.subclass, feature.level, feature.name])];
      if (stats.includes(selected) && feature.description.includes(selected)) {
        parts[selected].push([`${feature.name} (level ${feature.level})`, 1]);
      }
    }
    const final = capstone(features);
    if (final) {
      for (const stat of new Set([sheet.capstoneFirst, sheet.capstoneSecond])) {
        if (stats.includes(stat)) parts[stat].push([`${final.name} (level 20)`, 1]);
      }
    }
    return Object.fromEntries(stats.map((stat) => [stat, breakdown(parts[stat])]));
  }

  function derived(character, sheet, features, picks) {
    const { className, level } = character;
    const [, hitDie, startingHP] = classes[className];
    const totals = statTotals(character, sheet, features, picks);
    const value = (stat) => totals[stat].total;
    const key = Math.max(...keyStats(className).map(value));
    const has = (name) => features.some((feature) => feature.name === name);
    const gear = Object.hasOwn(armor, sheet.armor) ? sheet.armor : "";
    const [armorValue, armorStat, cap, secondStat] = armor[gear];
    const defense = gear ? [[gear, gear === "Custom" ? number(sheet.customArmor) : armorValue],
      ...(armorStat ? [[cap ? `${armorStat} (max ${cap})` : armorStat, Math.min(value(armorStat), cap ?? Infinity)]] : []),
      ...(secondStat ? [[secondStat, value(secondStat)]] : [])]
      : [["DEX (unarmored)", value("DEX")], ...(className === "Zephyr" ? [["Iron Defense", value("STR") * (level >= 5 ? 3 : 1)]] : [])];
    if (sheet.shield && Object.hasOwn(shields, sheet.shield)) defense.push([sheet.shield, shields[sheet.shield]]);
    const swift = !gear && has("Swift Feet") ? (has("Swift Feet (2)") ? 4 : 2) : 0;
    const measure = (key, parts) => breakdown([...parts, ["Manual bonus", number(sheet[`bonus:${key}`])]]);
    const skilled = {};
    for (const feature of features.filter(({ name }) => name === "Skilled Hero")) {
      for (const match of feature.description.matchAll(/([+–-]\d+)\s+(?:to\s+)?([^+–-]+)/g)) {
        for (const skill of Object.keys(skills)) {
          if (new RegExp(`\\b${skill}\\b`).test(match[2])) skilled[skill] = Number(match[1].replace("–", "-"));
        }
      }
    }
    const hpSteps = Array.from({ length: level - 1 }, (_, index) =>
      [`Level ${index + 2} HP`, number(sheet[`hp:${index + 2}`], hitDie / 2)]);
    const grants = skillGrants(level, sheet);
    return {
      stats: totals, hitDie, key,
      metrics: {
        "Max HP": measure("Max HP", [["Starting HP", startingHP], ...hpSteps]),
        "Hit Dice": measure("Hit Dice", [["Level", level], ...(has("Potent Bloom") ? [["Potent Bloom (KEY)", key]] : [])]),
        "Max Wounds": measure("Max Wounds", [["Base", 6]]),
        Defense: measure("Defense", defense),
        Initiative: measure("Initiative", [["DEX", value("DEX")], ...(swift ? [["Swift Feet", swift]] : [])]),
        Speed: measure("Speed", [["Base", 6], ...(swift ? [["Swift Feet", swift]] : []), ...(has("Explorer of the Wilds") ? [["Explorer of the Wilds", 2]] : [])]),
        Actions: measure("Actions", [[className === "Revenant" ? "Between Two Worlds" : "Base", className === "Revenant" ? 2 : 3],
          ...(has("Windborne") ? [["Windborne", 1]] : [])]),
        "Inventory slots": measure("Inventory slots", [["Base", 10], ["STR", value("STR")]])
      },
      skills: Object.fromEntries(Object.entries(skills).map(([skill, stat]) => [skill, breakdown([
        [stat, value(stat)], ["Skilled Hero", skilled[skill] || 0], ["Level-up points", grants[skill]],
        ["Manual points / override", number(sheet[`skill:${skill}`])]
      ])]))
    };
  }

  function spellTiming(spell) {
    const text = spell.description || "";
    const reactionOnly = /\bReaction:|^Castable only while Defending\b/i.test(text);
    const reactionAlso = /\bcast (?:as a Reaction|while Defending)\b/i.test(text);
    const modes = ["exploration"];
    if (!reactionOnly && /\bactions?\b/i.test(spell.casting_time || "")) modes.push("actions");
    if (reactionOnly || reactionAlso) modes.push("reactions");
    const reactionCost = text.match(/cast as a Reaction for (\d+) mana/i)?.[1];
    return { modes, reactionCost: reactionCost === undefined ? spell.tier : Number(reactionCost) };
  }

  function isCombatPassive(activation, description, modes) {
    if (!modes.has("exploration") || /\b(?:action|reaction)\b/i.test(activation)) return false;
    return /\b(?:combat|attacks?|damage|crits?|critical hits?|defense|initiative|temporar(?:y|ily) HP|temp HP|resistan(?:t|ce)|vulnerab(?:le|ility)|saving throws?)\b/i.test(description);
  }

  const api = { stats, arrays, skills, classes, armor, shields, weapons, number, baseArray, startingGear, derived, keyStats, resolveKey, capstone, skillGrants, spellTiming, isCombatPassive };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CharacterSheetRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
