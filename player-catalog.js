/* A complete source-athlete snapshot is distinct from its supported-position UI projection. */
(function(root){
'use strict';
const SOURCE='https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/';
const FANTASY_POSITIONS=Object.freeze(['QB','RB','WR','TE','K']);
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value)?Date.parse(value):NaN;
const failure=reason=>({ok:false,reason,athletes:[],fantasyPlayers:[]});
function read(data,{now=Date.now()}={}){
  if(!data||data.schemaVersion!==2||data.catalogKind!=='nfl-athlete-roster'||data.status!=='verified-source-snapshot'||data.season!==2026)return failure('Source catalog contract or season is not verified.');
  const generated=timestamp(data.generatedAt);
  if(!Number.isFinite(now)||!Number.isFinite(generated)||generated>now)return failure('Snapshot generation timestamp is missing, invalid or in the future.');
  if(!Array.isArray(data.fantasyPositions)||JSON.stringify(data.fantasyPositions)!==JSON.stringify(FANTASY_POSITIONS))return failure('Supported fantasy positions are not explicitly declared.');
  if(data.teamsChecked!==32||!Array.isArray(data.teams)||data.teams.length!==32)return failure('All 32 team source records are required.');
  const teams=new Map(),abbreviations=new Set();
  for(const t of data.teams){
    const checked=timestamp(t?.checkedAt);
    if(!t||typeof t.id!=='string'||!/^\d+$/.test(t.id)||teams.has(t.id)||typeof t.abbreviation!=='string'||!t.abbreviation.trim()||abbreviations.has(t.abbreviation)||t.source!==SOURCE+t.id+'/roster'||!Number.isFinite(checked)||checked>generated)return failure('Invalid or duplicate team identity, source or timestamp.');
    teams.set(t.id,{...t,count:0});abbreviations.add(t.abbreviation);
  }
  // The inherited 1,000-row threshold applies to all source athletes, not fantasy slots.
  if(!Array.isArray(data.players)||data.players.length<1000)return failure('Full source-athlete catalog is below its completeness threshold.');
  const ids=new Set();
  for(const p of data.players){
    const team=teams.get(p?.teamId),checked=timestamp(p?.checkedAt);
    if(!root.FantasyPlayerIdentity.validAthlete(p)||!/^espn:\d+$/.test(p.id)||ids.has(p.id)||p.season!==2026||!team||p.team!==team.abbreviation||p.source!==team.source||p.checkedAt!==team.checkedAt||!Number.isFinite(checked)||checked>generated)return failure('Athlete identity, season or team-source binding is invalid.');
    ids.add(p.id);team.count++;
  }
  if([...teams.values()].some(t=>t.count<20))return failure('A team source-athlete roster is below its completeness threshold.');
  const fantasyPlayers=data.players.filter(p=>FANTASY_POSITIONS.includes(p.pos));
  if(!fantasyPlayers.length||!fantasyPlayers.every(p=>root.FantasyPlayerIdentity.validPlayer(p)))return failure('No qualified supported-position athletes are present.');
  return {ok:true,reason:null,athletes:data.players,fantasyPlayers,generatedAt:data.generatedAt};
}
const DEPTH_URL='https://github.com/nflverse/nflverse-data/releases/download/depth_charts/depth_charts_2026.csv.gz';
const REGISTRY_URL='https://github.com/nflverse/nflverse-data/releases/download/players/players.csv';
function readObserved(data,{now=Date.now()}={}){
  if(!data||data.schemaVersion!==1||data.catalogKind!=='nflverse-depth-observed-directory'||data.status!=='dated-source-observations'||data.season!==2026)return failure('Not a dated nflverse observation directory.');
  const observed=timestamp(data.observedAt),generated=timestamp(data.generatedAt),scope=data.scope;
  if(!Number.isFinite(now)||!Number.isFinite(observed)||!data.observedAt.startsWith('2026-')||!Number.isFinite(generated)||observed>generated||generated>now)return failure('Observation/generation time is invalid or future.');
  if(!scope||scope.completeRoster!==false||scope.currentActivityVerified!==false||scope.leagueEligibilityVerified!==false||scope.modelProductionQualified!==false)return failure('Observed directory must not claim full-roster, activity, league or model qualification.');
  if(data.license?.name!=='CC-BY-4.0'||data.license?.url!=='https://github.com/nflverse/nflverse-data/blob/main/LICENSE.md'||!data.license.attribution||!data.license.changes)return failure('Source attribution/license/change notice missing.');
  for(const [kind,url] of [['depth',DEPTH_URL],['registry',REGISTRY_URL]]){
    const r=data.sourceReceipts?.[kind],captured=timestamp(r?.capturedAt),updated=timestamp(r?.assetUpdatedAt);
    if(!r||r.sourceUrl!==url||!/^([a-f0-9]{64})$/.test(r.sha256)||!Number.isInteger(r.byteSize)||r.byteSize<=0||!Number.isFinite(captured)||!Number.isFinite(updated)||updated>captured||captured>generated||(kind==='depth'&&observed>captured))return failure('Retained source receipt identity or time is invalid.');
  }
  if(JSON.stringify(data.fantasyPositions)!==JSON.stringify(FANTASY_POSITIONS)||!Array.isArray(data.observations)||!data.observations.length||!Array.isArray(data.players)||!Array.isArray(data.unresolved))return failure('Observation or projection contract is missing.');
  const groups=new Map(),teamSet=new Set();
  for(const r of data.observations){
    if(!r||r.dt!==data.observedAt||typeof r.team!=='string'||!r.team||typeof r.espn_id!=='string'||!/^\d+$/.test(r.espn_id)||typeof r.gsis_id!=='string')return failure('Observed role identity/time is invalid.');
    teamSet.add(r.team);const rows=groups.get(r.espn_id)||[];rows.push(r);groups.set(r.espn_id,rows);
  }
  if(teamSet.size!==32||!Array.isArray(scope.teams)||JSON.stringify([...teamSet].sort())!==JSON.stringify(scope.teams)||scope.sourceRoleRows!==data.observations.length||scope.observedAthleteIds!==groups.size||scope.matchedAthletes!==data.players.length||scope.unresolvedAthletes!==data.unresolved.length||data.sourceReceipts.depth.selectedRows!==data.observations.length||data.sourceReceipts.depth.sourceRows<data.observations.length)return failure('Observed source coverage counts do not reconcile.');
  const covered=new Set(),ids=new Set();
  for(const p of data.players){
    const identity=p?.identityRecord,rows=groups.get(p?.sourceIds?.espn);
    if(!root.FantasyPlayerIdentity.validAthlete(p)||!/^gsis:[A-Za-z0-9_-]+$/.test(p.id)||!p.sourceIds||typeof p.sourceIds.gsis!=='string'||typeof p.sourceIds.espn!=='string'||ids.has(p.id)||covered.has(p.sourceIds.espn)||p.season!==2026||p.id!=='gsis:'+p.sourceIds.gsis||p.identityMatch!=='exact-gsis-and-espn'||p.source!==DEPTH_URL||p.checkedAt!==data.sourceReceipts.depth.capturedAt||p.identitySource!==REGISTRY_URL||p.identityCheckedAt!==data.sourceReceipts.registry.capturedAt||p.observedAt!==data.observedAt||p.teamId!==p.team||!rows||!rows.every(r=>r.gsis_id===p.sourceIds.gsis&&r.team===p.team)||!identity||identity.gsis_id!==p.sourceIds.gsis||identity.espn_id!==p.sourceIds.espn||identity.display_name!==p.name||identity.position!==p.pos)return failure('Exact observed identity join or source binding is invalid.');
    covered.add(p.sourceIds.espn);ids.add(p.id);
  }
  for(const unresolved of data.unresolved){
    if(!unresolved||typeof unresolved.reason!=='string'||!unresolved.reason||!groups.has(unresolved.espnId)||covered.has(unresolved.espnId))return failure('Unresolved identity coverage is invalid.');
    covered.add(unresolved.espnId);
  }
  if(covered.size!==groups.size)return failure('An observed identity was silently dropped.');
  const fantasyPlayers=data.players.filter(p=>FANTASY_POSITIONS.includes(p.pos));
  if(!fantasyPlayers.length)return failure('No supported-position exact identities.');
  return {ok:true,reason:null,kind:'observed',athletes:data.players,fantasyPlayers,generatedAt:data.generatedAt,observedAt:data.observedAt,scope,sourceReceipts:data.sourceReceipts,license:data.license};
}
async function load(fetcher){
  for(const [url,validate] of [['data/players-2026.json',read],['data/players-2026-observed.json',readObserved]]){
    try{const response=await fetcher(url,{cache:'no-store'});if(!response.ok)continue;const result=validate(await response.json());if(result.ok)return result}catch(_){}
  }
  return failure('No qualified dated source directory is available.');
}
function describe(catalog){
  if(catalog.kind==='observed')return '2026 depth-chart observations: '+catalog.observedAt+' · '+catalog.fantasyPlayers.length+' supported-position identities from '+catalog.athletes.length+' exact matches; '+catalog.scope.teams.length+' teams observed; '+catalog.scope.unresolvedAthletes+' unresolved IDs excluded. Captured '+catalog.sourceReceipts.depth.capturedAt+'. Not a complete roster, current activity, injuries, scoring or league eligibility.';
  return '2026 dated roster snapshot: '+catalog.generatedAt+' · '+catalog.fantasyPlayers.length+' supported-position athletes from '+catalog.athletes.length+' source athletes. No team-defense entries, live transactions or league eligibility are supplied.';
}
root.FantasyPlayerCatalog={FANTASY_POSITIONS,read,readObserved,load,describe};
if(typeof module!=='undefined'&&module.exports)module.exports=root.FantasyPlayerCatalog;
})(typeof window!=='undefined'?window:globalThis);
