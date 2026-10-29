'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
require('../player-identity.js');const catalog=require('../player-catalog.js');
const mixed=JSON.parse(execFileSync('python',[path.join(__dirname,'catalog_fixture.py')],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'}));
const clone=()=>structuredClone(mixed);
test('actual Python builder output qualifies full source plus nonempty supported-position projection',()=>{
  const result=catalog.read(mixed);assert.equal(result.ok,true,result.reason);assert.equal(result.athletes.length,1280);assert.equal(result.fantasyPlayers.length,640);
  assert.equal(result.athletes.filter(p=>['OT','G','C','CB','LB'].includes(p.pos)).length,640);
  assert.equal(result.fantasyPlayers.every(p=>p.id&&p.season===2026&&['QB','RB','WR','TE','K'].includes(p.pos)),true);
  assert.equal(mixed.players.every(p=>globalThis.FantasyPlayerIdentity.validPlayer(p)),false,'original every-fantasy-position consumer rejects this valid mixed fixture');
  if(process.env.CATALOG_REPORT)fs.writeFileSync(process.env.CATALOG_REPORT,JSON.stringify({kind:'synthetic fixture from actual Python builder; not live data',sourceAthletes:result.athletes.length,positions:[...new Set(result.athletes.map(p=>p.pos))],supportedPositionAthletes:result.fantasyPlayers.length,oldConsumerAccepts:false,newConsumerAccepts:result.ok,firstSupported:result.fantasyPlayers[0],firstOther:result.athletes.find(p=>p.pos==='OT')},null,2));
});
test('source completeness threshold is not improperly transferred to the smaller projection',()=>{
  const data=clone();for(const p of data.players)p.pos='OT';data.players[0].pos='QB';
  const result=catalog.read(data);assert.equal(result.ok,true);assert.equal(result.fantasyPlayers.length,1);
  data.players[0].pos='OT';assert.equal(catalog.read(data).ok,false);
});
test('unpopulated static source and legacy undeclared contract stay unavailable',()=>{
  const empty=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/players-2026.json'),'utf8'));
  assert.equal(catalog.read(empty).ok,false);assert.equal(empty.players.length,0);
  const data=clone();delete data.schemaVersion;assert.equal(catalog.read(data).ok,false);
});
test('mixed or wrong-season identity, duplicate ID and mismatched team source fail closed',()=>{
  const edits=[d=>d.players[0].season=2025,d=>d.players[1].id=d.players[0].id,d=>d.players[0].team='OTHER',d=>d.players[0].teamId='99',d=>d.players[0].source='https://example.invalid/roster',d=>d.players[0].checkedAt='2000-01-01T00:00:00Z',d=>d.teams[0].source='https://example.invalid/roster'];
  for(const edit of edits){const data=clone();edit(data);const result=catalog.read(data);assert.equal(result.ok,false);assert.deepEqual(result.fantasyPlayers,[])}
});
test('all 32 distinct team sources, source counts and timestamps are required',()=>{
  const edits=[d=>d.teams.pop(),d=>d.teams[1].id=d.teams[0].id,d=>d.players=d.players.slice(0,999),d=>d.players=d.players.filter(p=>p.teamId!=='1'),d=>d.generatedAt='2099-01-01T00:00:00Z',d=>d.generatedAt=null,d=>d.fantasyPositions.push('D/ST')];
  for(const edit of edits){const data=clone();edit(data);assert.equal(catalog.read(data).ok,false)}
});
test('non-fantasy positions are preserved, not discarded or converted into team defense',()=>{
  const data=clone();const p=data.players.find(p=>p.pos==='OT');p.pos='UNRECOGNIZED_SOURCE_POSITION';
  const result=catalog.read(data);assert.equal(result.ok,true);assert.equal(result.athletes.find(x=>x.id===p.id).pos,'UNRECOGNIZED_SOURCE_POSITION');assert.equal(result.fantasyPlayers.some(x=>x.id===p.id),false);assert.equal(result.fantasyPlayers.some(x=>x.pos==='D/ST'),false);
});
