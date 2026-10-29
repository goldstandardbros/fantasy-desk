"""Offline synthetic mixed-position source fixture. Never fetches ESPN."""
import contextlib,importlib.util,io,json,pathlib,tempfile
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('catalog_build',ROOT/'scripts'/'build_2026_players.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
POSITIONS=('QB','RB','WR','TE','K','OT','G','C','CB','LB')
def response(url,positions=POSITIONS):
    if url.endswith('/teams'):
        return {'sports':[{'leagues':[{'teams':[{'team':{'id':str(i),'abbreviation':'T'+str(i)}} for i in range(1,33)]}]}]}
    team=int(url.split('/')[-2])
    return {'season':{'year':2026},'athletes':[{'items':[{'id':str(team*1000+i),'fullName':f'Synthetic Fixture {team} {i}','position':{'abbreviation':positions[i%len(positions)]}} for i in range(40)]}]}
def build(positions=POSITIONS,mutate=None):
    def source(url):
        data=response(url,positions)
        return mutate(url,data) if mutate else data
    with tempfile.TemporaryDirectory() as temp:
        root=pathlib.Path(temp);(root/'data').mkdir();(root/'scripts').mkdir()
        with patch.object(builder,'__file__',str(root/'scripts'/'build_2026_players.py')),patch.object(builder,'fetch',side_effect=source),contextlib.redirect_stdout(io.StringIO()):
            builder.main()
        return json.loads((root/'data'/'players-2026.json').read_text())
if __name__=='__main__':print(json.dumps(build()))
