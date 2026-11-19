# Nimble spell database

## Portable offline player edition

Double-click [Nimble-Spellbook-Offline.html](./Nimble-Spellbook-Offline.html)
or open it in a current desktop browser on Windows, macOS, or Linux. This one
file includes the Spellbook, Conditions, My Character, and player spell data. No server,
Python installation, or internet connection is needed. GM spells and notes
are omitted, and PDF page citations are shown without links to the original PDFs.
The footer lists the referenced rulebook versions and expands to show each class sheet version.
To put the reference under another site's header, see the [embedding handoff](./EMBEDDING.md).

In **My Character**, choose a class, level, and optionally a subclass to see
level unlocks and spell availability. Pick a subclass in **Feature Choices**
directly below the class selector. Class features are grouped by use and show
rules text from the supplied sheets. **Character Notes** supports titled pages
that you can add, switch between, and delete. Save the character profile to
keep changes; older notes appear on the **General** page. The casting summary shows the unlocked spell tier and the
class's mana resource; enter the requested stat to see a numeric maximum.
Selected abilities from the class catalogs appear in the ability list. Related
rules and level upgrades share entries where applicable. Core feature chains
show the current rules first, with the original progression expandable by level.
Shadowmancer's level 3 pact and later invocation choices use separate Lesser
and Greater catalogs. Psionic ability choices are limited to the ranks unlocked
when the choice is granted.
Selected catalog abilities are highlighted, while sidebars such as Rigorous
Training appear separately under **Class sheet notes & hints**.
**Progression** is expandable, like the class-sheet notes. The casting summary
sits just above **Character spells**. Pick eligible spells in the expandable
**Selectable spells** section. Once learned, a spell moves to its school group
in **Character spells** without scrolling the page. Unchecking it
returns it to **Selectable spells**. Feature-granted spell cards name the
granting feature, and **Feature Choices** links to the picker.
In **Origin & Other Ability Choices**, pick an ancestry and background from the
Core Rules. Their ability summaries appear in separate groups with PDF citations.
Academy Dropout also lets you choose a Utility Spell. Use **Add ability** for
items, boons, and other custom rules, including custom ancestries or backgrounds.
Existing freeform abilities load under **Other abilities** and can be edited
and recategorized. Save a named profile to keep these choices in the same
browser where local file storage is supported. Selections are tracking aids;
the app does not enforce every choice limit or prerequisite.

To refresh the offline file after changing the app or spell database, install
PyMuPDF and keep the class PDFs in `classes/`, then run
`py build_offline.py` on Windows (or `python3 build_offline.py` elsewhere).
Only share the file if you have permission to share the included material.

## Spell browser

In the offline HTML or Tavern reference, use the **Conditions** tab to
search core conditions and special statuses by name or effect.

Search spell names and descriptions, or filter by school and one or more
tiers. Select “All tiers” to clear the tier selection. Each school lists its
cantrips together, including utility cantrips, before leveled spells. Shared
rules such as Smoldering appear under the relevant school or class heading;
spell-specific effects and notes stay on their cards. Cantrip alternatives
get separate **OR** lines, and casting restrictions and conditional costs have
their own badges. In Legend’s Tale, each Legend’s Exert effect sits with its
normal effect. Hover, focus, or tap a dotted-underlined term to see its rule
reminder. Citations show the original PDF and page number.

Choose a class, level, and (from level 3) subclass to narrow the results.
**Choice** marks an eligible selection, not a spell the character necessarily
knows; **Conditional** means a special casting condition or GM approval
applies. Notes below the selectors explain class-specific choices. Backgrounds,
boons, items, multiclassing and other optional features are not modeled.
Earth spells referenced by Revenant are absent from the supplied spell lists.
Class sheets may print older versions of Core Rules spells; the browser uses
the Core Rules 3.3 text for those spells.

The offline HTML and Tavern reference omit GM secret spells and notes.

## Database

`spells.sqlite3` contains spell entries from the supplied Core Rules 3.3,
GM Guide 3.0, and class PDFs. The `spells` table includes school, tier (0 means cantrip,
except for Muscle Mage spells, which have Fury Dice requirements in `tags`),
casting time when specified, spell text, and the original PDF filename and
1-based PDF page number. `is_utility` marks utility cantrips; `is_secret`
marks GM Guide secret spells. Secret spells may contain GM notes and should
not automatically be shown to players. `source_details` preserves the
parenthetical details on secret spells, including concentration requirements.

The PDF presents two printed pages per PDF page. Extraction preserves the
spell text, including upcasting and explanatory notes, but line wrapping and
some formatting are normalized. Check the original PDF when exact formatting
matters. A missing casting time means no single casting time is given in the
spell heading; check the description for individual effects.

To regenerate the database with Python:

```powershell
py -m pip install -r requirements.txt
py extract_spells.py --output new-spells.sqlite3
```

The Core Rules extractor refuses to overwrite an existing database. To add
class-only spells, place the generated database at `spells.sqlite3` and run
`py extract_class_spells.py`. This verifies existing class entries rather
than overwriting differing ones. Both extractors are specific to the supplied
PDF editions. Query the database with any SQLite client, for example:

```sql
SELECT name, tier, casting_time, description, source_file, pdf_page
FROM spells
WHERE school = 'Fire' AND is_secret = 0
ORDER BY tier, name;
```
