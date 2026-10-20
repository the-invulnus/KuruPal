import unittest
from worker import normalize, main
class Frame:
    def __getitem__(self,k):
        return {'item':['最新','涨幅'],'value':[10.5,-2.5]}[k]
class Tests(unittest.TestCase):
    def test_normalize(self):
        q=normalize('000001',Frame())
        self.assertEqual(q['pct'],-2.5)
        self.assertEqual(q['price'],10.5)
        self.assertIn('fetchedAt',q)
    def test_reject_input_before_network(self):
        self.assertTrue(main(['oops'])['errors'])
if __name__=='__main__':unittest.main()
