'use strict';
/* Real consumer scripts, minimal DOM adapter, synthetic fetch response; not browser QA. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const mixed=JSON.parse(execFileSync('python',[path.join(__dirname,'catalog_fixture.py')],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'}));
class Element{
  constructor(value=''){this.value=value;this.children=[];this.options=[];this.textContent='';this.files=[];this.listeners={}}
  add(option){this.options.push(option)}append(child){this.children.push(child)}replaceChildren(...children){this.children=[];this.options=[];for(const child of children)this.add(child)}
  setAttribute(name,value){this[name]=value}addEventListener(name,handler){this.listeners[name]=handler}focus(){}click(){return this.onclick?.()}get selectedOptions(){return this.options.filter(o=>o.value===this.value)}
}
class Option extends Element{constructor(text,value){super(value);this.textContent=text}}
async function page(name,catalog,{realStatic=false}={}){
  const html=fs.readFileSync(path.join(ROOT,name),'utf8'),elements=new Map();
  for(const id of html.matchAll(/id="([^"]+)"/g))elements.set(id[1],new Element());
  if(name==='my-teams.html'){
    for(const value of ['QB','RB','WR','TE','K','D/ST'])elements.get('position').add(new Option(value,value));elements.get('position').value='QB';
    for(const value of ['Bench','QB','RB1','RB2','WR1','WR2','TE','FLEX','K','D/ST','IR'])elements.get('slot').add(new Option(value,value));elements.get('slot').value='Bench';
  }
  const storage=new Map([['fantasy-desk-my-teams-v1',JSON.stringify({teams:[{id:'fixture',name:'Synthetic Fixture',roster:[]}],selected:'fixture'})]]);
  const sandbox={document:{getElementById:id=>elements.get(id),createElement:()=>new Element()},Option,console,Blob,URL,setTimeout:()=>{},confirm:()=>true,alert:()=>{},prompt:()=>null,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async url=>({ok:true,json:async()=>realStatic?JSON.parse(fs.readFileSync(path.join(ROOT,url),'utf8')):structuredClone(catalog)})};sandbox.window=sandbox;vm.createContext(sandbox);
  for(const src of html.matchAll(/<script src="([^"]+)"><\/script>/g))vm.runInContext(fs.readFileSync(path.join(ROOT,src[1]),'utf8'),sandbox);
  vm.runInContext(html.split('<script>')[1].split('</script>')[0],sandbox);await new Promise(resolve=>setImmediate(resolve));
  return {el:id=>elements.get(id),storage};
}
test('both actual pages use only supported-position projection and disclose full-source count',async()=>{
  const teams=await page('my-teams.html',mixed);
  assert.match(teams.el('catalogStatus').textContent,/640 supported-position athletes from 1280 source athletes/);
  assert.equal(teams.el('playerSuggestions').children.length,640);
  const research=await page('player-research.html',mixed);
  assert.match(research.el('catalogStatus').textContent,/640 supported-position athletes from 1280 source athletes/);
  assert.match(research.el('count').textContent,/640 players found.*2026 data/);
  assert.equal(research.el('results').children.length,100);
  for(const row of research.el('results').children){assert.equal(['QB','RB','WR','TE','K'].includes(row.children[1].textContent),true);assert.equal(row.children[3].textContent,'—');assert.equal(row.children[4].textContent,'—')}
  assert.match(research.el('researchScope').textContent,/not league-specific eligible players/);assert.match(research.el('researchLimitations').textContent,/Other athlete positions remain/);
});
test('My Teams autofill persists exact source athlete ID, not historical identity',async()=>{
  const a=await page('my-teams.html',mixed),source=mixed.players.find(p=>p.pos==='QB');
  a.el('player').value=source.name;a.el('player').listeners.input();a.el('slot').value='QB';a.el('add').onclick();
  const saved=JSON.parse(a.storage.get('fantasy-desk-my-teams-v1')).teams[0].roster[0];assert.equal(saved.id,source.id);assert.equal(saved.pos,'QB');assert.equal(saved.nfl,source.team);
});
test('ambiguous current names are not arbitrarily attached to the first source ID',async()=>{
  const data=structuredClone(mixed),fantasy=data.players.filter(p=>p.pos==='QB');fantasy[1].name=fantasy[0].name;
  const a=await page('my-teams.html',data);
  assert.match(a.el('catalogStatus').textContent,/1 ambiguous names omitted/);assert.equal(a.el('playerSuggestions').children.some(p=>p.value===fantasy[0].name),false);
  a.el('player').value=fantasy[0].name;a.el('position').value='QB';a.el('slot').value='Bench';a.el('add').onclick();
  assert.equal(JSON.parse(a.storage.get('fantasy-desk-my-teams-v1')).teams[0].roster[0].id,undefined);
});
test('empty actual static catalog and tampered identity stay on historical fallback without false 2026 rows',async()=>{
  const empty=JSON.parse(fs.readFileSync(path.join(ROOT,'data/players-2026.json'),'utf8'));
  const tampered=structuredClone(mixed);tampered.players[0].season=2025;
  for(const source of [empty,tampered]){
    const a=await page('my-teams.html',source);assert.match(a.el('catalogStatus').textContent,/source directory unavailable/);assert.equal(a.el('playerSuggestions').children.some(p=>p.value.startsWith('Synthetic Fixture')),false);
    const b=await page('player-research.html',source);assert.match(b.el('catalogStatus').textContent,/source directory unavailable/);assert.match(b.el('count').textContent,/2025 data/);
  }
});

const actualObserved=JSON.parse(fs.readFileSync(path.join(ROOT,'data/players-2026-observed.json'),'utf8'));
test('actual retained-source files populate both real page scripts as dated observed discovery, not a complete roster',async()=>{
  const a=await page('my-teams.html',null,{realStatic:true});
  assert.match(a.el('catalogStatus').textContent,/627 supported-position identities from 1988 exact matches; 32 teams observed; 7 unresolved IDs excluded/);
  assert.match(a.el('catalogStatus').textContent,/Not a complete roster, current activity/);assert.equal(a.el('catalogAttribution').hidden,false);
  assert.equal(a.el('playerSuggestions').children.length,627);
  const source=actualObserved.players.find(p=>p.pos==='QB');a.el('player').value=source.name;a.el('player').listeners.input();a.el('slot').value='QB';a.el('add').onclick();
  const saved=JSON.parse(a.storage.get('fantasy-desk-my-teams-v1')).teams[0].roster[0];assert.deepEqual(saved,{name:source.name,pos:'QB',nfl:source.team,slot:'QB',id:source.id,directoryEvidence:{catalogPlayerId:source.id,sourceUrl:source.source,recordCheckedAt:source.checkedAt,observedAt:source.observedAt,identitySourceUrl:source.identitySource,identityCheckedAt:source.identityCheckedAt}});
  const b=await page('player-research.html',null,{realStatic:true});assert.match(b.el('count').textContent,/627 players found.*2026 data/);assert.equal(b.el('catalogAttribution').hidden,false);
  for(const row of b.el('results').children){assert.equal(['QB','RB','WR','TE','K'].includes(row.children[1].textContent),true);assert.equal(row.children[3].textContent,'—');assert.equal(row.children[4].textContent,'—')}
  if(process.env.ACTUAL_UI_REPORT)fs.writeFileSync(process.env.ACTUAL_UI_REPORT,JSON.stringify({source:'retained real nflverse captures; not live activity or full roster',myTeamsStatus:a.el('catalogStatus').textContent,researchStatus:b.el('catalogStatus').textContent,actualInput:{name:source.name,position:'QB',slot:'QB'},savedLocalPlan:saved,suggestionCount:a.el('playerSuggestions').children.length,points:'not supplied',leagueEligibilityVerified:false},null,2));
});
