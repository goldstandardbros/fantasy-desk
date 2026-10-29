"""Synthetic local capture files exercise the adapter with no provider requests."""
import csv,gzip,hashlib,importlib.util,io,json,pathlib,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('observed_build',ROOT/'scripts'/'build_observed_directory.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
def csv_bytes(rows):
    f=io.StringIO();w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows);return f.getvalue().encode()
class ObservedDirectoryTests(unittest.TestCase):
    def fixture(self,root,alter=None):
        observations=[];registry=[]
        for i in range(32):
            observations.append({'dt':'2026-10-29T06:00:00Z','team':'T'+str(i),'player_name':'Synthetic '+str(i),'espn_id':str(i+1),'gsis_id':'00-'+str(i+1),'pos_abb':'QB'})
            registry.append({'gsis_id':'00-'+str(i+1),'espn_id':str(i+1),'display_name':'Synthetic '+str(i),'position':'QB'})
        if alter:alter(observations,registry)
        raw=[gzip.compress(csv_bytes(observations)),csv_bytes(registry)];paths=[]
        for i,(data,url) in enumerate(zip(raw,[mod.DEPTH_URL,mod.REGISTRY_URL])):
            p=root/('source'+str(i));p.write_bytes(data);sha=hashlib.sha256(data).hexdigest();known='2026-10-29T09:00:00Z'
            metadata={'source_url':url,'sha256':sha,'byte_size':len(data),'asset_updated_at':'2026-10-29T06:01:00Z','captured_known_at':known,'season':2026,'identity_only':True,'materialization_receipt':{'status':'ARTIFACT_MATERIALIZED_VERIFIED','source_url':url,'sha256':sha,'byte_size':len(data),'verified_at':known}}
            capture=root/('capture'+str(i)+'.json');capture.write_text(json.dumps(metadata));paths.extend([p,capture])
        return paths
    def run_build(self,alter=None):
        with tempfile.TemporaryDirectory() as temp:return mod.build(*self.fixture(pathlib.Path(temp),alter))
    def test_exact_ids_preserve_other_positions_without_activity_claims(self):
        def alter(o,r):r[0]['position']='OT'
        data=self.run_build(alter);self.assertEqual(len(data['players']),32);self.assertEqual(data['scope']['completeRoster'],False);self.assertEqual(data['players'][0]['pos'],'OT');self.assertEqual(data['scope']['unresolvedAthletes'],0)
    def test_missing_gsis_is_retained_as_unresolved_not_name_guessed(self):
        def alter(o,r):o[0]['gsis_id']=''
        data=self.run_build(alter);self.assertEqual(len(data['players']),31);self.assertEqual(len(data['observations']),32);self.assertEqual(data['scope']['unresolvedAthletes'],1)
    def test_same_name_with_conflicting_ids_is_not_joined(self):
        def alter(o,r):r[0]['espn_id']='99999'
        data=self.run_build(alter);self.assertEqual(data['scope']['unresolvedAthletes'],1);self.assertEqual(len(data['players']),31)
    def test_capture_digest_tamper_rejects_before_output(self):
        with tempfile.TemporaryDirectory() as temp:
            paths=self.fixture(pathlib.Path(temp));paths[0].write_bytes(paths[0].read_bytes()+b'tampered')
            with self.assertRaisesRegex(ValueError,'digest or byte count'):mod.build(*paths)
    def test_latest_incomplete_team_cut_does_not_borrow_older_rows(self):
        def alter(o,r):o[0]['dt']='2026-10-29T05:00:00Z'
        with self.assertRaisesRegex(ValueError,'32 teams'):self.run_build(alter)
    def test_duplicate_registry_identity_does_not_choose_first(self):
        def alter(o,r):r.append(dict(r[0]))
        data=self.run_build(alter);self.assertEqual(data['scope']['unresolvedAthletes'],1)
    def test_opaque_source_gsis_is_preserved_only_with_exact_dual_id_agreement(self):
        def alter(o,r):o[0]['gsis_id']=r[0]['gsis_id']='SOURCE_OPAQUE'
        data=self.run_build(alter);self.assertEqual(data['players'][0]['id'],'gsis:SOURCE_OPAQUE')
