'use strict';
/* Executes the real page scripts with a minimal DOM adapter. Not a browser/render test. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const KEY='fantasy-desk-my-teams-v1',ROOT=path.resolve(__dirname,'..');
class Element {
  constructor(tag='div',value=''){this.tagName=tag;this.value=value;this.children=[];this.options=[];this.files=[];this.hidden=false;this.textContent='';this.listeners={};this.disabled=false}
  add(option){this.options.push(option);if(this.options.length===1&&!this.value)this.value=option.value}
  append(child){this.children.push(child)}
  replaceChildren(){this.children=[];this.options=[];this.value=''}
  setAttribute(name,value){this[name]=value}
  addEventListener(name,handler){this.listeners[name]=handler}
  focus(){} click(){return this.onclick?.()}
  get selectedOptions(){return this.options.filter(o=>o.value===this.value)}
}
class Option extends Element {constructor(text,value){super('option',value);this.textContent=text}}
async function app(data,{root=ROOT}={}){
  const html=fs.readFileSync(path.join(root,'my-teams.html'),'utf8'),elements=new Map();
  for(const id of html.matchAll(/id="([^"]+)"/g))elements.set(id[1],new Element());
  for(const [id,values] of [['position',['QB','RB','WR','TE','K','D/ST']],['slot',['Bench','QB','RB1','RB2','WR1','WR2','TE','FLEX','K','D/ST','IR']]]){
    for(const v of values)elements.get(id).add(new Option(v,v));elements.get(id).value=values[0];
  }
  const storage=new Map([[KEY,JSON.stringify(data)]]),dialogs=[],blobs=new Map(),downloads=[];
  const state={confirm:true,dialogs,elements,storage,downloads,failWrite:false};
  const document={getElementById:id=>elements.get(id),createElement:tag=>{const e=new Element(tag);if(tag==='a')e.click=()=>downloads.push(blobs.get(e.href));return e}};
  const sandbox={document,Option,Blob,console,setTimeout:fn=>fn(),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>{if(state.failWrite)throw Error('Synthetic storage write failure');storage.set(k,v)}},
    confirm:message=>{dialogs.push(message);return state.confirm},alert:message=>dialogs.push(message),prompt:()=>null,
    URL:{createObjectURL:blob=>{const id='blob:'+blobs.size;blobs.set(id,blob);return id},revokeObjectURL:()=>{}},
    fetch:async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'data/players-2026.json'),'utf8'))})};
  sandbox.window=sandbox;vm.createContext(sandbox);
  for(const src of html.matchAll(/<script src="([^"]+)"><\/script>/g))vm.runInContext(fs.readFileSync(path.join(root,src[1]),'utf8'),sandbox,{filename:src[1]});
  vm.runInContext(html.split('<script>')[1].split('</script>')[0],sandbox,{filename:'my-teams-inline.js'});
  await new Promise(resolve=>setImmediate(resolve));
  state.el=id=>elements.get(id);state.read=()=>JSON.parse(storage.get(KEY));state.message=()=>state.el('message').textContent;
  state.move=(index,slot)=>{const select=state.el('roster').children[index].children[3].children[0];select.value=slot;select.onchange()};
  state.add=(name,pos,slot)=>{for(const [id,value] of Object.entries({player:name,position:pos,slot}))state.el(id).value=value;state.el('add').onclick()};
  state.import=async data=>{state.el('importFile').files=[{size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)}];await state.el('importFile').onchange()};
  return state;
}
const player=(name,pos,slot='Bench',extra={})=>({name,pos,nfl:'',slot,...extra});
const fixture=roster=>({teams:[{id:'fixture',name:'Fixture Team',league:'Synthetic only',roster}],selected:'fixture'});
test('real selection handler rejects incompatible and occupied moves before saving',async()=>{
  const a=await app(fixture([player('Fixture QB','QB','QB'),player('Fixture WR','WR','FLEX'),player('Fixture RB','RB')]));
  const before=a.read();a.move(0,'FLEX');assert.match(a.message(),/QB cannot use FLEX/);assert.deepEqual(a.read(),before);
  a.move(2,'FLEX');assert.match(a.message(),/occupied/);assert.deepEqual(a.read(),before);
  a.move(1,'Bench');a.move(2,'FLEX');assert.deepEqual(a.read().teams[0].roster.map(p=>p.slot),['QB','Bench','FLEX']);
});
test('real manual-add handler rejects duplicate names, forced IR, and records matched directory identity',async()=>{
  const a=await app(fixture([]));a.add('Fixture A. J.','WR','Bench');const before=a.read();
  a.add('Fixture AJ','WR','Bench');assert.match(a.message(),/ambiguous/);assert.deepEqual(a.read(),before);
  a.add('Fixture Injured','RB','IR');assert.match(a.message(),/IR assignment unavailable/);assert.deepEqual(a.read(),before);
  a.add('Josh Allen','QB','QB');assert.equal(a.read().teams[0].roster.at(-1).id,'2025:00-0034857');
});
test('real bulk-import handler rolls back every row on conflict and prevents repeat import',async()=>{
  const a=await app(fixture([])),before=a.read();
  a.el('bulk').value='Fixture Good,WR,,WR1\nFixture Bad,QB,,FLEX';a.el('bulkAdd').onclick();
  assert.match(a.message(),/Import not applied/);assert.deepEqual(a.read(),before);assert.equal(a.dialogs.length,0);
  a.el('bulk').value='Fixture One,WR,,WR1\nFixture Two,WR,,WR1';a.el('bulkAdd').onclick();assert.deepEqual(a.read(),before);
  a.el('bulk').value='Fixture One,WR,,WR1\nFixture Two,RB,,FLEX';a.el('bulkAdd').onclick();
  assert.equal(a.read().teams[0].roster.length,2);const imported=a.read();a.el('bulkAdd').onclick();assert.deepEqual(a.read(),imported);
});
test('real backup handler rejects duplicates before confirmation, preserves recovery metadata and actual export bytes',async()=>{
  const a=await app(fixture([])),before=a.read();
  await a.import(fixture([player('Fixture A','WR','Bench',{id:'espn:fixture'}),player('Fixture B','WR','Bench',{id:'espn:fixture'})]));
  assert.match(a.message(),/Player ID already/);assert.deepEqual(a.read(),before);assert.equal(a.dialogs.length,0);
  const recovery=fixture([player('Fixture IR','RB','IR')]);recovery.recovery='Synthetic';recovery.teams[0].scoring={ppr:0.5};recovery.teams[0].screenshots=['fixture-only.png'];
  await a.import(recovery);assert.deepEqual(a.read(),recovery);assert.match(a.el('lineupIssues').textContent,/unverified/);
  a.el('export').onclick();assert.deepEqual(JSON.parse(await a.downloads[0].text()),recovery);
  const reopened=await app(a.read());assert.deepEqual(reopened.read(),recovery);reopened.move(0,'Bench');assert.equal(reopened.read().teams[0].roster[0].slot,'Bench');
});
test('real cancel flows leave storage unchanged and invalid legacy plan is repairable',async()=>{
  const a=await app(fixture([player('Fixture QB','QB','FLEX')])),before=a.read();
  assert.match(a.el('lineupIssues').textContent,/QB cannot use FLEX/);assert.deepEqual(a.read(),before);
  a.confirm=false;await a.import(fixture([player('Fixture Other','RB')]));assert.deepEqual(a.read(),before);
  a.el('new').onclick();a.el('teamName').value='Do not save';a.el('cancelTeam').onclick();assert.equal(a.el('teamForm').hidden,true);assert.deepEqual(a.read(),before);
  a.move(0,'Bench');assert.equal(a.read().teams[0].roster[0].slot,'Bench');
});
test('99-team local safety limit prevents a save that could be lost on reload',async()=>{
  const data=fixture([]);data.teams=Array.from({length:99},(_,i)=>({id:'fixture'+i,name:'Fixture '+i,roster:[]}));data.selected='fixture0';
  const a=await app(data);a.el('teamName').value='Fixture 100';a.el('saveTeam').onclick();assert.equal(a.read().teams.length,99);assert.match(a.dialogs.at(-1),/99/);
});
if(process.env.BASELINE_ROOT)test('baseline evidence: old handler permits QB FLEX and silently benches receiver',async()=>{
  const input=fixture([player('Fixture QB','QB','QB'),player('Fixture WR','WR','FLEX')]);
  const a=await app(input,{root:process.env.BASELINE_ROOT});a.move(0,'FLEX');
  const output=a.read();assert.deepEqual(output.teams[0].roster.map(p=>p.slot),['FLEX','Bench']);
  const repaired=await app(input);repaired.move(0,'FLEX');assert.deepEqual(repaired.read(),input);
  if(process.env.FIXTURE_REPORT)fs.writeFileSync(process.env.FIXTURE_REPORT,JSON.stringify({kind:'synthetic fixture; actual old/new inline handlers',input,oldOutput:output,newOutput:repaired.read(),newMessage:repaired.message(),expectedRejectedAction:'QB to FLEX'},null,2));
});

test('failed backup write preserves persisted and in-memory roster before any later save',async()=>{
  const original=fixture([player('Original player','WR')]),replacement=fixture([player('Replacement player','RB')]);
  replacement.teams[0].name='Replacement Team';
  const a=await app(original),before=a.storage.get(KEY);
  a.failWrite=true;await a.import(replacement);
  assert.match(a.message(),/Could not import backup: Synthetic storage write failure/);
  assert.equal(a.storage.get(KEY),before);
  assert.equal(a.el('heading').textContent,'Fixture Team — Roster');
  a.el('export').onclick();
  assert.deepEqual(JSON.parse(await a.downloads.at(-1).text()),original,'failed import must not replace the in-memory export');
  a.failWrite=false;a.add('Later local player','QB','Bench');
  assert.deepEqual(a.read().teams[0].roster.map(p=>p.name),['Original player','Later local player']);
  assert.equal(a.read().teams[0].name,'Fixture Team');
});
test('backup write may be retried after failure without requiring reload or losing metadata',async()=>{
  const original=fixture([player('Original player','WR')]),replacement=fixture([player('Replacement player','RB','IR')]);
  replacement.teams[0].scoring={ppr:0.5};replacement.teams[0].screenshots=['synthetic-only.png'];
  const a=await app(original);a.failWrite=true;await a.import(replacement);
  assert.deepEqual(a.read(),original);
  a.failWrite=false;await a.import(replacement);
  assert.deepEqual(a.read(),replacement);
  assert.match(a.message(),/Backup restored/);
  assert.match(a.el('lineupIssues').textContent,/unverified/);
  a.el('export').onclick();assert.deepEqual(JSON.parse(await a.downloads.at(-1).text()),replacement);
});
