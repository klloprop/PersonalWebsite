import json
import re
import unittest
from html import unescape

from NimbleApp.build_offline import build


class OfflineCharacterTests(unittest.TestCase):
    def test_build_embeds_character_unlocks_without_gm_data(self):
        html = build()
        features = json.loads(re.search(r'id="offline-features" type="application/json">(.*?)</script>', html)[1])
        spells = json.loads(re.search(r'id="offline-spells" type="application/json">(.*?)</script>', html)[1])
        self.assertIn('href="#character"', html)
        self.assertEqual(len(features), 15)
        footer = unescape(re.search(r"<footer>(.*?)</footer>", html, re.S)[1])
        self.assertIn("Core Rules 3.3", footer)
        self.assertIn("Game Master’s Guide 3.0 (cross-reference only)", footer)
        class_sources = re.findall(r"<li>(.*?)</li>", footer)
        self.assertEqual({source.rsplit(" ", 1)[0] for source in class_sources}, set(features))
        self.assertIn("Hexbinder 3.0", class_sources)
        self.assertIn("Zephyr 3.2", class_sources)
        for class_name, feature_name, level, subclass in (
            ("Songweaver", "Quick Wit", 3, ""),
            ("Songweaver", "Living Legends", 15, "Legends (story)"),
            ("Hunter", "Beastmaster Companion", 3, "Beastmaster (story)"),
        ):
            with self.subTest(feature=feature_name):
                self.assertTrue(any(
                    (row["name"], row["level"], row["subclass"]) == (feature_name, level, subclass)
                    for row in features[class_name]["features"]
                ))
        self.assertTrue(spells)
        self.assertTrue(all(not spell["is_secret"] and "gm_notes" not in spell for spell in spells))
        quick_wit = next(row for row in features["Songweaver"]["features"] if row["name"] == "Quick Wit")
        self.assertIn("expire when combat ends if unspent", quick_wit["description"])
        ballad = next(row for row in features["Songweaver"]["catalogs"]["Lyrical Weaponry"] if row["name"] == "Heroic Ballad")
        self.assertIn("+WIL damage.", ballad["description"])
        berserker = features["Berserker"]
        arsenal = next(row for row in berserker["features"] if row["name"] == "Savage Arsenal")
        self.assertEqual((arsenal["level"], arsenal["choice"]), (4, True))
        into_the_fray = next(row for row in berserker["catalogs"]["Savage Arsenal"] if row["name"] == "Into the Fray")
        self.assertEqual(into_the_fray["activation"], "1 Action")
        self.assertIn("make an attack", into_the_fray["description"])
        self.assertTrue(all(entry["notes"] for entry in features.values()))
        commander = features["Commander"]
        training = next(note for note in commander["notes"] if note["name"] == "Rigorous Training")
        self.assertIn("different Commander options available to you.", training["description"])
        self.assertFalse(any(row["name"] == "Rigorous Training" for row in commander["features"]))
        for class_name, feature_name, level in (
            ("Shadowmancer", "THE PACT IS SEALED", 3),
            ("Shadowmancer", "Shadowmastery", 6),
            ("Psion", "Powerful Mind", 2),
            ("Psion", "Powerful Mind", 5),
            ("Mage", "Spellshaper", 4),
            ("Oathsworn", "Sacred Decree", 3),
            ("Commander", "Weapon Mastery", 6),
            ("Songweaver", "I Know Just the Song", 3),
        ):
            with self.subTest(feature=feature_name, level=level):
                self.assertTrue(any(row["name"] == feature_name and row["level"] == level and row["choice"]
                                    for row in features[class_name]["features"]))
        invocations = features["Shadowmancer"]["catalogs"]
        lesser = {row["name"] for row in invocations["Lesser Invocations"]}
        greater = {row["name"] for row in invocations["Invocations"]}
        self.assertIn("Eldritch Sense", lesser)
        self.assertNotIn("Summon Shadow", lesser)
        self.assertIn("Repelling Blast", greater)
        self.assertFalse(lesser & greater)
        psion = {row["name"]: row["requiredLevel"] for row in features["Psion"]["catalogs"]["Psionic Abilities"]}
        self.assertEqual((psion["Kinetic Launch"], psion["Levitate"], psion["Mindrend"]), (2, 5, 10))
        origins = json.loads(re.search(r'id="offline-origins" type="application/json">(.*?)</script>', html)[1])
        for key in ("ancestries", "backgrounds"):
            self.assertEqual(len({entry["name"] for entry in origins[key]}), 24)
            self.assertTrue(all(entry["description"] for entry in origins[key]))
        ooze = next(row for row in origins["ancestries"] if row["name"] == "Oozeling/Construct")
        self.assertIn("magical healing heals its minimum", ooze["description"])
        self.assertTrue(next(row for row in origins["backgrounds"] if row["name"] == "Academy Dropout")["utilitySpell"])
