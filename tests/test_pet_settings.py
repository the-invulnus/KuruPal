import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1] / 'codex-plugin-distribution/plugins/kurupal/scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('pet_settings', SCRIPTS / 'settings.py')
settings = importlib.util.module_from_spec(spec)
spec.loader.exec_module(settings)

class SettingsTest(unittest.TestCase):
    def test_preserve_add_remove_replace_and_size(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            (base/'settings.json').write_text(json.dumps({'size':'medium','watchlist':['000001'],'opacity':75,'schemaVersion':1}))
            value = settings.change(base, size='small', add=['600519','000001'])
            self.assertEqual(value['watchlist'], ['000001','600519'])
            value = settings.change(base, remove=['000001'])
            self.assertEqual(value['watchlist'], ['600519'])
            self.assertEqual(value['size'], 'small')
            self.assertEqual(settings.change(base, replace=[])['watchlist'], [])
            self.assertEqual(settings.read(base)['schemaVersion'], 1)
            self.assertEqual(settings.read(base)['opacity'], 75)

    def test_invalid_edit_leaves_existing_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            initial = {'size':'large','watchlist':['000001']}
            (base/'settings.json').write_text(json.dumps(initial))
            for patch in ({'size':'giant'}, {'add':['bad']}, {'replace':['000001','000002','000003','000004','000005','000006']}):
                with self.assertRaises(ValueError): settings.change(base, **patch)
                self.assertEqual(settings.read(base), initial)
                self.assertFalse((base/'settings.lock').exists())

    def test_missing_migration_does_not_create_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            with self.assertRaises(ValueError): settings.change(base, size='small')
            self.assertFalse((base/'settings.json').exists())

if __name__ == '__main__': unittest.main()
