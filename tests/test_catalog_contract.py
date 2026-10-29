"""Offline builder checks: synthetic inputs, no provider calls or static-data writes."""
import unittest
from catalog_fixture import build,POSITIONS
class CatalogContractTests(unittest.TestCase):
    def test_full_source_and_projection_are_distinct(self):
        data=build()
        self.assertEqual(data['schemaVersion'],2)
        self.assertEqual(len(data['players']),1280)
        fantasy=[p for p in data['players'] if p['pos'] in data['fantasyPositions']]
        self.assertEqual(len(fantasy),640)
        self.assertEqual(set(p['pos'] for p in data['players']),set(POSITIONS))
        teams={t['id']:t for t in data['teams']}
        for p in data['players']:
            self.assertEqual(p['source'],teams[p['teamId']]['source'])
            self.assertEqual(p['checkedAt'],teams[p['teamId']]['checkedAt'])
            self.assertEqual(p['team'],teams[p['teamId']]['abbreviation'])
            self.assertLessEqual(p['checkedAt'],data['generatedAt'])
    def test_full_source_without_supported_positions_fails(self):
        with self.assertRaisesRegex(RuntimeError,'No supported-position'):build(('OT','CB'))
    def test_malformed_athlete_cannot_be_silently_dropped(self):
        def mutate(url,data):
            if not url.endswith('/teams'):data['athletes'][0]['items'][0].pop('position')
            return data
        with self.assertRaisesRegex(RuntimeError,'identity or position missing'):build(mutate=mutate)
    def test_duplicate_team_identity_fails(self):
        def mutate(url,data):
            if url.endswith('/teams'):
                teams=data['sports'][0]['leagues'][0]['teams'];teams[-1]=teams[0]
            return data
        with self.assertRaisesRegex(RuntimeError,'team identity missing or duplicated'):build(mutate=mutate)
    def test_duplicate_athlete_identity_fails(self):
        def mutate(url,data):
            if not url.endswith('/teams'):data['athletes'][0]['items'][1]['id']=data['athletes'][0]['items'][0]['id']
            return data
        with self.assertRaisesRegex(RuntimeError,'Duplicate athlete id'):build(mutate=mutate)
