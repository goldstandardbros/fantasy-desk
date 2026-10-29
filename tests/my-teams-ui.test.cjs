'use strict';
/* Isolated synthetic fixtures only. Never connects to or edits an owner's league. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),KEY='fantasy-desk-my-teams-v1';
let browser,server,origin,context,page,confirmResponse,dialogs,errors;
const makePlayer=(name,pos,slot='Bench',extra={})=>({name,pos,nfl:'',slot,...extra});
const fixture=roster=>({teams:[{id:'fixture',name:'Fixture Team',league:'Local test only',roster}],selected:'fixture'});
const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
async function open(data=fixture([]),viewport={width:1280,height:900}){
  context=await browser.newContext({viewport});
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await context.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data))},{key:KEY,data});
  page=await context.newPage();confirmResponse=true;dialogs=[];errors=[];
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await(confirmResponse?dialog.accept():dialog.dismiss())});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/my-teams.html');
  await page.waitForFunction(()=>!document.getElementById('catalogStatus').textContent.includes('checking'));
}
async function add(name,pos,slot){
  await page.locator('#player').fill(name);await page.locator('#position').selectOption(pos);
  await page.locator('#slot').selectOption(slot);await page.locator('#add').click();
}
async function importBackup(data){
  await page.locator('#importFile').setInputFiles({name:'fixture-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>document.getElementById('message').textContent.match(/Backup restored|Could not import backup/));
}
test.before(async()=>{
  server=http.createServer(async(req,res)=>{
    try{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
      const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');res.end(data);
    }catch{res.writeHead(404);res.end('Not found')}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
});
test.afterEach(async()=>{if(context){assert.deepEqual(errors,[]);await context.close();context=null}});
test.after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve))});
test('real page prevents QB→FLEX and occupied-slot replacement without losing the receiver',async()=>{
  await open();assert.match(await page.locator('#rulesStatus').innerText(),/game locks.*not verified/);
  await add('Fixture Quarterback','QB','QB');await add('Fixture Receiver','WR','FLEX');
  const before=await read();
  const select=page.getByLabel('Lineup slot for Fixture Quarterback');
  assert.equal(await select.locator('option[value="FLEX"]').isDisabled(),true);
  assert.equal(await select.locator('option[value="IR"]').isDisabled(),true);
  await select.evaluate(el=>{el.value='FLEX';el.dispatchEvent(new Event('change',{bubbles:true}))});
  assert.match(await page.locator('#message').innerText(),/QB cannot use FLEX/);assert.deepEqual(await read(),before);
  await add('Fixture Runner','RB','Bench');const withRunner=await read();
  await page.getByLabel('Lineup slot for Fixture Runner').evaluate(el=>{el.value='FLEX';el.dispatchEvent(new Event('change',{bubbles:true}))});
  assert.match(await page.locator('#message').innerText(),/occupied by Fixture Receiver/);assert.deepEqual(await read(),withRunner);
  await page.getByLabel('Lineup slot for Fixture Receiver').selectOption('Bench');
  await page.getByLabel('Lineup slot for Fixture Runner').selectOption('FLEX');
  assert.deepEqual((await read()).teams[0].roster.map(p=>[p.name,p.slot]),[['Fixture Quarterback','QB'],['Fixture Receiver','Bench'],['Fixture Runner','FLEX']]);
});
test('bulk import is atomic for mismatches, occupied slots, and repeated import',async()=>{
  await open();const before=await read();
  await page.locator('#bulk').fill('Fixture Good,WR,,WR1\nFixture Invalid,QB,,FLEX');await page.locator('#bulkAdd').click();
  assert.match(await page.locator('#message').innerText(),/Import not applied/);assert.deepEqual(await read(),before);assert.equal(dialogs.length,0);
  await page.locator('#bulk').fill('Fixture One,WR,,WR1\nFixture Two,WR,,WR1');await page.locator('#bulkAdd').click();
  assert.deepEqual(await read(),before);assert.match(await page.locator('#message').innerText(),/occupied/);
  await page.locator('#bulk').fill('Fixture One,WR,,Bench\nFixture Two,RB,,Bench');await page.locator('#bulkAdd').click();
  assert.equal((await read()).teams[0].roster.length,2);const imported=await read();
  await page.locator('#bulkAdd').click();assert.deepEqual(await read(),imported);assert.match(await page.locator('#message').innerText(),/ambiguous/);
});
test('manual normalized-name duplicates and IR reject even if disabled option is forced',async()=>{
  await open();await add('Fíxture O’Neil','RB','Bench');const before=await read();
  await add('Fixture ONeil','RB','Bench');assert.deepEqual(await read(),before);assert.match(await page.locator('#message').innerText(),/ambiguous/);
  await page.locator('#player').fill('Fixture Injured');
  await page.locator('#slot').evaluate(el=>{el.value='IR'});await page.locator('#add').click();
  assert.deepEqual(await read(),before);assert.match(await page.locator('#message').innerText(),/IR assignment unavailable/);
});
test('duplicate backup is rejected before confirmation or overwriting local storage',async()=>{
  await open(fixture([makePlayer('Fixture Existing','QB','QB')]));const before=await read();
  await importBackup(fixture([makePlayer('Fixture A','WR','Bench',{id:'espn:fixture'}),makePlayer('Fixture B','WR','Bench',{id:'espn:fixture'})]));
  assert.match(await page.locator('#message').innerText(),/Player ID already/);assert.deepEqual(await read(),before);assert.equal(dialogs.length,0);
});
test('backup recovery/export/reload preserves league metadata and legacy IR with a visible caveat',async()=>{
  await open();const data=fixture([makePlayer('Fixture IR','RB','IR',{id:'espn:fixture-ir',injuryStatus:'IR'})]);
  data.recoveryNote='Synthetic recovery fixture';data.teams[0].scoring={ppr:0.5};data.teams[0].screenshots=['fixture-only.png'];
  await importBackup(data);assert.deepEqual(await read(),data);
  assert.match(await page.locator('#lineupIssues').innerText(),/restored IR placement is unverified/);
  const downloading=page.waitForEvent('download');await page.locator('#export').click();const download=await downloading;
  assert.deepEqual(JSON.parse(await fs.readFile(await download.path(),'utf8')),data);
  await page.reload();assert.deepEqual(await read(),data);assert.match(await page.locator('#lineupIssues').innerText(),/unverified/);
  await page.getByLabel('Lineup slot for Fixture IR').selectOption('Bench');assert.equal((await read()).teams[0].roster[0].slot,'Bench');
});
test('cancelled backup and cancelled new-team form do not alter saved data',async()=>{
  await open();const before=await read();confirmResponse=false;
  await page.locator('#importFile').setInputFiles({name:'fixture-cancel.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture([makePlayer('Fixture Cancel','WR')])))});
  await page.waitForFunction(()=>document.getElementById('importFile').value==='');assert.deepEqual(await read(),before);
  await page.locator('#new').click();await page.locator('#teamName').fill('Do not save');await page.locator('#cancelTeam').click();
  assert.equal(await page.locator('#teamForm').isHidden(),true);assert.deepEqual(await read(),before);
});
test('legacy mismatch remains readable, repairable, and mobile page retains independent games',async()=>{
  await open(fixture([makePlayer('Fixture Legacy QB','QB','FLEX')]),{width:390,height:844});const before=await read();
  assert.match(await page.locator('#lineupIssues').innerText(),/QB cannot use FLEX/);assert.deepEqual(await read(),before);
  await page.getByLabel('Lineup slot for Fixture Legacy QB').selectOption('Bench');assert.equal((await read()).teams[0].roster[0].slot,'Bench');
  assert.equal(await page.getByRole('link',{name:'Time Machine',exact:true}).getAttribute('href'),'time-machine.html');
  assert.equal(await page.getByRole('link',{name:'Draft Lab',exact:true}).getAttribute('href'),'draft-lab.html');
  if(process.env.QA_SCREENSHOT_DIR){await fs.mkdir(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'my-teams-mobile.png'),fullPage:true})}
});
