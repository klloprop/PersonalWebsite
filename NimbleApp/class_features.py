"""Index feature names and unlock levels from the supplied class sheets."""

import re
from pathlib import Path

import pymupdf

CLASSES = {
    "Artificer": ("Manawright (Artificer)", "Gadgeteer|Inventor|Alchemist|Chronurgist"),
    "Berserker": ("Berserker", "Red Mist|Mountainheart|Burning Rage|Titan’s Grip|Muscle Mage*"),
    "Commander": ("Commander", "Bulwark|Phalanx|Vanguard|Arena|Siege-Breaker|Spellblade*"),
    "Hexbinder": ("Hexbinder", "The Hex|The Sight|Blooms|The Hunt"),
    "Hunter": ("Hunter", "Wild Heart|Shadowpath|Traps|Pack|Beastmaster*"),
    "Mage": ("Mage", "Control|Chaos|Wards|Flame|Surges|Frost"),
    "Oathsworn": ("Oathsworn", "Refuge|Vengeance|Roaring|Valor|Oathbreaker*"),
    "Psion": ("Psion", "Bladestorm|Illusions|Collapse|Thralls|Gravity"),
    "Revenant": ("Revenant", "Wraith|Elemental Lord|Celestial|Fey"),
    "Shadowmancer": ("Shadowmancer", "Abyssal Depths|Red Dragon|Void|Endless Swarm|High Celestial|Reaver*"),
    "Shepherd": ("Shepherd", "Malice|Mercy|Protection|The Forge*"),
    "Songweaver": ("Songweaver", "Snark|Courage|Singing Steel|Torment|Legends*"),
    "Stormshifter": ("Stormshifter", "Sky & Storm|Fang & Claw|Cinder & Ash|Venom & Web"),
    "TheCheat": ("The Cheat", "Silent Blade|Scoundrel|Gambler|Serpent|The Honorseeker*"),
    "Zephyr": ("Zephyr", "Pain|Iron|Hurricanes|Flame"),
}
LEVEL = re.compile(r"LEVEL\s+(\d+)")
CHOICE = re.compile(r"^(?:choose|select|pick|upgrade)\b(?!\s+both\b)", re.I)
EMBEDDED_CHOICES = {
    "Commander": {"Weapon Mastery"},
    "Mage": {"Spellshaper", "Elemental Mastery", "At Any Cost", "Tempest Mage", "Electrical Dedication"},
    "Oathsworn": {"Sacred Decree"},
    "Psion": {"Powerful Mind"},
    "Revenant": {"Elemental Avatar", "Mighty Avatar", "Elemental Prowess"},
    "Shadowmancer": {"Shadowrime", "We’ll ALL Burn!"},
    "Songweaver": {"A “People“ Person"},
}
IGNORE = {"Subclass", "Example", "Note", "Starting Gear", "Reminder"}
STORY_INTROS = {"Arcane Command", "Honorseeker"}
CLASS_NOTES = {
    "Manawright (Artificer)": {"Reconfigure!", "Damage type?", "Make it your own!"},
    "Berserker": {"Wrath & Ruin"},
    "Commander": {"Rigorous Training"},
    "Hexbinder": {"Bubble, Bubble!", "Changing Dice"},
    "Hunter": {"Remember the Wild"},
    "Mage": {"Study!"},
    "Oathsworn": {"Serve Selflessly"},
    "Psion": {"Strain", "Flavor is Free!"},
    "Revenant": {"Brood", "Flavor is free!"},
    "Shadowmancer": {"Supplicate"},
    "Shepherd": {"Serve", "Flavor is Free", "Rushed Attacks and My Companion?"},
    "Songweaver": {"Perform!", "Flavor is Free", "Making Your Own People", "Balance Note"},
    "Stormshifter": {"Be Wild"},
    "The Cheat": {"Trade Secrets", "Magic?"},
    "Zephyr": {"Focus"},
}
CATALOG_PAGES = {
    "Berserker": {4: "Savage Arsenal"}, "Commander": {4: "Commander’s Orders"},
    "Hexbinder": {4: "Afflictions"}, "Hunter": {4: "Thrill of the Hunt"},
    "Mage": {4: "Spellshaper"}, "Psion": {4: "Psionic Abilities"},
    "Revenant": {4: "Master of Undeath"}, "Shadowmancer": {4: "Lesser Invocations", 5: "Invocations"},
    "Oathsworn": {4: "Sacred Decree"},
    "Shepherd": {4: "Sacred Grace"}, "Songweaver": {4: "Lyrical Weaponry"},
    "Stormshifter": {4: "Chimeric Boon"}, "The Cheat": {4: "Underhanded Ability", 8: "Honorable Gambits"},
    "Zephyr": {4: "Martial Master"}, "Manawright (Artificer)": {4: "Eureka!", 5: "Eureka!", 6: "Gadgets"},
}


