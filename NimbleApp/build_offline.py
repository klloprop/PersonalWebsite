"""Build a self-contained, player-only spellbook for modern desktop browsers."""

import json
import re
import sqlite3
from contextlib import closing
from html import escape
from pathlib import Path

from NimbleApp.class_features import feature_index
from NimbleApp.extract_class_spells import CLASS_SHEETS

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "Nimble-Spellbook-Offline.html"


def main_markup(filename: str) -> str:
    html = (ROOT / filename).read_text(encoding="utf-8")
    match = re.search(r"<main>(.*?)</main>", html, flags=re.DOTALL)
    if match is None:
        raise ValueError(f"{filename} is missing its main element")
    markup = match[1]
    if filename != "my_character.html":
        markup = (markup.replace('href="/"', 'href="#spells"')
                  .replace('href="/conditions"', 'href="#conditions"')
                  .replace("</nav>", '<a href="#character">My Character</a></nav>'))
    return markup


def pdf_version(filename: str) -> str:
    match = re.search(r"(\d+\.\d+(?:\.\d+)?)(?: \(\d+\))?\.pdf$", filename, re.I)
    if match is None:
        raise ValueError(f"No PDF version found in {filename}")
    return match[1]


def build() -> str:
    database = (ROOT / "spells.sqlite3").as_uri() + "?mode=ro"
    with closing(sqlite3.connect(database, uri=True)) as db:
        db.row_factory = sqlite3.Row
        spells = [dict(row) for row in db.execute(
            """SELECT name, school, tier, is_utility, is_secret, casting_time,
                      tags, source_details, description, source_file, pdf_page
               FROM spells WHERE is_secret = 0 ORDER BY id"""
        )]
    if not spells:
        raise ValueError("The database contains no player spells")
    # Do not let spell text terminate the script data element.
    payload = json.dumps(spells, ensure_ascii=False).replace("<", "\\u003c")
    classes = feature_index(CLASS_SHEETS)
    features = json.dumps(classes, ensure_ascii=False).replace("<", "\\u003c")
    class_versions = "\n".join(
        f"<li>{escape(name)} {pdf_version(data['file'])}</li>"
        for name, data in sorted(classes.items())
    )
    origins = json.dumps(json.loads((ROOT / "character_origins.json").read_text(encoding="utf-8")),
                         ensure_ascii=False).replace("<", "\\u003c")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    scripts = "\n".join(
        f"<script>\n{(ROOT / filename).read_text(encoding='utf-8')}\n</script>"
        for filename in ("character.js", "app.js", "conditions.js", "my_character.js")
    )
    spells_markup = re.sub(r'\s*<label class="secret-toggle">.*?</label>', "", main_markup("index.html"))
    conditions_markup = main_markup("conditions.html").replace("library-title", "conditions-title")
    character_markup = main_markup("my_character.html")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">
  <title>Nimble Spellbook | Offline</title>
  <style>{css}</style>
</head>
<body>
  <div class="page-frame">
    <main>
      <div id="offline-spell-view">{spells_markup}</div>
      <div id="offline-condition-view" hidden>{conditions_markup}</div>
      <div id="offline-character-view" hidden>{character_markup}</div>
    </main>
    <footer>
      <span>NIMBLE <b>&#10022;</b> OFFLINE PLAYER REFERENCE</span>
      <span>PDF SOURCES ARE CITED, NOT INCLUDED</span>
      <div class="footer-sources">
        <p>PDF versions: Core Rules 3.3 &middot; Game Master&rsquo;s Guide 3.0</p>
        <details>
          <summary>Class sheet versions ({len(classes)})</summary>
          <ul>{class_versions}</ul>
        </details>
      </div>
    </footer>
    <noscript>Enable JavaScript in your browser to use the spellbook.</noscript>
  </div>
  <script id="offline-spells" type="application/json">{payload}</script>
  <script id="offline-features" type="application/json">{features}</script>
  <script id="offline-origins" type="application/json">{origins}</script>
  {scripts}
  <script>
    (() => {{
      if (new URLSearchParams(location.search).get("embed") === "1") {{
        document.body.classList.add("reference-embedded");
      }}
      function showPage() {{
        const view = location.hash === "#conditions" ? "condition" : location.hash === "#character" ? "character" : "spell";
        const panel = document.getElementById(`offline-${{view}}-view`);
        for (const id of ["spell", "condition", "character"]) {{
          document.getElementById(`offline-${{id}}-view`).hidden = id !== view;
        }}
        const title = panel.querySelector("h1");
        document.title = `Nimble ${{title.textContent}} | Offline`;
        window.scrollTo(0, 0);
      }}
      window.addEventListener("hashchange", showPage);
      showPage();
    }})();
  </script>
</body>
</html>
"""


if __name__ == "__main__":
    OUTPUT.write_text(build(), encoding="utf-8")
    print(f"Built {OUTPUT.name} ({OUTPUT.stat().st_size:,} bytes)")
