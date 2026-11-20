"""Add class-exclusive spells from the supplied class PDFs to the database."""

import re
import sqlite3
from pathlib import Path

import pymupdf

from NimbleApp.extract_spells import RESOURCES, ROOT, clean, join_text, lines


CLASS_SHEETS = RESOURCES / "CharacterOptions"


SOURCES = [
    ("Hexbinder3.0 (1).pdf", 5, "Hexbinder", r"TIER (\d+)(?:, (.*))?", [(0, 210, 190, 565), (210, 420, 190, 540)]),
    ("Berserker3.1.pdf", 7, "Muscle Mage", r"REQ\. (\d+) FURY (?:DIE|DICE)", [(420, 630, 265, 565), (630, 839, 265, 550)]),
    ("Shadowmancer3.1.pdf", 4, "Shadowmancer", r"SHADOWMANCER ONLY, CANTRIP", [(0, 210, 160, 260), (210, 410, 160, 270)]),
    ("Shepherd3.1.pdf", 4, "Shepherd", r"SHEPHERD ONLY, CANTRIP", [(490, 839, 380, 560)]),
    ("Songweaver3.1.pdf", 4, "Songweaver", r"SONGWEAVER ONLY, CANTRIP", [(70, 410, 35, 110)]),
]


def extract_class_spells():
    records = []
    for filename, page_number, school, pattern, regions in SOURCES:
        with pymupdf.open(CLASS_SHEETS / filename) as doc:
            page_lines = lines(doc[page_number - 1])
        for left, right, top, bottom in regions:
            region = [(bbox, spans, text) for bbox, spans, text in page_lines
                      if left <= bbox[0] < right and top <= bbox[1] < bottom]
            region.sort(key=lambda item: (round(item[0][1], 1), item[0][0]))
            markers = [(bbox[1], re.fullmatch(pattern, text))
                       for bbox, _, text in region if re.fullmatch(pattern, text)]
            for index, (y, match) in enumerate(markers):
                end = markers[index + 1][0] if index + 1 < len(markers) else bottom
                entry = [(bbox, spans, text) for bbox, spans, text in region if y < bbox[1] < end]
                names = [clean("".join(s["text"] for s in spans if s["font"] == "BeaufortProHeavy-Italic"))
                         for _, spans, _ in entry
                         if any(s["font"] == "BeaufortProHeavy-Italic" and 11 <= s["size"] < 13 for s in spans)]
                names = [name for name in names if name]
                if len(names) != 1:
                    raise ValueError(f"{filename}, page {page_number}: expected one name, got {names}")
                name = names[0]
                cast = []
                body = []
                for _, spans, text in entry:
                    if any(s["font"] == "BeaufortProHeavy-Italic" and 11 <= s["size"] < 13 for s in spans):
                        timing = clean("".join(s["text"] for s in spans if s["font"] == "AvenirNextCondensed-Bold"))
                        if timing:
                            cast.append(timing)
                    elif re.fullmatch(r"\d+ Actions?", text):
                        cast.append(text)
                    elif all(s["size"] < 11 for s in spans):
                        body.append("".join(s["text"] for s in spans))
                if len(cast) != 1 or not body:
                    raise ValueError(f"{name}: invalid casting time or empty description: {cast}")
                tier = int(match.group(1)) if school == "Hexbinder" else 0
                tags = (match.group(2) if school == "Hexbinder" else
                        f"REQ. {match.group(1)} FURY {'DIE' if match.group(1) == '1' else 'DICE'}"
                        if school == "Muscle Mage" else None)
                records.append((name, school, tier, 0, 0, cast[0], tags, None, join_text(body),
                                None, str(Path("classes") / filename), page_number))
    filename = "Songweaver3.1.pdf"
    with pymupdf.open(CLASS_SHEETS / filename) as doc:
        page_text = doc[6].get_text()
    start = page_text.index("Legend’s Tale. Cantrip, 1 Action")
    end = page_text.index("LEVEL 15", start)
    text = page_text[start:end].removeprefix("Legend’s Tale. Cantrip, 1 Action").strip()
    records.append(("Legend’s Tale", "Songweaver", 0, 0, 0, "1 Action", "LEGENDS SUBCLASS",
                    None, join_text(text.splitlines()), None, str(Path("classes") / filename), 7))
    if len(records) != 23:
        raise ValueError(f"Expected 23 class-exclusive spells, found {len(records)}")
    return records


def main():
    records = extract_class_spells()
    with sqlite3.connect((ROOT / "spells.sqlite3").as_uri() + "?mode=rw", uri=True) as db:
        for record in records:
            existing = db.execute(
                """SELECT name, school, tier, is_utility, is_secret, casting_time, tags, source_details,
                          description, gm_notes, source_file, pdf_page
                   FROM spells WHERE source_file = ? AND name = ?""",
                (record[10], record[0]),
            ).fetchone()
            if existing is not None:
                if existing != record:
                    raise ValueError(f"Existing spell differs from PDF extraction: {record[0]}")
                continue
            db.execute("""INSERT INTO spells
                (name, school, tier, is_utility, is_secret, casting_time, tags, source_details,
                 description, gm_notes, source_file, pdf_page) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                record)
    print(f"Verified {len(records)} class-exclusive spells in spells.sqlite3")


if __name__ == "__main__":
    main()