def lines(page: pymupdf.Page):
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", ()):
            yield [span for span in line["spans"] if span["text"].strip()]


def joined(spans) -> str:
    return " ".join("".join(span["text"] for span in spans).split())


def continuation(body: str, text: str) -> str:
    if not body:
        return text
    if body.endswith("\u00ad"):
        return body[:-1] + text
    return body + " " + text


def class_notes(document: pymupdf.Document, names: set[str]) -> list[dict]:
    notes = {}
    for page in list(document)[2:5]:
        current = None
        last = None
        for spans in lines(page):
            if not spans:
                continue
            first = spans[0]
            name = first["text"].strip().rstrip(".")
            x, y = first["bbox"][:2]
            if first["font"] == "AvenirNextCondensed-Bold" and name in names and 7.7 <= first["size"] <= 8.3:
                current = {"name": name, "description": joined(spans[1:]), "page": page.number + 1}
                if name not in notes:
                    notes[name] = current
                last = (x, y)
            elif (current and last and first["font"].startswith("AvenirNextCondensed")
                  and first["size"] <= 8.3 and abs(x - last[0]) <= 100 and 0 < y - last[1] <= 12):
                current["description"] = continuation(current["description"], joined(spans))
                last = (x, y)
            else:
                current = last = None
    missing = names - notes.keys()
    if missing:
        raise ValueError(f"{document.name}: missing class notes {sorted(missing)}")
    return list(notes.values())


def catalog_options(page: pymupdf.Page, key: str) -> list[dict]:
    options = []
    current = None
    last = None
    tier = 0
    for spans in lines(page):
        if not spans:
            continue
        first = spans[0]
        text = joined(spans)
        font = first["font"]
        if key == "Psionic Abilities" and font == "BeaufortProHeavy":
            tier = {"LESSER PSIONIC ABILITIES": 2, "GREATER PSIONIC ABILITIES": 5,
                    "SUPREME PSIONIC ABILITIES": 10}.get(text, tier)
        if font == "BeaufortProHeavy" and first["size"] >= 20 and key in {"Lyrical Weaponry", "Spellshaper", "Gadgets"}:
            if options and (key != "Lyrical Weaponry" or text != "LYRICAL WEAPONRY"):
                break
        table_title = font == "NimbleBeaufortBoldItalic" and "\x08" in text
        old_title = font == "BeaufortProHeavy-Italic" and "\x08" in text and key != "Lesser Invocations"
        inline_title = (
            font == "AvenirNextCondensed-Bold" and re.search(r"[.!?]$", first["text"].strip())
            and (key == "Chimeric Boon" and first["size"] >= 9
                 or key == "Honorable Gambits" and first["bbox"][0] > page.rect.width / 2
                 or key == "Mystic Mark" and first["bbox"][0] > page.rect.width / 2)
        )
        standalone_title = font == "BeaufortProHeavy-Italic" and (
            key == "Afflictions" and 10 <= first["size"] <= 12
            or key == "Eureka!" and first["size"] >= 20
        )
        if table_title or old_title or inline_title or standalone_title:
            title = (first["text"] if inline_title else text.split("\x08")[0]).strip().rstrip(".")
            if key == "Lesser Invocations":
                title = {"Gazeof Two Minds": "Gaze of Two Minds", "Knowledgefrom Beyond": "Knowledge from Beyond",
                         "Voiceofthe Dark": "Voice of the Dark", "Whispersofthe Grave": "Whispers of the Grave"}.get(title, title)
            if title:
                body = joined(spans[1:]) if inline_title else ""
                current = {"name": title, "description": body, "page": page.number + 1}
                if key == "Psionic Abilities":
                    current["requiredLevel"] = tier
                if key == "Commander’s Orders":
                    current["tactic"] = first["bbox"][0] > page.rect.width / 2
                options.append(current)
                last = first["bbox"]
            continue
        if (current and last and font in {"NimbleBeaufortBoldItalic", "BeaufortProHeavy-Italic"}
                and re.fullmatch(r"Passive|\d+ Actions?|Reaction", text, re.I)
                and -2 <= first["bbox"][1] - last[1] <= 20 and not current["description"]):
            current["activation"] = text
            continue
        if current and last and abs(first["bbox"][0] - last[0]) <= 14 and 0 < first["bbox"][1] - last[1] <= 20:
            if font.startswith("AvenirNextCondensed") or font in {"NimbleBeaufortBoldItalic", "BeaufortProHeavy-Italic"}:
                current["description"] = continuation(current["description"], text)
                last = first["bbox"]
    return options


