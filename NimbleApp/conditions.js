(function () {
  "use strict";

  const core = [
    ["Blind", "Cannot see. Incoming attacks have advantage; your own attacks have disadvantage."],
    ["Dazed", "Heroes lose one action. On their next turn, monsters lose either their move or one attack."],
    ["Dying", "At 0 HP, you can have at most one action. Damage taken while Dying adds two Wounds, or three on a crit."],
    ["Empowered X", "Add X to attack damage."],
    ["Frightened", "Roll with disadvantage near the source of your fear. Halve your Speed when moving toward it."],
    ["Incapacitated", "Cannot act. Incoming attacks have advantage, and melee hits against you are critical hits."],
    ["Invisible", "Cannot be seen. Your attacks have advantage; incoming attacks have disadvantage."],
    ["Poisoned", "Roll with disadvantage. Healing usually removes the condition."],
    ["Prone", "Moving costs double and your attacks have disadvantage. Incoming melee attacks have advantage; incoming ranged attacks have disadvantage. Spend three spaces of Speed to stand."],
    ["Restrained", "Cannot move. Incoming attacks have advantage."],
    ["Silenced", "Cannot cast spells or use speaking-dependent abilities, such as a Commander's Orders."],
    ["Slowed", "Halve your Speed on your next turn."],
    ["Taunted", "Attack with disadvantage unless targeting whoever Taunted you most recently."],
    ["Weakened X", "Subtract X from attack damage."]
  ];
  const special = [
    ["Bloodied", "At half your maximum HP or less."],
    ["Charged", "Taking lightning damage makes you Charged for one minute or until combat ends. Some spells interact with this status, including Overload and Electrickery."],
    ["Charmed", "Treat the charmer as an ally. They have advantage when interacting socially with you."],
    ["Clobbered", "A Medium or smaller creature counts as Clobbered this round if it is Dazed, Grappled, Prone, or was forcibly moved this round. Some Muscle Mage spells also apply or use this status.", "/classes/Berserker3.1.pdf", 7, "BERSERKER CLASS SHEET"],
    ["Deafened", "Cannot hear."],
    ["Distracted", "A target is Distracted if it is next to or Taunted by one of your allies, or cannot see you."],
    ["Grappled", "Another creature is holding you. Attacks against either of you have advantage."],
    ["Guilty", "A creature becomes Guilty when it scores a critical hit."],
    ["Hampered", "Your actions or movement are reduced, for example by Dazed, Prone, Slowed, or Difficult Terrain."],
    ["Paralyzed, Stunned, or Unconscious", "You are Incapacitated: you cannot act, incoming attacks have advantage, and melee hits against you are critical hits."],
    ["Petrified", "You are Incapacitated and turned to stone. Most damage cannot harm you, but large explosions, picks, and similar tools can."],
    ["Smoldering", "No effect by itself. Some spells and abilities, such as Ignite and Pyroclasm, use up the condition to produce an additional effect."],
    ["Wounded", "You have at least one Wound."]
  ];
  const groups = [
    { key: "Core", title: "Core Conditions", page: 6, entries: core },
    { key: "Special", title: "Special Statuses", page: 29, entries: special }
  ];
  const query = document.getElementById("condition-query");
  const filters = document.getElementById("condition-filters");
  const results = document.getElementById("condition-results");
  const count = document.getElementById("condition-count");
  const empty = document.getElementById("condition-empty");
  const offline = Boolean(document.getElementById("offline-spells"));
  let selectedGroup = "";

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function card([name, effect, file = "/NimbleCoreRules3.3.pdf", page, source = "CORE RULES"], group) {
    const article = element("article", "spell-card");
    const heading = element("div", "spell-heading");
    heading.append(element("h3", "", name));
    const text = element("p", "spell-description");
    text.append(element("strong", "keyword-badge", "Effect:"), document.createTextNode(` ${effect}`));
    const pdfPage = page ?? group.page;
    const link = element(offline ? "span" : "a", "source-link", `${source} · PDF PAGE ${pdfPage}${offline ? "" : " ↗"}`);
    if (!offline) {
      link.href = `${file}#page=${pdfPage}`;
      link.target = "_blank";
      link.rel = "noopener";
    }
    article.append(element("span", "spell-label", group.key === "Core" ? "CONDITION" : "STATUS"), heading, text, link);
    return article;
  }

  function render() {
    const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let total = 0;
    results.replaceChildren();
    for (const group of groups) {
      if (selectedGroup && selectedGroup !== group.key) continue;
      const entries = group.entries.filter(([name, effect]) => {
        const searchable = `${name} ${effect}`.toLocaleLowerCase();
        return terms.every((term) => searchable.includes(term));
      });
      if (!entries.length) continue;
      total += entries.length;
      const section = element("section", `school-section${group.key === "Special" ? " school-necrotic" : ""}`);
      const heading = element("div", "school-heading");
      heading.append(element("h2", "", group.title));
      section.append(heading);
      if (group.key === "Core") {
        const notes = element("aside", "school-notes spell-description");
        const text = element("p", "spell-text");
        text.append(element("strong", "keyword-badge", "Stacking:"), document.createTextNode(" Applying the same condition again does not add another copy of its effect."));
        notes.append(text);
        section.append(notes);
      }
      const grid = element("div", "spell-grid");
      grid.append(...entries.map((entry) => card(entry, group)));
      section.append(grid);
      results.append(section);
    }
    count.textContent = `${total} ${total === 1 ? "condition" : "conditions"} found`;
    empty.hidden = total > 0;
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-group]");
    if (!button) return;
    selectedGroup = button.dataset.group;
    for (const item of filters.querySelectorAll("button")) {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    }
    render();
  });
  query.addEventListener("input", render);
  render();
})();
