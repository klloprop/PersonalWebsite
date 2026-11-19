import unittest

from NimbleApp.extract_class_spells import extract_class_spells


class ClassSpellTests(unittest.TestCase):
    def test_class_spell_sources_and_layout(self):
        records = extract_class_spells()
        spells = {record[0]: record for record in records}
        self.assertEqual(len(records), 23)
        self.assertEqual(len(spells), 23)
        self.assertEqual(spells["Life Bloom"][1:3], ("Hexbinder", 1))
        self.assertEqual(spells["Life Bloom"][11], 5)
        self.assertEqual(spells["Powershout: WEAKLINGS!"][6], "REQ. 6 FURY DICE")
        self.assertIn("Shadow Limit", spells["Summon Shadow"][8])
        self.assertIn("Rushed Attack", spells["Lifebinding Spirit"][8])
        self.assertIn("The Stiletto", spells["Legend’s Tale"][8])
        self.assertIn("LEVEL 7", spells["Legend’s Tale"][8])


if __name__ == "__main__":
    unittest.main()
