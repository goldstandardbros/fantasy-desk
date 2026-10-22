#!/usr/bin/env python3
"""Build a provenance-stamped 2026 player catalog from ESPN team rosters.
Requires network access; fails closed if team responses are incomplete.
Usage: python scripts/build_2026_players.py
"""
import datetime,json,urllib.request,pathlib,sys,os,tempfile
BASE="https://site.api.espn.com/apis/site/v2/sports/football/nfl"
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"FantasyDeskRosterAudit/0.1"})
    with urllib.request.urlopen(req,timeout=15) as response:
        return json.load(response)
def main():
    teams=fetch(BASE+"/teams").get("sports",[])
    items=teams[0]["leagues"][0]["teams"] if teams else []
    if len(items)!=32: raise RuntimeError(f"Expected 32 NFL teams, got {len(items)}")
    if len({str(x.get("team",{}).get("id")) for x in items})!=32: raise RuntimeError("Duplicate NFL team IDs")
    abbreviations=[str(x.get("team",{}).get("abbreviation") or "").strip() for x in items]
    if not all(abbreviations) or len(set(abbreviations))!=32: raise RuntimeError("Missing or duplicate NFL team abbreviations")
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    records=[];errors=[];seen=set();successful_teams=0
    for item in items:
        team=item.get("team",{})
        tid=team.get("id");abbr=team.get("abbreviation")
        if not tid or not abbr: errors.append("team metadata missing");continue
        try:
            roster=fetch(BASE+"/teams/"+str(tid)+"/roster")
            if int(roster.get("season",{}).get("year",0))!=2026:
                raise ValueError("Roster season not confirmed as 2026")
            athletes=roster.get("athletes",[])
            flat=[]
            for group in athletes:
                if isinstance(group,dict) and isinstance(group.get("items"),list):flat+=group["items"]
                elif isinstance(group,dict) and group.get("id"):flat.append(group)
            if len(flat)<20:raise ValueError("Too few athletes")
            for a in flat:
                aid=str(a.get("id") or "").strip();name=a.get("fullName") or a.get("displayName")
                pos=a.get("position",{}).get("abbreviation") if isinstance(a.get("position"),dict) else None
                if not aid.isdigit() or not isinstance(name,str) or not name.strip() or not isinstance(pos,str) or not pos.strip():raise ValueError("Invalid athlete id/name/position")
                if aid in seen:raise ValueError("Duplicate athlete id "+aid)
                seen.add(aid)
                records.append({"id":"espn:"+aid,"name":name,"pos":pos,"team":abbr,"season":2026,"source":BASE+"/teams/"+str(tid)+"/roster","checkedAt":now})
            successful_teams+=1
        except Exception as exc:errors.append(abbr+": "+str(exc))
    if errors or successful_teams!=32 or len(records)<1000:raise RuntimeError("Refusing partial catalog: "+repr(errors)+"; players="+str(len(records)))
    output={"season":2026,"generatedAt":now,"source":"ESPN public NFL team roster endpoints","status":"verified-source-snapshot","teamsChecked":successful_teams,"players":sorted(records,key=lambda p:(p["name"],p["id"]))}
    path=pathlib.Path(__file__).resolve().parents[1]/"data"/"players-2026.json"
    payload=json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n"
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(mode="w",encoding="utf-8",dir=path.parent,prefix=".players-2026-",suffix=".tmp",delete=False) as handle:
            temporary=pathlib.Path(handle.name)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary,path)
    finally:
        if temporary is not None and temporary.exists():temporary.unlink()
    print(f"Validated {len(records)} roster entries from 32 teams; wrote {path}")
if __name__=="__main__":
    try:main()
    except Exception as e:print(e,file=sys.stderr);sys.exit(1)
