(function (root) {
  "use strict";

  const classes = {
    "Manawright (Artificer)": ["Gadgeteer", "Inventor", "Alchemist", "Chronurgist"],
    Berserker: ["Red Mist", "Mountainheart", "Burning Rage", "Titan’s Grip", "Muscle Mage (story)"],
    Commander: ["Bulwark", "Phalanx", "Vanguard", "Arena", "Siege-Breaker", "Spellblade (story)"],
    Hexbinder: ["The Hex", "The Sight", "Blooms", "The Hunt"],
    Hunter: ["Wild Heart", "Shadowpath", "Traps", "Pack", "Beastmaster (story)"],
    Mage: ["Control", "Chaos", "Wards", "Flame", "Surges", "Frost"],
    Oathsworn: ["Refuge", "Vengeance", "Roaring", "Valor", "Oathbreaker (story)"],
    Psion: ["Bladestorm", "Illusions", "Collapse", "Thralls", "Gravity"],
    Revenant: ["Wraith", "Elemental Lord", "Celestial", "Fey"],
    Shadowmancer: ["Abyssal Depths", "Red Dragon", "Void", "Endless Swarm", "High Celestial", "Reaver (story)"],
    Shepherd: ["Malice", "Mercy", "Protection", "The Forge (story)"],
    Songweaver: ["Snark", "Courage", "Singing Steel", "Torment", "Legends (story)"],
    Stormshifter: ["Sky & Storm", "Fang & Claw", "Cinder & Ash", "Venom & Web"],
    "The Cheat": ["Silent Blade", "Scoundrel", "Gambler", "Serpent", "The Honorseeker (story)"],
    Zephyr: ["Pain", "Iron", "Hurricanes", "Flame"]
  };
  const coreSchools = ["Fire", "Ice", "Lightning", "Wind", "Radiant", "Necrotic"];
  const companionSource = { page: 7, sourceLabel: "Hunter 3.0" };
  const companionSizes = ["Small companion", "Medium companion", "Large companion"];
  const companionRules = {
    "Protect Me!": [
      (level) => `When you Defend, the attack misses. Move half your Speed. ${level >= 7 ? 2 : 1} use(s) per encounter.`,
      () => "When you Defend, first attack the attacker for 1d8 + LVL damage. Once per encounter.",
      (level) => `Your companion moves you up to 12 spaces to safety ${level >= 7 ? "before you take a Wound" : "after you take a Wound"}. ${level >= 15 ? 2 : 1} use(s) per encounter.`
    ],
    "Go for the Throat!": [
      (level) => `Spend 1 Thrill of the Hunt charge and no actions. Your companion hits your Quarry for 1d4 + LVL damage, ignoring armor. ${level >= 15 ? "3 uses" : level >= 11 ? "2 uses" : "1 use"} per encounter.`,
      (level) => `Spend 1 action and 1 Thrill of the Hunt charge. Your companion hits your quarry for 1d8 + (3 × LVL) damage, ignoring armor. ${level >= 11 ? 2 : 1} use(s) per encounter.`,
      (level) => `Spend 2 actions and 1 Thrill of the Hunt charge. Your companion hits your Quarry for 1d12 + (4 × LVL) damage, ignoring armor. If that kills the Quarry, you can deal half that damage to another creature within Reach 4. ${level >= 11 ? 2 : 1} use(s) per encounter.`
    ]
  };
  const companionTraits = [
    (level) => `Keen Eyes: Mark a target without spending an action. ${level >= 11 ? 3 : level >= 7 ? 2 : 1} use(s) per encounter.`,
    (level) => `Ferocious: When you crit your Quarry, deal an extra LVL damage, ignoring armor, and move up to ${level >= 15 ? 6 : level >= 7 ? 4 : 2} spaces for free.`,
    () => "Alpha Protector: Halve the damage from the first attack against you each round."
  ];

  function companionOptions(level) {
    return companionSizes.map((name, index) => ({
      ...companionSource, name, description: companionTraits[index](level)
    }));
  }

  const epicBoonSource = { page: 38, sourceLabel: "Game Master’s Guide 3.0" };
  const epicBoons = [
    ["Epic Agility", "Once per encounter, take one extra action."],
    ["Epic Criticals", "When rolling critical-hit damage, you can swap one of the dice for a d20."],
    ["Epic Defense", "Your shields grant 3 extra Defense."],
    ["Epic Foresight", "Add 5 to Initiative. Your first attack each encounter has advantage."],
    ["Epic Knowledge", "Once per Safe Rest, gain hidden knowledge about a legendary being or object."],
    ["Epic Mana", "When healed, you may recover mana instead, at a rate of 1 mana per 5 HP of healing."],
    ["Epic Mind", "Increase your maximum mana by 8."],
    ["Epic Stamina", "During a Field Rest, a Hit Die roll of 4 or more also heals one Wound."],
    ["Epic Speed", "Add 4 to both Speed and Initiative."],
    ["Epic Stats", "Add 1 to each of three different stats."],
    ["Epic Senses", "Gain Blindsight 6."],
    ["Epic Resistance", "Once per encounter, negate damage you would take or ignore a failed save."]
  ].map(([name, description]) => ({ ...epicBoonSource, name, description }));

  const fixedReplacements = [
    ["BOUNDLESS FLAMES", "BOUNDLESS RAGE"],
    ["Captain of Legions", "Unparalleled Tactics"],
    ["Professional Skulker", "Leave No Trace"],
    ["Even the Odds", "Twist the Blade"],
    ["Supreme Underdog", "Supreme Execution"],
  ];

  function unlockedFeatures(features, { subclass, level, companionSize }) {
    const activeSubclass = level >= 3 ? subclass : "";
    const available = features.filter((feature) =>
      feature.level <= level && (!feature.subclass || feature.subclass === activeSubclass));
    const replaced = new Set(fixedReplacements
      .filter(([replacement]) => available.some(({ name }) => name === replacement))
      .map(([, original]) => original));
    return available.flatMap((feature) => {
      const base = feature.name.replace(/ \(\d+\)$/, "");
      if (replaced.has(base)) return [];
      if (base === "Epic Boon") return [{ ...feature, ...epicBoonSource, choice: true, description: "Choose an Epic Boon. Its effects are listed here." }];
      if (activeSubclass === "Beastmaster (story)") {
        if (!feature.subclass && feature.level === 2 && feature.name === "Thrill of the Hunt") return [];
        if (feature.subclass === activeSubclass && feature.name === "Beastmaster Companion") {
          return [{ ...feature, ...companionSource, description: "Choose your companion's size. Its HP and movement are abstracted, and it acts without being commanded for its listed abilities. With GM approval, it can perform actions natural to the animal; commanding a more involved action such as Grapple or Help costs 1 action.\n\nGo for the Throat! and Protect Me! replace your first two Thrill of the Hunt picks. Your companion's attacks count as yours when earning Thrill of the Hunt charges: gain one when you hit your Quarry in melee, crit it at range, or it dies. Abilities that spend charges cannot miss or generate new charges. Unspent charges expire at the end of combat." }];
        }
        const effects = companionRules[feature.name];
        if (feature.subclass === activeSubclass && effects) {
          const index = companionSizes.indexOf(companionSize);
          const description = index < 0
            ? effects.map((effect, i) => `${companionSizes[i]}: ${effect(level)}`).join("\n\n")
            : `${companionSizes[index]}: ${effects[index](level)}`;
          const category = feature.name === "Protect Me!" ? "Reactions" : "Attacks & combat actions";
          return [{ ...feature, ...companionSource, choice: false, description, category }];
        }
      }
      if (activeSubclass === "Spellblade (story)" && base === "Weapon Mastery") return [];
      if (activeSubclass === "Legends (story)" && base === "Lyrical Weaponry") return [];
      if (activeSubclass === "The Forge (story)" && base === "Master of Twilight") {
        return [{ ...feature, description: feature.description.replace(/\bNecrotic\b/g, "Fire") }];
      }
      if (activeSubclass === "The Honorseeker (story)") {
        if (base === "Underhanded Ability" && !feature.subclass) {
          return [{ ...feature, name: "Honorable Gambits", subclass: activeSubclass,
            description: "Choose an Honorable Gambit instead of an Underhanded Ability." }];
        }
        if (["Sneak Attack", "Vicious Opportunist", "Honorable Gambits"].includes(base)) return [];
      }
      if (activeSubclass === "Arena" && /^Commander’s Orders\b/.test(feature.name)) return [];
      return [feature];
    }).sort((a, b) => a.level - b.level);
  }

  function resolveFeaturePicks(slots, picks, knownFeatures) {
    const claimed = new Map(knownFeatures.map((name) => [name, null]));
    const duplicates = [];
    for (const { storedKey, options } of slots) {
      const option = options.get(picks[storedKey]);
      if (!option || option.repeatable) continue;
      if (claimed.has(option.name)) duplicates.push(storedKey);
      else claimed.set(option.name, storedKey);
    }
    return { claimed, duplicates };
  }
  const full = [2, 4, 6, 8, 10, 12, 14, 16, 18];
  const progressions = {
    Mage: full, Shepherd: full, Songweaver: full, Stormshifter: full,
    Oathsworn: [2, 4, 6, 8, 10, 13, 17],
    Shadowmancer: [2, 5, 7, 10, 13, 16, 19],
    Hexbinder: [2, 4, 6, 8, 10]
  };

  function maxTier(character) {
    let level = character.level;
    if (character.className === "Mage" && level >= 3 && ["Flame", "Frost"].includes(character.subclass)) level++;
    return (progressions[character.className] || []).filter((unlock) => level >= unlock).length;
  }

  function availability(spell, character) {
    if (!character.className) return "available";
    const { className, subclass, level } = character;
    const activeSubclass = level >= 3 ? subclass : "";
    const isCore = coreSchools.includes(spell.school);
    const tier = maxTier(character);
    let status = null;
    let schools = [];

    if (className === "Mage") {
      schools = ["Fire", "Ice", "Lightning"];
      if (activeSubclass === "Flame") schools = ["Fire"];
      if (activeSubclass === "Frost") schools = ["Ice"];
      if (activeSubclass === "Surges") schools = ["Lightning"];
    } else if (className === "Oathsworn" && level >= 2) schools = ["Radiant"];
    else if (className === "Shadowmancer" && level >= 2) {
      schools = ["Necrotic"];
      if (activeSubclass === "Abyssal Depths") schools.push("Ice");
      if (activeSubclass === "Red Dragon") schools.push("Fire");
    } else if (className === "Shepherd") {
      schools = activeSubclass === "The Forge (story)" ? ["Radiant", "Fire"] : ["Radiant", "Necrotic"];
    } else if (className === "Songweaver") schools = ["Wind"];
    else if (className === "Stormshifter") schools = ["Lightning", "Wind"];

    if (isCore && !spell.is_utility && schools.includes(spell.school) && spell.tier <= tier) status = "known";
    if (isCore && spell.is_utility) {
      if (className === "Mage" && level >= 3 && schools.includes(spell.school)) status = "option";
      if (className === "Oathsworn" && level >= 7 && (spell.school === "Radiant" || (activeSubclass === "Oathbreaker (story)" && spell.school === "Necrotic"))) status = "option";
      if (className === "Shadowmancer" && spell.school === "Necrotic" && level >= 6) status = level >= 14 ? "known" : "option";
      if (className === "Shadowmancer" && level >= 7 && schools.includes(spell.school) && spell.school !== "Necrotic") status = "option";
      if (className === "Shepherd" && level >= 3 && schools.includes(spell.school)) status = level >= 11 ? "known" : "option";
      if (className === "Songweaver" && level >= 3 && spell.school === "Wind") status = level >= 14 ? "known" : "option";
      if (className === "Stormshifter" && level >= 4 && schools.includes(spell.school)) status = "option";
    }

    if (className === "Mage" && level >= 7 && isCore && !spell.is_utility && spell.tier <= tier) {
      if (activeSubclass === "Control" && spell.school === "Necrotic") status = "option";
      if (activeSubclass === "Chaos" && spell.school === "Wind") status = "option";
      if (["Flame", "Frost"].includes(activeSubclass) && ["Fire", "Ice", "Lightning"].includes(spell.school) && !schools.includes(spell.school)) status = "option";
    }
    if (className === "Mage" && activeSubclass === "Surges" && isCore && !spell.is_utility && spell.tier <= tier &&
        (spell.school === "Fire" || (level >= 7 && spell.school === "Wind"))) status = "option";

    if (className === "Oathsworn" && activeSubclass === "Oathbreaker (story)") {
      if (["True Strike", "Heal", "Warding Bond"].includes(spell.name)) status = null;
      if (["Entice", "Shadow Trap", "Dread Visage"].includes(spell.name) && spell.tier <= tier && !spell.is_utility) status = "known";
    }
    if (className === "Songweaver" && level >= 2 && isCore && spell.school !== "Wind" && spell.tier <= tier && (!spell.is_utility || level >= 3)) status = "option";
    if (className === "Stormshifter" && isCore && spell.tier <= tier && (!spell.is_utility || level >= 4)) {
      if (activeSubclass === "Sky & Storm" && ["Ice", "Radiant"].includes(spell.school)) status = "option";
      if (activeSubclass === "Cinder & Ash" && spell.school === "Fire") status = spell.is_utility ? "option" : "known";
      if (activeSubclass === "Venom & Web" && spell.school === "Necrotic") status = spell.is_utility ? "option" : "known";
      if (["Cinder & Ash", "Venom & Web"].includes(activeSubclass) && ["Lightning", "Wind"].includes(spell.school)) status = "option";
    }
    if (className === "Stormshifter" && activeSubclass === "Cinder & Ash" && !spell.is_secret) {
      if ((spell.name === "Enchant Weapon" || (level >= 7 && spell.name === "Pyroclasm")) && status !== "known") status = "conditional";
    }
    if (className === "Shadowmancer" && !spell.is_secret) {
      if (activeSubclass === "Abyssal Depths" && ((level >= 7 && ["Omenrime", "Rimeblades"].includes(spell.name)) || (level >= 15 && spell.school === "Ice" && !spell.is_utility)) && status !== "known") status = "conditional";
      if (activeSubclass === "Red Dragon" && ((level >= 7 && spell.name === "Pyroclasm") || (level >= 15 && spell.name === "Dragonform")) && status !== "known") status = "conditional";
    }
    if (className === "Hexbinder" && spell.school === "Hexbinder" && spell.tier <= tier) status = "known";
    if (className === "Hexbinder" && level >= 4 && isCore && !spell.is_utility && spell.tier > 0 && spell.tier <= tier) status = "option";
    if (className === "Shadowmancer" && spell.school === "Shadowmancer" && !(activeSubclass === "Reaver (story)" && spell.name === "Shadow Blast")) status = "known";
    if (className === "Shadowmancer" && activeSubclass === "Reaver (story)" && status === "known" && spell.tier > 0) status = "conditional";
    if (className === "Shepherd" && spell.school === "Shepherd") status = "known";
    if (className === "Songweaver" && spell.school === "Songweaver" && (spell.name !== "Legend’s Tale" || activeSubclass === "Legends (story)")) status = "known";
    if (className === "Berserker" && activeSubclass === "Muscle Mage (story)" && spell.school === "Muscle Mage") status = "conditional";
    if (className === "Commander" && activeSubclass === "Spellblade (story)" && isCore) {
      const max = level >= 15 ? 4 : level >= 11 ? 3 : level >= 7 ? 2 : 1;
      if (spell.is_utility || spell.tier <= max) status = "option";
      if (spell.name === "Enchant Weapon" && !spell.is_secret) status = "conditional";
    }
    if (className === "Revenant" && activeSubclass === "Elemental Lord" && isCore && !spell.is_utility && spell.tier > 0 && ["Fire", "Ice", "Lightning", "Wind"].includes(spell.school)) status = "conditional";
    if (className === "Revenant" && activeSubclass === "Celestial" && !spell.is_secret && ["Rebuke", "Warding Bond"].includes(spell.name)) status = "conditional";
    if (spell.is_secret && status) return "conditional";
    return status;
  }

  function explanation(character) {
    if (!character.className) return "";
    const notes = ["Options are eligible choices, not necessarily spells already learned. Backgrounds, boons, items, multiclassing and other optional features are not included."];
    if (character.level < 3) notes.push("Most subclasses begin at level 3; story-based subclasses require GM approval.");
    if (character.className === "Mage") notes.push("Utility spells require school choices. Control, Chaos, Flame, Frost and Surges may grant a limited number of other-school spells.");
    if (character.className === "Oathsworn") notes.push("Utility spells are chosen individually; Oathbreaker exchanges specific spells.");
    if (character.className === "Shadowmancer") notes.push("Utility spells are chosen individually. Some subclass spells can be cast early only under special conditions.");
    if (character.className === "Shepherd") notes.push("Utility spells are chosen individually until level 11. The Forge exchanges the Necrotic school for Fire.");
    if (character.className === "Songweaver") notes.push("At level 2, choose one additional school; other-school results are alternatives, not all known. Utility spells are chosen individually.");
    if (character.className === "Stormshifter") notes.push("Sky & Storm chooses one extra school; Cinder & Ash and Venom & Web replace either Lightning or Wind. Utility spells are chosen individually.");
    if (character.className === "Hexbinder") notes.push("The Coven Mystic Mark is optional and requires an ally’s school. Non-Hexbinder results are options only if Coven is selected.");
    if (character.className === "Commander" && character.subclass === "Spellblade (story)") notes.push("Spellblade chooses individual spells; Enchant Weapon is a special free casting.");
    if (character.className === "Revenant" && character.subclass === "Elemental Lord") notes.push("Choose individual spells; casting depends on Wounds. Earth spells are not in the supplied spell database.");
    if (character.className === "Berserker" && character.subclass === "Muscle Mage (story)") notes.push("Muscle spells require Fury Dice; level 11 reduces the requirement by 2. They are not cantrips.");
    notes.push("Core spell data is based on Core Rules 3.3. Secret spells require GM approval.");
    return notes.join(" ");
  }

  function castingResource({ className, subclass, level }) {
    if (level >= 3 && className === "Commander" && subclass === "Spellblade (story)") {
      return { stat: "INT", multiplier: 1, bonus: 0, unit: "mana at Initiative" };
    }
    if (level >= 2 && className === "Manawright (Artificer)") {
      const bonus = Number(level >= 13) + Number(level >= 18) + Number(level >= 15 && subclass === "Inventor");
      return { stat: "STR", multiplier: 1, bonus, unit: "Mana Dice (no mana pool)" };
    }
    if (level >= 2 && className === "Shadowmancer") return { text: "No mana pool; uses Pilfered Power." };
    if (level >= 2 && Object.hasOwn(progressions, className)) {
      const stat = ["Mage", "Songweaver"].includes(className) ? "INT" : "WIL";
      const multiplier = ["Hexbinder", "Oathsworn"].includes(className) ? 1 : 3;
      return { stat, multiplier, bonus: level, unit: "max mana" };
    }
    return { text: "No mana pool" };
  }

  function featureCategory({ name, description = "" }) {
    if (name === "Coordinated Strike!") return "Attacks & combat actions";
    if (/^(?:upgraded cantrips|.*spellcasting|mana and|tier \d+ spells|spell tiers|skilled hero|key stat|secondary stat|\+(?:key|secondary) stat)/i.test(name)) return "Progression";
    if (/\breaction\b|\bwhen(?:ever)? you defend\b/i.test(description)) return "Reactions";
    if (/\b(?:\d+\s+Actions?\b|Action:)/i.test(description)) {
      return /\b(?:damage|attack|hit|crit)\b/i.test(description) ? "Attacks & combat actions" : "Utility & support";
    }
    if (/\b(?:heals?|restores?|teleport|summon|field rest|safe rest)\b/i.test(description) &&
        !/\b(?:recharges?|damage|attack|crit)\b/i.test(description)) return "Utility & support";
    if (/^\((?:Reach|Range)\b.*\b(?:damage|\dd\d+)\b/i.test(description)) return "Attacks & combat actions";
    return "Passives & upgrades";
  }

  function rageSummary({ level, subclass }) {
    const burning = level >= 3 && subclass === "Burning Rage";
    const upgrades = [6, 9, 13, 17].filter((unlock) => level >= unlock).length;
    const count = (level >= 5 ? 2 : 1) + (burning ? upgrades : 0);
    const die = burning ? 4 : 4 + 2 * upgrades;
    const dice = count === 1 ? `1d${die} Fury Die` : `${count}d${die} Fury Dice`;
    const fixed = burning && level >= 15;
    const floor = !burning && level >= 20;
    return [
      ["Rage", `Once per turn, spend 1 action to gain ${dice}${fixed ? " (each counts as 5 instead of rolling)" : ""}. Keep up to KEY Fury Dice; if you go over, choose which dice to keep. You can Rage again while already Raging.`],
      ["While Raging", `Add your Fury Dice to every STR attack.${level >= 2 ? ` If you start your turn Raging, gain one Fury Die for free${fixed ? " (it counts as 5)" : ""}.` : ""}${floor ? " Treat Fury Die rolls below 5 as 5." : ""}`],
      ["Ends when", `You leave combat${level < 18 ? ", drop to 0 HP," : ""} or go a round without attacking or Raging. Lose all banked Fury Dice.${level >= 18 ? " Dropping to 0 HP no longer ends Rage." : ""}`],
      ...(level >= 4 ? [["While Dying", "Rage for free at the start of your turn. Your action cap is 2, and you skip the STR saves normally required to attack."]] : []),
      ...(burning ? [["Overflowing Fury", `For each Fury Die you discard over your cap, deal 5 fire damage to a creature within Reach ${level >= 7 ? 4 : 2} and apply Smoldering.`]] : []),
      ...(burning && level >= 7 ? [["Initiative", "Rage for free when you roll Initiative."]] : []),
      ...(subclass === "Mountainheart" && level >= 11 ? [["Titan’s Fury", "Rage for free after you miss an attack or an enemy crits you."]] : []),
      ...(level >= 20 ? [["Level 20", burning
        ? "Increase two stats by 1. Once per round when attacked, deal half your Fury Dice damage to an adjacent creature."
        : "Increase two stats by 1."]] : [])
    ];
  }

  const featureChains = {
    "Manawright (Artificer)": { "Mana Accumulator": ["Tuned Mana Condenser", "Mana Recovery Valve", "Optimized Mana Compression", "Prime Configuration", "Big Brained Inventor", "Grand Mechanist"] },
    Commander: { "Coordinated Strike!": ["Master Commander", "Unparalleled Tactics", "Captain of Legions"] },
    Hexbinder: { Soothsayer: [] },
    Hunter: { "Hunter’s Mark": ["Nemesis"] },
    Mage: { "Elemental Surge": [] },
    Oathsworn: { "Radiant Judgment": ["Unending Judgment"] },
    Psion: { "Psionic Field": ["Reflexive Field", "Psionic Fortress", "Mindmaster"] },
    Revenant: { Incorporeal: ["Two, as One"], "Spectral Blast": ["Empowered Blast"] },
    Shadowmancer: { "Pilfered Power": ["Greedy Pact"] },
    Shepherd: { "My Buddy!": ["Assist Me, My Friend!", "Twilight Sage"] },
    Songweaver: { "Songweaver’s Inspiration": ["Quick Wit", "Fire in My Bones", "Unfailing Resolve", "I’m So Famous!"] },
    Stormshifter: { Beastshift: ["Direbeast Form"] },
    "The Cheat": { "Sneak Attack": ["Twist the Blade"], "Vicious Opportunist": ["Supreme Execution"] },
    Zephyr: { "Iron Defense": [], "Unyielding Resolve": [], Momentum: ["Kinetic Marvel"], "Swift Feet": [] }
  };

  function featureSummary(character, name, rows) {
    const { level, className } = character;
    const has = (title) => rows.some((row) => row.name === title);
    const highest = (steps) => steps.findLast(([at]) => level >= at)[1];
    if (className === "Berserker" && name === "Rage") return rageSummary(character);
    if (!Object.hasOwn(featureChains[className] || {}, name)) return null;
    const base = rows[0].description;
    switch (name) {
      case "Mana Accumulator": {
        const resource = castingResource(character);
        const die = has("Big Brained Inventor") ? 12 : highest([[2, 4], [5, 6], [10, 8], [14, 10]]);
        return [["Mana Dice", `Bank up to STR${resource.bonus ? ` + ${resource.bonus}` : ""} d${die} Mana Dice to power inventions. They fully recharge at the end of your turn.`],
          ...(has("Mana Recovery Valve") ? [["Mishap", "Roll your next Mana Die this encounter with advantage."]] : []),
          ...(has("Grand Mechanist") ? [["Once per encounter", "Reroll any number of your Mana Dice as d20s. Increase two stats by 1 at level 20."]] : [])];
      }
      case "Coordinated Strike!": {
        const extra = level < 5 ? "" : `, plus INT${[9, 13, 17].filter((at) => level >= at).length ? ` + ${[9, 13, 17].filter((at) => level >= at).length}` : ""} extra uses per Safe Rest (at most once per round)`;
        const actionBonus = level >= 20 ? " On the first use each encounter, INT allies each gain an extra action."
          : level >= 18 ? " On the first use each encounter, an ally who can hear you also gains an action for their next turn." : "";
        const lines = [["Strike", `Once per encounter${extra}, you and one ally within Reach 6 each immediately make a weapon or Unarmed Strike or cast a cantrip for free.${level >= 5 ? " Attacks made this way ignore disadvantage." : ""}${actionBonus}`]];
        if (level >= 20) lines.push(["Captain of Legions", "+1 to any two stats."]);
        if (level >= 5 && character.subclass !== "Spellblade (story)") lines.push(["Combat Dice", `d${highest([[5, 8], [9, 10], [13, 12], [17, 20]])}`]);
        return lines;
      }
      case "Soothsayer":
        return [["Futuresight", `At combat start, roll ${level >= 10 ? "two" : "one"} d${level >= 17 ? 6 : 4} Futuresight ${level >= 10 ? "Dice" : "Die"}${level >= 14 ? " with advantage" : ""}. Within Reach ${level >= 10 ? 8 : 4}, spend one to raise or lower a die roll by its value. Unused dice expire when combat ends.`]];
      case "Hunter’s Mark":
        return [["Quarry", level >= 20
          ? "Spend an action to mark creatures you can see as your Quarry; you may have any number marked at once. The mark lasts a day. Quarry cannot hide from you. Before each attack against Quarry, choose advantage or +LVL damage."
          : base], ...(level >= 20 ? [["Level 20", "Increase two stats by 1."]] : [])];
      case "Elemental Surge":
        return [["Initiative", `When you roll Initiative, regain WIL${level >= 17 ? " + 2d4" : level >= 10 ? " + 1d4" : ""} mana. Unspent mana from this feature expires at the end of combat.`]];
      case "Radiant Judgment": {
        const die = highest([[1, 6], [3, 8], [5, 10], [8, 12], [10, 20]]);
        return [["Judgment Dice", `When an enemy attacks you and you have no Judgment Dice, roll and bank ${level >= 14 ? 3 : 2}d${die}. Spend them on your next Reach attack this encounter, adding their total as radiant damage on a hit. They are lost on a miss.${level >= 18 ? " While you have none, your melee attacks deal +5 damage." : ""}`]];
      }
      case "Psionic Field":
        return [["Field", `Spend an action to create a Reach 3 field (Concentration: 1 min) that grants ${level >= 17 ? "2×INT" : "+INT"} Defense.${level >= 9 ? " If your Initiative total is 9 or less, create it for free when combat starts." : ""}`],
          ...(level >= 20 ? [["Mindmaster", "Increase two stats by 1. As a free action, gain 1 Strain to double the field’s Reach for the round."]] : [])];
      case "Incorporeal":
        if (has("Two, as One")) return [["Spectral form", "In spectral form, move for free once per round, ignore Difficult Terrain, pass through solid obstacles, and ignore Grappled, Restrained, and Ridden. When you Defend in this form, take one fewer Wound."],
          ["Two, as One", "Ignore the Dying or living restrictions on your abilities. Increase two stats by 1."]];
        return [["Spectral form", `While Dying, your body collapses and your spectral form emerges. You gain Spectral Blast and take one fewer Wound when you Defend.${level >= 2 ? " Ignore Difficult Terrain and move for free once per round." : ""}${level >= 8 ? " You can pass through solid obstacles and are immune to being Grappled, Restrained, or Ridden." : ""}`]];
      case "Spectral Blast":
        return [["Attack", `1 Action${level < 20 ? " while Dying" : ""}, Range 8: deal 1d6 + LVL${has("Empowered Blast") ? " + twice your Wounds" : ""} damage. No STR save required.`]];
      case "Pilfered Power":
        return [["Casting", `Cast tiered spells DEX times before your Patron notices. This allowance resets when you commune with your Patron during a Safe Rest.${level < 12 ? " Cast beyond the limit and take damage equal to half your maximum HP." : ""}`],
          ...(level >= 12 ? [["Over the limit", "Make a STR save: 1–9, suffer damage equal to half your max HP; 10–19, take 10 HP of damage; 20+, take no damage and cast one tier higher."]] : [])];
      case "My Buddy!":
        return [["Lifebinding Spirit", `You learn Lifebinding Spirit.${level >= 5 ? " You can add the spirit’s damage to one melee weapon attack instead of having it attack that round." : ""}${level >= 20 ? " The spirit rolls twice as many dice, and you increase two stats by 1." : ""}`]];
      case "Songweaver’s Inspiration":
        return [["Inspiration", `Free Reaction, 2×WIL uses per Safe Rest: let an ally reroll a die${has("Unfailing Resolve") ? " with advantage or increase its result by 2" : " or increase its result by 1"}.${has("Fire in My Bones") ? " They also gain one action." : ""}${level >= 3 ? " On Initiative, regain two spent uses until combat ends." : ""}${level >= 20 ? " The ally gains advantage on subsequent rolls that round. Increase two stats by 1." : ""}`]];
      case "Beastshift":
        return [["Beastshift", base], ["Direbeast", `For up to a minute, take a Direbeast form up to DEX times per encounter. Forms: Fearsome Beast${level >= 2 ? ", Beast of the Pack" : ""}${level >= 5 ? ", Beast of Nightmares" : ""}.`]];
      case "Sneak Attack":
        return [["On crit", `Once per turn, deal +${highest([[1, "1d6"], [3, "1d8"], [7, "2d8"], [9, "2d10"], [11, "2d12"], [15, "2d20"], [17, "3d20"]])} damage.`],
          ...(has("Twist the Blade") ? [["Twist the Blade", `Set one Sneak Attack die to a result of your choice. ${has("Twist the Blade (2)") ? "You may do this for free once per turn." : "Costs 1 action."}`]] : [])];
      case "Vicious Opportunist":
        return [["On hit", `Once per turn when your melee attack hits a Distracted target, set the Primary Die to any result (maximum counts as a crit).${has("Supreme Execution") ? " Blade attacks ignore the Distracted requirement. Increase two stats by 1 at level 20." : ""}`]];
      case "Iron Defense":
        return [["Unarmored Defense", level >= 5 ? "(3×STR) + DEX" : "DEX + STR"]];
      case "Unyielding Resolve":
        return [["Wounds", `Ignore the first ${level >= 17 ? "three Wounds" : level >= 13 ? "two Wounds" : "Wound"} you would suffer each encounter. When-Wounded abilities still trigger.${level >= 17 ? " You have advantage on STR saves while Dying." : ""}`]];
      case "Momentum":
        return [["Movement", `Gain 1 Momentum per space moved. Spend it to add ${has("Kinetic Marvel") ? "2" : "1"} damage per point to a melee attack. All unspent Momentum is lost when you take damage or when combat ends.`]];
      case "Swift Feet":
        return [["Unarmored", `Gain +${has("Swift Feet (2)") ? 4 : 2} Speed and Initiative.`]];
    }
  }

  const api = { classes, availability, explanation, castingResource, featureCategory, maxTier, featureChains,
    featureSummary, rageSummary, unlockedFeatures, resolveFeaturePicks, companionOptions, epicBoons };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CharacterRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
