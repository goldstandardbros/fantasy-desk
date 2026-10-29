'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('../lineup-rules.js');
const player=(pos='QB',slot='Bench',name='Fixture Player',extra={})=>({name,pos,nfl:'',slot,...extra});
const team=roster=>({teams:[{id:'fixture-team',name:'Fixture Team',roster}],selected:'fixture-team'});
test('named positions and FLEX follow the declared local template, never a live league claim',()=>{
  for(const pos of rules.POSITIONS)for(const slot of rules.SLOTS){
    const result=rules.assignment(player(pos),slot);
    assert.equal(result.ok,slot!=='IR'&&rules.TEMPLATE[slot].includes(pos),`${pos} → ${slot}`);
  }
  assert.equal(rules.assignment(player('QB'),'SUPERFLEX').code,'slot');
});
test('IR is unavailable without rules/status evidence; a no-op does not destroy legacy IR',()=>{
  const p=player('RB','Bench','Fixture Injured',{injuryStatus:'IR',irEligible:true});
  assert.equal(rules.add([], {...p,slot:'IR'}).code,'ir-unverified');
  assert.equal(rules.move([p],0,'IR').code,'ir-unverified');
  const legacy={...p,slot:'IR'};
  assert.equal(rules.move([legacy],0,'IR').ok,true);
  assert.equal(rules.move([legacy],0,'Bench').ok,true);
  assert.match(rules.inspect([legacy]).join(' '),/unverified/);
});
test('invalid and occupied moves leave source players and slots unchanged',()=>{
  const roster=[player('QB','QB','Fixture QB'),player('WR','FLEX','Fixture WR'),player('RB','Bench','Fixture RB')];
  const before=JSON.stringify(roster);
  assert.equal(rules.move(roster,0,'FLEX').code,'position-slot');
  assert.equal(rules.move(roster,2,'FLEX').code,'occupied');
  assert.equal(JSON.stringify(roster),before);
  const moved=rules.move(roster,1,'Bench');
  assert.equal(moved.ok,true);assert.equal(moved.roster[1].slot,'Bench');assert.equal(roster[1].slot,'FLEX');
});
test('duplicate stable IDs reject renamed records',()=>{
  const result=rules.add([player('QB','Bench','Fixture Old',{id:'espn:fixture-1'})],player('QB','Bench','Fixture New',{id:'espn:fixture-1'}));
  assert.equal(result.code,'duplicate-id');
});
test('normalized name fallback catches punctuation, accents and compact initials without merging',()=>{
  for(const [first,second] of [['Fíxture O’Neil','Fixture ONeil'],['A. J. Fixture','AJ Fixture'],['Fixture-Player','Fixture Player']]){
    assert.equal(rules.add([player('WR','Bench',first)],player('WR','Bench',second)).code,'ambiguous-name');
  }
});
test('distinct same-source IDs preserve different players with the same name',()=>{
  const roster=[player('WR','Bench','Fixture Shared',{id:'espn:one'})];
  const result=rules.add(roster,player('WR','Bench','Fixture Shared',{id:'espn:two'}));
  assert.equal(result.ok,true);assert.equal(result.roster.length,2);assert.equal(roster.length,1);
  assert.equal(rules.add(roster,player('WR','Bench','Fixture Shared',{id:'2025:two'})).code,'ambiguous-name');
});
test('invalid inputs and local safety capacity reject before mutation',()=>{
  assert.equal(rules.add([],player('P')).code,'position');
  assert.equal(rules.add([],player('QB','Bench','---')).code,'name');
  assert.equal(rules.move([],0,'Bench').code,'player');
  const full=Array.from({length:99},(_,i)=>player('WR','Bench','Fixture '+i));
  assert.equal(rules.add(full,player()).code,'capacity');assert.equal(full.length,99);
});
test('backup duplicate IDs, ambiguous names, invalid positions and occupied starters reject',()=>{
  assert.equal(rules.backup(team([player(),player()])).code,'ambiguous-name');
  assert.equal(rules.backup(team([player('QB','QB','Fixture A'),player('QB','QB','Fixture B')])).ok,false);
  assert.equal(rules.backup(team([player('QB','FLEX')])).ok,false);
  const duplicateTeams=team([]);duplicateTeams.teams.push({...duplicateTeams.teams[0]});
  assert.equal(rules.backup(duplicateTeams).ok,false);
  assert.equal(rules.backup(team([null])).ok,false);
});
test('recovery validates without mutating metadata or rejecting legacy IR as a new assignment',()=>{
  const data=team([player('RB','IR','Fixture IR',{source:'fixture-only'})]);
  data.teams[0].scoring={ppr:0.5};data.teams[0].screenshots=['fixture-attachment'];data.recoveryNote='fixture-only';
  const before=JSON.stringify(data);assert.equal(rules.backup(data).ok,true);assert.equal(JSON.stringify(data),before);
});
test('saved invalid plans are reported without rewriting or blocking a move to Bench',()=>{
  const roster=[player('QB','FLEX','Fixture QB'),player('RB','QB','Fixture RB')],before=JSON.stringify(roster);
  assert.equal(rules.inspect(roster).length,2);assert.equal(JSON.stringify(roster),before);
  assert.equal(rules.move(roster,0,'Bench').ok,true);
});
