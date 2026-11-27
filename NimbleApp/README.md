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
directly below the class selector. Already learned abilities stay visible but
cannot be picked again. Repeatable bonuses, such as stat increases, are still
selectable. With GM approval, Beastmaster automatically replaces the first
two Thrill of the Hunt picks with **Go for the Throat!** and **Protect Me!**.
Choose the companion's size to show its traits and both abilities at your
current level using Hunter 3.0. Later Hunt picks are unchanged. Epic Boon
effects are shown in the picker using Game Master's Guide 3.0. Fixed replacements take effect
when their new feature unlocks: Professional Skulker replaces Leave No Trace,
and Captain of Legions replaces Unparalleled Tactics. The Forge swaps Necrotic
for Fire, including utility spell picks. Legends lose Lyrical Weaponry, and
Honorseekers pick Honorable Gambits at the normal Underhanded Ability levels.
Spellblades replace each Combat Tactic or Weapon Mastery pick with a choice
of a Commander’s Order or a tier 1 or lower spell under **Feature Choices**.
Class features are grouped by use and show rules text from the supplied
sheets. **Character Notes** supports titled pages
that you can add, switch between, and delete. Save the character profile to
keep changes; older notes appear on the **General** page. The casting summary shows the unlocked spell tier and the
class's mana resource; enter the requested stat to see a numeric maximum.
Class-specific resources have their own labeled boxes alongside mana and spell
tier when applicable. Manawrights see their Mana Dice capacity and die size.
Their Constant Tinkering picks list unused upgrades for inventions and gadgets
learned by that level, including subclass grants. Chosen upgrades appear on
the corresponding ability cards, and Alchemists get a separate Aetheric
Infuser upgrade at level 7.
Selected abilities from the class catalogs appear in the ability list. Related
rules and level upgrades share entries where applicable. Core feature chains
show the current rules first, with the original progression expandable by level.
Hex and Misery display their unlocked upgrades on their character cards, as do
Gravity Well, Catastrophic Release, and Crushing Mass after unlocking Singularity.
Shadowmancer's level 3 pact and later invocation choices use separate Lesser
and Greater catalogs. Psionic ability choices are limited to the ranks unlocked
when the choice is granted.
Selected catalog abilities are highlighted, while sidebars such as Rigorous
Training appear separately under **Class sheet notes & hints**.
Unlocked **Progression** features are visible alongside other abilities.
Pick eligible spells under **Feature Choices → Manage spell choices**.
Learned spells appear in their school group under **Spells**. Unchecking one
in the picker removes it from the play tabs.
In **Origin & Other Ability Choices**, pick an ancestry and background from the
Core Rules. Their ability summaries appear in separate groups with PDF citations.
Academy Dropout also lets you choose a Utility Spell. Use **Add ability** for
items, boons, and other custom rules, including custom ancestries or backgrounds.
Existing freeform abilities load under **Other abilities** and can be edited
and recategorized. Under **Saved characters**, choose a class and name, then
select **Create character**. Changes to a saved character are automatic;
edited names and note fields save when you leave them. Use **Delete character**
to remove the selected character and its notes. The standalone edition stores
profiles in the same browser where local file storage is supported. Selections are tracking aids;
the app does not enforce every choice limit or prerequisite.

Opening **My Character** restores the last saved character used in this browser,
if it still exists. In the Tavern, that preference is separate for each account.

Select **Create Character** to choose a class, ancestry and background, base
stats, and starting equipment in order. Review and name the character to save
it and open its level 1 sheet. Back preserves your choices; Cancel leaves the
current sheet unchanged. For imported or higher-level characters, use the
manual sheet controls and **Save manual sheet** instead.

Use the sheet dashboard to track health, wounds, Hit Dice, conditions, and
class resources. Ability scores stay aligned with or without a KEY badge.
On phones, health and Hit Dice each get their own row, and
skills are listed in two columns. **Override** unlocks calculated totals without
altering the underlying class rules. Use **Safe Rest** in GM-approved lodging, or spend
Hit Dice in **Field Rest** after catching your breath or making camp. Hover or
focus the info icon next to the rest buttons for requirements and effects.
**Exploration**, **Actions**, and **Reactions** filter the character's abilities
and known spells. The **Spells** section appears only when the current tab has
spells to show. Click a diamond to spend or restore an action; **End turn**
refills the bar. Select a spell card to cast it, spend the applicable mana,
and see a brief confirmation. Dotted rule terms still open their definitions
without casting. Learn or unlearn optional spells under **Feature Choices → Manage
spell choices**. Select **Upload image** in the portrait square to upload a PNG, JPEG, or WebP, then
choose a square crop. Only that crop saves with the character. Hover over the
portrait or use keyboard focus to reveal the replace and remove controls;
they stay visible on touch-only screens. Equipment, gold,
inventory, and languages remain visible farther down the sheet. Edit gold,
silver, and copper directly beside the inventory slot counter. Hover or focus
an equipped weapon, the inventory slot counter, or an active condition badge
for details. Weapon attacks and ability costs appear on the play tabs.

## Live character-sheet styling preview

From the repository root, run `node .\NimbleApp\preview.mjs` and open
<http://127.0.0.1:47922/#character>. The preview uses Tavern styling and applies
saved changes to [styles.css](./styles.css) automatically. Use `?theme=light#character`
to check the light theme. Preview characters are stored in this browser and
do not use the Tavern database. For JavaScript or markup changes, rebuild the
offline bundle and reload the preview.

In [styles.css](./styles.css), look for `.play-hp > .play-icon` (HP),
`TempHPIcon`, `ShieldIcon`, `MoveIcon`, `InitiativeIcon`,
`.play-dice-hint > .play-icon` (the bandage), and `#my-play-wounds > .play-icon`.
Edit `width` and `height` for size and `top`, `left`, or `inset-inline-*` for
position. The bandage and wounds also have overrides in the 720px media query.
The five standard Actions card icons are sized separately in the
`my-tab-actions` rules in [styles.css](./styles.css).
These icons use PNGs from the Tavern's `public/images/NimbleSheet` folder.
Increasing their CSS size does not add detail. For sharper artwork at the same
size, replace the PNGs with higher-resolution originals using the same names,
proportions, and transparent padding.
Rebuild the offline bundle after settling on your CSS changes.
The **KEY** badges mark class key stats. Abilities and spells use the highest
current total among those stats. Hover over or focus a class resource for
its full rules.

Use **Level up** to preview new class features, take the flat HP increase or
enter a roll, and allocate the new skill point. Subclass choices are offered
at level 3; other choices are available after applying the level. The direct
level selector still works for imported characters. Conditional effects and
unmodeled bonuses can be applied manually.

To refresh the offline file after changing the app, class sheets, or spell
database, install PyMuPDF and run `py -m NimbleApp.build_offline` from the
repository root. The build reads the Library's `CharacterOptions` PDFs directly.
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
py -m pip install -r NimbleApp\requirements.txt
py -m NimbleApp.extract_spells --output new-spells.sqlite3
```

The Core Rules extractor refuses to overwrite an existing database. To add
class-only spells, place the generated database at `NimbleApp\spells.sqlite3` and run
`py -m NimbleApp.extract_class_spells`. This verifies existing class entries rather
than overwriting differing ones. Both extractors are specific to the supplied
PDF editions. Query the database with any SQLite client, for example:

```sql
SELECT name, tier, casting_time, description, source_file, pdf_page
FROM spells
WHERE school = 'Fire' AND is_secret = 0
ORDER BY tier, name;
```
