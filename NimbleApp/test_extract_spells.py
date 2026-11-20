import unittest

import pymupdf

from NimbleApp.extract_spells import CORE, GMG, RULEBOOKS, extract_core, extract_secret, join_text


class SpellExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with pymupdf.open(RULEBOOKS / CORE) as core, pymupdf.open(RULEBOOKS / GMG) as gmg:
            cls.core = extract_core(core)
            cls.secret = extract_secret(gmg)
        cls.spells = {record[0]: record for record in cls.core + cls.secret}

    def test_spell_sections_and_sources(self):
        self.assertEqual(len(self.core), 73)
        self.assertEqual(len(self.secret), 11)
        self.assertEqual(len(self.spells), 84)
        self.assertEqual(self.spells["Redeem"][1:3], ("Radiant", 9))
        self.assertEqual(self.spells["Redeem"][10:], (CORE, 26))
        self.assertTrue(self.spells["Firebrand"][3])
        self.assertTrue(self.spells["Revive"][4])

    def test_spell_details_survive_layout(self):
        self.assertIn("(1/round)", self.spells["Entice"][8])
        self.assertIn("diamond worth 10,000 gp", self.spells["Redeem"][8])
        self.assertIn("1 Action", self.spells["Gravecraft"][8])
        self.assertIn("1 Minute", self.spells["Gravecraft"][8])
        self.assertIn("Concentration: up to 10 min", self.spells["Lesser Windform"][7])
        self.assertTrue(self.spells["Speak With Dead"][8].endswith("the questioner or the questions."))
        self.assertTrue(self.spells["Speak With Dead"][8].startswith("Temporarily"))
        self.assertIn("Why is this secret?", self.spells["Revive"][9])

    def test_wrapped_hyphens(self):
        self.assertEqual(join_text(["tempes\u00ad", "tuous and bath-", "sized"]), "tempestuous and bath-sized")


if __name__ == "__main__":
    unittest.main()
