#!/usr/bin/env python3
"""Build a complete, provenance-stamped 2026 source-athlete catalog.
The UI projects QB/RB/WR/TE/K only; all other source positions are retained.
Requires network access; fails closed if team responses are incomplete.
Usage: python scripts/build_2026_players.py
"""
import datetime,json,urllib.request,pathlib,sys
BASE="https://site.api.espn.com/apis/site/v2/sports/football/nfl"
FANTASY_POSITIONS=("QB","RB","WR","TE","K")
def timestamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()
def fetch(url):
    req=urllib.request.Request(url,headers={"User-Agent":"FantasyDeskRosterAudit/0.1"})
    with urllib.request.urlopen(req,timeout=15) as response:
        return json.load(response)
def main():
    teams=fetch(BASE+"/teams").get("sports",[])
    items=teams[0]["leagues"][0]["teams"] if teams else []
    if len(items)!=32: raise RuntimeError(f"Expected 32 NFL teams, got {len(items)}")
    records=[];sources=[];errors=[];seen=set();team_ids=set();abbreviations=set()
    for item in items:
        team=item.get("team",{})
        tid=str(team.get("id", ""));abbr=team.get("abbreviation")
        if not tid.isdigit() or not isinstance(abbr,str) or not abbr.strip() or tid in team_ids or abbr in abbreviations:
            errors.append("team identity missing or duplicated");continue
        team_ids.add(tid);abbreviations.add(abbr)
        source=BASE+"/teams/"+tid+"/roster"
        try:
            roster=fetch(source)
            if int(roster.get("season",{}).get("year",0))!=2026:
                raise ValueError("Roster season not confirmed as 2026")
            athletes=roster.get("athletes",[])
            flat=[]
            for group in athletes:
                if isinstance(group,dict) and isinstance(group.get("items"),list):flat+=group["items"]
                elif isinstance(group,dict) and group.get("id"):flat.append(group)
            if len(flat)<20:raise ValueError("Too few source athletes")
            checked=timestamp()
            for a in flat:
                aid=str(a.get("id",""));name=a.get("fullName") or a.get("displayName")
                pos=a.get("position",{}).get("abbreviation") if isinstance(a.get("position"),dict) else None
                if not aid.isdigit() or not isinstance(name,str) or not name.strip() or not isinstance(pos,str) or not pos.strip():
                    raise ValueError("Source athlete identity or position missing")
                if aid in seen:raise ValueError("Duplicate athlete id "+aid)
                seen.add(aid)
                records.append({"id":"espn:"+aid,"name":name,"pos":pos,"team":abbr,"teamId":tid,"season":2026,"source":source,"checkedAt":checked})
            sources.append({"id":tid,"abbreviation":abbr,"source":source,"checkedAt":checked})
        except Exception as exc:errors.append(abbr+": "+str(exc))
    if errors or len(records)<1000 or len(sources)!=32:
        raise RuntimeError("Refusing partial source-athlete catalog: "+repr(errors)+"; athletes="+str(len(records)))
    if not any(p["pos"] in FANTASY_POSITIONS for p in records):
        raise RuntimeError("No supported-position athletes in source catalog")
    output={"schemaVersion":2,"catalogKind":"nfl-athlete-roster","season":2026,"generatedAt":timestamp(),"source":"ESPN public NFL team roster endpoints","status":"verified-source-snapshot","teamsChecked":32,"teams":sources,"fantasyPositions":list(FANTASY_POSITIONS),"players":sorted(records,key=lambda p:(p["name"],p["id"]))}
    path=pathlib.Path(__file__).resolve().parents[1]/"data"/"players-2026.json"
    path.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n")
    supported=sum(p["pos"] in FANTASY_POSITIONS for p in records)
    print(f"Validated {len(records)} source athletes from 32 teams; {supported} supported-position athletes; wrote {path}")
if __name__=="__main__":
    try:main()
    except Exception as e:print(e,file=sys.stderr);sys.exit(1)
