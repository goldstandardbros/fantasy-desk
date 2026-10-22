"""Offline tests: no network, no GitHub Actions usage."""
import importlib.util,json,pathlib,tempfile,unittest
from unittest.mock import patch
SCRIPT=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"build_2026_players.py"
spec=importlib.util.spec_from_file_location("roster_build",SCRIPT)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def response(url,season=2026,missing=None):
    if url.endswith("/teams"):
        return {"sports":[{"leagues":[{"teams":[{"team":{"id":str(i),"abbreviation":"T"+str(i)}} for i in range(1,33)]}]}]}
    team=int(url.split("/")[-2])
    if team==missing:raise ConnectionError("source unavailable")
    return {"season":{"year":season},"athletes":[{"position":"Quarterback","items":[{"id":str(team*1000+j),"fullName":"Player "+str(team)+" "+str(j),"position":{"abbreviation":"QB"}} for j in range(40)]}]}
class RosterTests(unittest.TestCase):
    def run_build(self,season=2026,missing=None):
        with tempfile.TemporaryDirectory() as root:
            base=pathlib.Path(root)
            (base/"scripts").mkdir()
            (base/"data").mkdir()
            fake=base/"scripts"/"build_2026_players.py"
            with patch.object(mod,"__file__",str(fake)),patch.object(mod,"fetch",side_effect=lambda url:response(url,season,missing)):
                mod.main()
            return json.loads((base/"data"/"players-2026.json").read_text())
    def test_valid_catalog(self):
        data=self.run_build()
        self.assertEqual(len(data["players"]),1280)
        self.assertEqual(data["teamsChecked"],32)
        self.assertTrue(all(p["source"] and p["checkedAt"] for p in data["players"]))
    def test_full_roster_includes_nonfantasy_positions(self):
        def mixed_positions(url):
            data=response(url)
            if url.endswith('/1/roster'):
                data['athletes'][0]['items'][0]['position']['abbreviation']='OT'
                data['athletes'][0]['items'][1]['position']['abbreviation']='CB'
            return data
        with tempfile.TemporaryDirectory() as root:
            base=pathlib.Path(root)
            (base/'scripts').mkdir();(base/'data').mkdir()
            with patch.object(mod,'__file__',str(base/'scripts'/'build_2026_players.py')),patch.object(mod,'fetch',side_effect=mixed_positions):
                mod.main()
            data=json.loads((base/'data'/'players-2026.json').read_text())
        self.assertEqual(len(data['players']),1280)
        self.assertIn('OT',{p['pos'] for p in data['players']})
        self.assertIn('CB',{p['pos'] for p in data['players']})
    def test_reject_old_season(self):
        with self.assertRaises(RuntimeError):self.run_build(season=2025)
    def test_reject_duplicate_team_ids(self):
        original=mod.fetch
        def duplicate(url):
            data=response(url)
            if url.endswith("/teams"):
                data["sports"][0]["leagues"][0]["teams"][1]["team"]["id"]="1"
            return data
        with patch.object(mod,"fetch",side_effect=duplicate):
            with self.assertRaises(RuntimeError):mod.main()
    def test_reject_duplicate_abbreviations(self):
        def duplicate_abbr(url):
            data=response(url)
            if url.endswith("/teams"):
                data["sports"][0]["leagues"][0]["teams"][1]["team"]["abbreviation"]="T1"
            return data
        with patch.object(mod,"fetch",side_effect=duplicate_abbr):
            with self.assertRaises(RuntimeError):mod.main()
    def test_reject_duplicate_athlete_ids(self):
        def duplicate_athlete(url):
            data=response(url)
            if not url.endswith("/teams") and url.endswith("/2/roster"):
                data["athletes"][0]["items"][0]["id"]="1000"
            return data
        with patch.object(mod,"fetch",side_effect=duplicate_athlete):
            with self.assertRaises(RuntimeError):mod.main()
    def test_reject_missing_athlete_id(self):
        def missing_id(url):
            data=response(url)
            if url.endswith("/2/roster"):
                data["athletes"][0]["items"][0]["id"]=None
            return data
        with patch.object(mod,"fetch",side_effect=missing_id):
            with self.assertRaises(RuntimeError):mod.main()
    def test_reject_missing_team(self):
        with self.assertRaises(RuntimeError):self.run_build(missing=4)
if __name__=="__main__":unittest.main()
