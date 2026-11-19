"""Extract spell entries from the supplied Nimble PDFs into SQLite."""

import argparse
import re
import sqlite3
from pathlib import Path

import pymupdf


ROOT = Path(__file__).resolve().parent
CORE = "NimbleCoreRules3.3.pdf"
GMG = "NimbleGMG3.0.pdf"
SCHOOLS = {
    24: ("Fire", "Fire", "Ice", "Ice"),
    25: ("Lightning", "Lightning", "Wind", "Wind"),
    26: ("Radiant", "Radiant", "Necrotic", "Necrotic"),
}
HEADER = re.compile(
    r"(?:(CANTRIP|TIER \d+)(?:, (.*))?|"
    r"(FIRE|ICE|LIGHTNING|WIND|RADIANT|NECROTIC) UTILITY CANTRIP)$"
)


def clean(text):
    return text.replace("\x08", "").replace("\u00ad", "").strip()


def lines(page):
    result = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            spans = line["spans"]
            text = clean("".join(span["text"] for span in spans))
            if text:
                result.append((line["bbox"], spans, text))
    return result


def join_text(parts):
    # Soft hyphens indicate a word split at the end of a PDF line.
    result = ""
    for part in parts:
        part = part.replace("\x08", "").strip()
        if not part:
            continue
        if result.endswith("\u00ad"):
            result = result[:-1] + part
        elif result.endswith("-"):
            result += part
        else:
            result += (" " if result else "") + part
    return result.replace("\u00ad", "")


def extract_core(doc):
    records = []
    for page_number in range(24, 28):
        page = doc[page_number - 1]
        all_lines = lines(page)
        markers = []
        for bbox, spans, text in all_lines:
            match = HEADER.fullmatch(text)
            if match:
                column = min(int(bbox[0] / (page.rect.width / 4)), 3)
                school = match.group(3).title() if match.group(3) else SCHOOLS[page_number][column]
                markers.append((column, bbox[1], match, school))

        for column, top, match, school in markers:
            redeem = page_number == 26 and column == 0 and top > 500
            lower = [
                y for c, y, _, _ in markers
                if c == column and y > top
            ]
            bottom = min(lower, default=568)
            if page_number == 26 and column == 1:
                bottom = min(bottom, 500)
            left = column * page.rect.width / 4
            right = (column + 1) * page.rect.width / 4
            if redeem:
                left, right = 0, page.rect.width / 2
            candidates = [
                (bbox, spans, text)
                for bbox, spans, text in all_lines
                if left <= bbox[0] < right and top < bbox[1] < bottom
            ]
            candidates.sort(key=lambda item: (round(item[0][1], 1), item[0][0]))
            names = [
                clean("".join(s["text"] for s in spans
                              if s["font"] == "BeaufortProHeavy-Italic" and 11 <= s["size"] < 13))
                for _, spans, _ in candidates
            ]
            names = [name for name in names if name]
            if len(names) != 1:
                raise ValueError(f"{CORE} page {page_number}: expected one spell name, got {names}")
            name = names[0]
            cast = []
            body = []
            for bbox, spans, text in candidates:
                if any(s["font"] == "BeaufortProHeavy-Italic" and 11 <= s["size"] < 13 for s in spans):
                    # The time can share a line with the title.
                    timing = clean("".join(s["text"] for s in spans if s["font"] == "AvenirNextCondensed-Bold"))
                    if timing:
                        cast.append(timing)
                    qualifier = clean("".join(s["text"] for s in spans if s["font"] == "AvenirNextCondensed-Medi"))
                    if qualifier:
                        body.append(qualifier)
                elif re.fullmatch(r"\d+ (?:Actions?|Minutes?|Hours?|Days?)", text):
                    cast.append(text)
                elif all(s["size"] < 11 for s in spans):
                    body.append("".join(s["text"] for s in spans))
            if len(cast) > 1:
                raise ValueError(f"{name}: multiple casting times: {cast}")
            tier = 0 if match.group(3) or match.group(1) == "CANTRIP" else int(match.group(1).split()[1])
            records.append((name, school, tier, bool(match.group(3)), False,
                            cast[0] if cast else None, match.group(2), None, join_text(body),
                            None, CORE, page_number))
    return records


def extract_secret(doc):
    page_number = 37
    page = doc[page_number - 1]
    all_lines = lines(page)
    records = []
    for left, right in ((420, 630), (630, page.rect.width)):
        selected = [(bbox, spans, text) for bbox, spans, text in all_lines
                    if left <= bbox[0] < right and 105 < bbox[1] < 568]
        selected.sort(key=lambda item: (item[0][1], item[0][0]))
        current = None
        notes = False
        for _, spans, text in selected:
            first = clean(spans[0]["text"])
            if spans[0]["font"] == "AvenirNextCondensed-Bold" and re.fullmatch(r".+\.", first) and "(" in text:
                if current:
                    records.append(current)
                current = {"name": first[:-1], "body": ["".join(s["text"] for s in spans[1:])], "notes": []}
                notes = False
            elif current:
                if text.startswith("Why is this secret?"):
                    notes = True
                current["notes" if notes else "body"].append("".join(s["text"] for s in spans))
            elif records:
                records[-1]["body"].append("".join(s["text"] for s in spans))
        if current:
            records.append(current)

    output = []
    for record in records:
        body = join_text(record["body"])
        metadata = re.match(r"\(([^)]+)\)\s*(.*)", body)
        if not metadata:
            raise ValueError(f"Missing spell metadata for {record['name']}")
        info, description = metadata.groups()
        school = re.search(r"\b(Fire|Ice|Lightning|Wind|Radiant|Necrotic)\b", info)
        tier = re.search(r"\bTier (\d+)\b", info)
        if not school or (not tier and "cantrip" not in info.lower()):
            raise ValueError(f"Invalid spell metadata for {record['name']}: {info}")
        cast = re.search(r"casting time:\s*([^,]+)|(\d+ Actions?)", info, re.I)
        casting_time = (cast.group(1) or cast.group(2)).strip() if cast else None
        output.append((record["name"], school.group(1), int(tier.group(1)) if tier else 0,
                       False, True, casting_time, None, info, description,
                       join_text(record["notes"]) or None, GMG, page_number))
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "spells.sqlite3")
    args = parser.parse_args()
    if args.output.exists():
        parser.error(f"output already exists: {args.output}")
    with pymupdf.open(ROOT / CORE) as core, pymupdf.open(ROOT / GMG) as gmg:
        records = extract_core(core) + extract_secret(gmg)
    if len(records) != 84 or sum(record[4] for record in records) != 11:
        raise ValueError(f"Unexpected extraction count: {len(records)}; expected 73 core and 11 secret spells")
    with sqlite3.connect(args.output) as db:
        db.execute("""CREATE TABLE spells (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            school TEXT NOT NULL,
            tier INTEGER NOT NULL,
            is_utility INTEGER NOT NULL,
            is_secret INTEGER NOT NULL,
            casting_time TEXT,
            tags TEXT,
            source_details TEXT,
            description TEXT NOT NULL,
            gm_notes TEXT,
            source_file TEXT NOT NULL,
            pdf_page INTEGER NOT NULL,
            UNIQUE (source_file, name)
        )""")
        db.executemany("""INSERT INTO spells
            (name, school, tier, is_utility, is_secret, casting_time, tags, source_details, description,
             gm_notes, source_file, pdf_page)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", records)
    print(f"Saved {len(records)} spells to {args.output}")


if __name__ == "__main__":
    main()
