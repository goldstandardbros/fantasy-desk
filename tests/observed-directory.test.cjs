'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../player-identity.js');const catalog=require('../player-catalog.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/players-2026-observed.json'),'utf8'));
const clone=()=>structuredClone(data);
test('retained real directory reconciles all role rows, exact identities and unresolved IDs without roster claims',()=>{
  const result=catalog.readObserved(data);assert.equal(result.ok,true,result.reason);assert.equal(result.fantasyPlayers.length,627);assert.equal(result.athletes.length,1988);assert.equal(result.scope.sourceRoleRows,2308);assert.equal(result.scope.observedAthleteIds,1995);assert.equal(result.scope.unresolvedAthletes,7);
  assert.equal(result.scope.completeRoster,false);assert.equal(result.scope.currentActivityVerified,false);assert.equal(result.scope.leagueEligibilityVerified,false);assert.equal(result.scope.modelProductionQualified,false);
  assert.equal(catalog.read(data).ok,false,'observations must not pass ESPN full-roster contract');
});
test('changed exact join, source date/URL, coverage or qualification claims fail closed',()=>{
  const edits=[d=>d.players[0].sourceIds.gsis='00-0000000',d=>d.players[0].identityRecord.espn_id='0',d=>delete d.players[0].sourceIds,d=>d.players[0].team='OTHER',d=>d.players[0].identityMatch='name-guess',d=>d.players[0].identitySource='https://example.invalid',d=>d.players[0].observedAt='2025-01-01T00:00:00Z',d=>d.scope.completeRoster=true,d=>d.scope.currentActivityVerified=true,d=>d.scope.leagueEligibilityVerified=true,d=>d.scope.matchedAthletes++,d=>d.observations.pop(),d=>d.unresolved.pop(),d=>d.generatedAt='2099-01-01T00:00:00Z',d=>delete d.license,d=>d.sourceReceipts.depth.sha256='wrong'];
  for(const edit of edits){const changed=clone();edit(changed);const result=catalog.readObserved(changed);assert.equal(result.ok,false);assert.deepEqual(result.fantasyPlayers,[])}
});
test('same-origin loader distinguishes observation fallback from unavailable source, no provider requests',async()=>{
  const calls=[];const result=await catalog.load(async url=>{calls.push(url);return {ok:true,json:async()=>url.endsWith('-observed.json')?data:{season:2026,status:'not-populated',players:[]}}});
  assert.equal(result.kind,'observed');assert.deepEqual(calls,['data/players-2026.json','data/players-2026-observed.json']);
  assert.equal((await catalog.load(async()=>({ok:false}))).ok,false);
});