def feature_index(folder: Path) -> dict:
    index = {}
    for prefix, (class_name, names) in CLASSES.items():
        files = sorted(folder.glob(f"{prefix}*.pdf"))
        if len(files) != 1:
            raise ValueError(f"Expected one class sheet for {class_name}, found {len(files)}")
        aliases = {name.rstrip("*").upper(): name.replace("*", " (story)") for name in names.split("|")}
        aliases["ROARING THUNDER"] = aliases.get("ROARING", "")
        features = []
        seen = set()
        base_levels = set()
        subclass_levels: dict[str, set[int]] = {}
        catalogs: dict[str, list[dict]] = {}
        with pymupdf.open(files[0]) as document:
            notes = class_notes(document, CLASS_NOTES[class_name])
            for page_number, key in CATALOG_PAGES.get(class_name, {}).items():
                catalogs.setdefault(key, []).extend(catalog_options(document[page_number - 1], key))
            if class_name == "Hexbinder":
                catalogs["Mystic Mark"] = catalog_options(document[3], "Mystic Mark")
            for page_index in range(2, len(document)):
                level, subclass, left = 0, "", 0.0
                current = last = None
                for spans in lines(document[page_index]):
                    if not spans:
                        continue
                    first = spans[0]
                    title = " ".join("".join(span["text"] for span in spans).split())
                    if page_index > 2 and first["font"] == "BeaufortProHeavy" and first["size"] >= 24:
                        match = aliases.get(title.upper())
                        if match:
                            subclass, level, left = match, 0, first["bbox"][0]
                            subclass_levels.setdefault(subclass, set())
                        current = last = None
                        continue
                    if page_index > 2 and not subclass:
                        continue
                    marker = LEVEL.fullmatch(first["text"].strip())
                    if marker and first["font"] == "BeaufortPro-BoldItalic":
                        current = last = None
                        level = int(marker[1])
                        left = first["bbox"][0]
                        (subclass_levels[subclass] if subclass else base_levels).add(level)
                        spans = spans[1:]
                    if not spans:
                        continue
                    first = spans[0]
                    cross_column = page_index == 2 and (
                        (class_name, level, first["text"].strip()) in {
                            ("Berserker", 4, "Savage Arsenal."),
                            ("Shadowmancer", 6, "Shadowmastery."),
                        }
                    )
                    if first["font"] != "AvenirNextCondensed-Bold" or not (cross_column or -3 <= first["bbox"][0] - left <= 46):
                        if current and last and first["font"].startswith("AvenirNextCondensed") and abs(first["bbox"][0] - last[0]) <= 10 and 0 < first["bbox"][1] - last[1] <= 16:
                            current["description"] = continuation(current["description"], joined(spans))
                            last = first["bbox"]
                        else:
                            current = last = None
                        continue
                    current = last = None
                    title_end = 1
                    while (title_end < len(spans) and not spans[title_end - 1]["text"].rstrip().endswith((".", "!", "?", "…"))
                           and spans[title_end]["font"] == first["font"]):
                        title_end += 1
                    name = joined(spans[:title_end])
                    if not name or (name[-1] not in ".!?…" and not marker):
                        continue
                    name = name.rstrip(".")
                    if name in IGNORE or (name in CLASS_NOTES[class_name] and first["size"] <= 8.3) or (not level and not subclass):
                        continue
                    if not level and not (subclass.endswith(" (story)") and name in STORY_INTROS):
                        continue
                    body = joined(spans[title_end:])
                    level_number = level or 3
                    base_name = re.sub(r" \(\d+\)$", "", name)
                    choice = (bool(CHOICE.match(body)) and name != "NO"
                              or base_name in EMBEDDED_CHOICES.get(class_name, ()) and name != "Weapon Mastery (3)"
                              or "Stat Increase" in name or name in {"+Key Stat", "+Secondary Stat"})
                    key = (subclass, level_number, name)
                    if key not in seen:
                        seen.add(key)
                        current = {"name": name, "level": level_number, "subclass": subclass,
                                   "choice": choice, "page": page_index + 1, "description": body}
                        features.append(current)
                        last = first["bbox"]
            if class_name in {"Hexbinder", "Revenant"}:
                root, catalog, count = (("Hexbinder’s Familiar", "Familiar Boons", 6) if class_name == "Hexbinder"
                                        else ("Elemental Prowess", "Elemental Prowess", 5))
                feature = next(row for row in features if row["name"] == root)
                page_text = document[feature["page"] - 1].get_text()
                block = re.search(rf"{re.escape(root)}\. .*?Choose (?:1|one)[^:\n]*?(?:\n[^:\n]*)?:\s*(•.*?)(?=LEVEL \d+)", page_text, re.S)
                if block is None:
                    raise ValueError(f"{class_name}: missing inline {catalog}")
                options = re.findall(r"•\s*([^.\n]+)\.\s*(.*?)(?=•|$)", block[1], re.S)
                if len(options) != count:
                    raise ValueError(f"{class_name}: incomplete {catalog}")
                catalogs[catalog] = [{"name": name, "description": " ".join(text.split()), "page": feature["page"]}
                                     for name, text in options]
            if class_name == "Hunter":
                # This story subclass has companion columns rather than level-heading rows.
                page = document[6]
                text = page.get_text()
                companion = re.search(r"Beastmaster\. (.*?)No Stats or Actions to Track!", text, re.S)
                if companion is None:
                    raise ValueError("Missing Beastmaster companion rules")
                variants = catalog_options(page, "Beastmaster")
                for name in ("Beastmaster Companion", "Protect Me!", "Go for the Throat!"):
                    description = (" ".join(companion[1].split()) if name == "Beastmaster Companion"
                                   else "\n\n".join(row["description"] for row in variants if row["name"] == name))
                    features.append({"name": name, "level": 3, "subclass": "Beastmaster (story)",
                                     "choice": True, "page": 7, "description": description})
            if class_name == "The Cheat":
                text = document[7].get_text()
                for name, choice in (("Honorable Gambits", True), ("Worthy Underdog", False), ("Tenacious Fighter", False)):
                    match = re.search(rf"•\s+{re.escape(name)}\. (.*?)(?=•\s|The Upper Hand\.)", text, re.S)
                    if match is None:
                        raise ValueError(f"Missing Honorseeker feature: {name}")
                    features.append({"name": name, "level": 3, "subclass": "The Honorseeker (story)",
                                     "choice": choice, "page": 8, "description": " ".join(match[1].split())})
        expected = set(aliases.values()) - {""}
        if base_levels != set(range(1, 21)) or expected != set(subclass_levels):
            raise ValueError(f"Unexpected progression headings for {class_name}: {base_levels}, {set(subclass_levels)}")
        for subclass, levels in subclass_levels.items():
            missing = levels - {f["level"] for f in features if f["subclass"] == subclass}
            if missing:
                raise ValueError(f"{class_name} / {subclass} is missing features for levels {sorted(missing)}")
        index[class_name] = {"file": files[0].name, "features": features, "catalogs": catalogs, "notes": notes}
    return index
