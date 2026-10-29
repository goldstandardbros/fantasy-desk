#!/usr/bin/env python3
"""Offline adapter for retained nflverse depth/identity captures. No network code.
Not a full roster, current activity claim, league eligibility or ESPN-direct fetch.
"""
import argparse,collections,csv,datetime,gzip,hashlib,io,json,pathlib
DEPTH_URL='https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_2026.csv.gz'
REGISTRY_URL='https://github.com/nflverse/nflverse-data/releases/download/players/players.csv'
POSITIONS=['QB','RB','WR','TE','K']
def time(value):
    result=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
    if result.tzinfo is None:raise ValueError('Source timestamp needs timezone')
    return result

def captured(path,receipt_path,url):
    raw=path.read_bytes();receipt=json.loads(receipt_path.read_text());materialized=receipt.get('materialization_receipt',{})
    digest=hashlib.sha256(raw).hexdigest()
    if receipt.get('source_url')!=url or materialized.get('source_url')!=url or materialized.get('status')!='ARTIFACT_MATERIALIZED_VERIFIED':raise ValueError('Source capture contract mismatch')
    if receipt.get('sha256')!=digest or materialized.get('sha256')!=digest or receipt.get('byte_size')!=len(raw) or materialized.get('byte_size')!=len(raw):raise ValueError('Source capture digest or byte count mismatch')
    known=receipt['captured_known_at']
    if materialized.get('verified_at')!=known or time(receipt['asset_updated_at'])>time(known):raise ValueError('Capture timing mismatch')
    return raw,receipt,{'sourceUrl':url,'sha256':digest,'byteSize':len(raw),'capturedAt':known,'assetUpdatedAt':receipt['asset_updated_at']}

def build(depth,depth_capture,registry,registry_capture):
    depth_raw,depth_meta,depth_receipt=captured(depth,depth_capture,DEPTH_URL)
    registry_raw,registry_meta,registry_receipt=captured(registry,registry_capture,REGISTRY_URL)
    if depth_meta.get('season')!=2026 or registry_meta.get('identity_only') is not True:raise ValueError('Season/identity-only source contract mismatch')
    latest=None;latest_time=None;times={};observations=[];source_rows=0
    with gzip.GzipFile(fileobj=io.BytesIO(depth_raw)) as compressed:
        for row in csv.DictReader(io.TextIOWrapper(compressed,encoding='utf-8')):
            source_rows+=1;dt=row.get('dt','')
            if not dt:raise ValueError('Depth observation time missing')
            if dt not in times:times[dt]=time(dt)
            if latest_time is None or times[dt]>latest_time:latest=dt;latest_time=times[dt];observations=[]
            if times[dt]==latest_time:
                if dt!=latest:raise ValueError('Equivalent observation times have inconsistent representations')
                observations.append(row)
    if time(latest).year!=2026 or time(latest)>time(depth_receipt['capturedAt']):raise ValueError('Depth observation time outside captured season')
    grouped=collections.defaultdict(list)
    for row in observations:
        if not row.get('espn_id','').isdigit() or not row.get('team'):raise ValueError('Observed identity/team missing')
        grouped[row['espn_id']].append(row)
    teams=sorted({r['team'] for r in observations})
    if len(teams)!=32:raise ValueError('Latest depth observation does not cover 32 teams')
    by_gsis=collections.defaultdict(list);by_espn=collections.defaultdict(list)
    for p in csv.DictReader(io.StringIO(registry_raw.decode('utf-8'))):
        if p.get('gsis_id'):by_gsis[p['gsis_id']].append(p)
        if p.get('espn_id'):by_espn[p['espn_id']].append(p)
    players=[];unresolved=[];seen=set()
    for eid,rows in sorted(grouped.items()):
        gsis={r.get('gsis_id','') for r in rows};player_teams={r['team'] for r in rows}
        reason=None;identity=None
        if len(gsis)!=1 or not next(iter(gsis)):reason='missing-or-conflicting-source-gsis'
        elif len(player_teams)!=1:reason='conflicting-observed-teams'
        else:
            gid=next(iter(gsis));a=by_gsis[gid];b=by_espn[eid]
            if len(a)!=1 or len(b)!=1 or a[0] is not b[0]:reason='missing-or-ambiguous-exact-registry-join'
            else:identity=a[0]
        if identity is not None and (not identity.get('display_name') or not identity.get('position')):reason='registry-name-or-position-missing'
        if reason:
            unresolved.append({'espnId':eid,'gsisIds':sorted(gsis),'teams':sorted(player_teams),'observedNames':sorted({r.get('player_name','') for r in rows}),'reason':reason});continue
        gid=identity['gsis_id']
        if gid in seen:raise ValueError('One GSIS identity maps to multiple observed ESPN IDs')
        seen.add(gid);team=next(iter(player_teams))
        players.append({'id':'gsis:'+gid,'name':identity['display_name'],'pos':identity['position'],'team':team,'teamId':team,'season':2026,'source':DEPTH_URL,'checkedAt':depth_receipt['capturedAt'],'observedAt':latest,'sourceIds':{'gsis':gid,'espn':eid},'identityMatch':'exact-gsis-and-espn','identitySource':REGISTRY_URL,'identityCheckedAt':registry_receipt['capturedAt'],'identityRecord':{k:identity[k] for k in ['gsis_id','espn_id','display_name','position']},'observedNames':sorted({r.get('player_name','') for r in rows})})
    if not any(p['pos'] in POSITIONS for p in players):raise ValueError('No supported-position exact identities')
    generated=datetime.datetime.now(datetime.timezone.utc).isoformat()
    if max(time(depth_receipt['capturedAt']),time(registry_receipt['capturedAt']))>time(generated):raise ValueError('Capture is in the future')
    depth_receipt.update(sourceRows=source_rows,selectedRows=len(observations))
    return {'schemaVersion':1,'catalogKind':'nflverse-depth-observed-directory','status':'dated-source-observations','season':2026,'observedAt':latest,'generatedAt':generated,'sourceReceipts':{'depth':depth_receipt,'registry':registry_receipt},'license':{'name':'CC-BY-4.0','url':'https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md','attribution':'nflverse contributors','changes':'Latest shared depth observation selected; exact GSIS plus ESPN registry join; unsupported positions retained outside fantasy projection; unresolved identities excluded from discovery.'},'scope':{'teams':teams,'sourceRoleRows':len(observations),'observedAthleteIds':len(grouped),'matchedAthletes':len(players),'unresolvedAthletes':len(unresolved),'completeRoster':False,'currentActivityVerified':False,'leagueEligibilityVerified':False,'modelProductionQualified':False},'fantasyPositions':POSITIONS,'observations':observations,'players':sorted(players,key=lambda p:(p['name'],p['id'])),'unresolved':unresolved}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['depth','depth-capture','registry','registry-capture','output']:parser.add_argument('--'+name,type=pathlib.Path,required=True)
    args=parser.parse_args();data=build(args.depth,args.depth_capture,args.registry,args.registry_capture)
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'output':str(args.output),'scope':data['scope'],'supportedPositionAthletes':sum(p['pos'] in POSITIONS for p in data['players']),'observedAt':data['observedAt'],'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest()},indent=2))
if __name__=='__main__':main()
