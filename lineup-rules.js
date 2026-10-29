/* Local planning rules, not an ESPN league contract or live eligibility claim. */
(function(root){
'use strict';
const POSITIONS=Object.freeze(['QB','RB','WR','TE','K','D/ST']);
const TEMPLATE=Object.freeze({
  Bench:POSITIONS,QB:Object.freeze(['QB']),RB1:Object.freeze(['RB']),RB2:Object.freeze(['RB']),
  WR1:Object.freeze(['WR']),WR2:Object.freeze(['WR']),TE:Object.freeze(['TE']),
  FLEX:Object.freeze(['RB','WR','TE']),K:Object.freeze(['K']),'D/ST':Object.freeze(['D/ST']),IR:POSITIONS
});
const SLOTS=Object.freeze(Object.keys(TEMPLATE));
const fail=(code,message)=>({ok:false,code,message});
const ok=()=>({ok:true});
const nameKey=p=>String(p?.name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const stableId=p=>typeof p?.id==='string'?p.id.trim():'';
function duplicate(player,roster,exclude=-1){
  const id=stableId(player),name=nameKey(player);
  for(const [i,other] of roster.entries()){
    if(i===exclude)continue;
    const otherId=stableId(other);
    if(id&&id===otherId)return fail('duplicate-id','Player ID already on this roster: '+other.name+'. Nothing changed.');
    if(name&&name===nameKey(other)){
      // Distinct IDs from the same source are not silently collapsed into one player.
      if(id&&otherId&&id!==otherId&&id.split(':')[0]===otherId.split(':')[0])continue;
      return fail('ambiguous-name','Duplicate or ambiguous player name: '+player.name+'. Review player identities; nothing changed.');
    }
  }
  return ok();
}
function assignment(player,slot,roster=[],exclude=-1,{allowUnverifiedIR=false}={}){
  if(!player||typeof player.name!=='string'||!player.name.trim()||!nameKey(player))return fail('name','Enter a player name.');
  if(!POSITIONS.includes(player.pos))return fail('position','Player position is missing or unsupported.');
  if(!SLOTS.includes(slot))return fail('slot','Slot is not in this local planning template.');
  if(slot==='IR'&&!allowUnverifiedIR)return fail('ir-unverified','IR assignment unavailable: league IR rules and player eligibility are not connected. Keep the player on Bench for local planning.');
  if(!TEMPLATE[slot].includes(player.pos))return fail('position-slot',player.pos+' cannot use '+slot+' in this local template. '+slot+' accepts '+TEMPLATE[slot].join('/')+'.');
  if(slot!=='Bench'&&slot!=='IR'){
    const occupied=roster.find((p,i)=>i!==exclude&&p.slot===slot);
    if(occupied)return fail('occupied',slot+' is occupied by '+occupied.name+'. Move that player to Bench first; nothing changed.');
  }
  return ok();
}
function add(roster,player){
  if(roster.length>=99)return fail('capacity','Local roster limit is 99 players. Nothing changed.');
  const identity=duplicate(player,roster);if(!identity.ok)return identity;
  const result=assignment(player,player.slot,roster);if(!result.ok)return result;
  return {ok:true,roster:[...roster,{...player}]};
}
function move(roster,index,slot){
  if(!Number.isInteger(index)||!roster[index])return fail('player','Player no longer exists in this roster.');
  // Preserve an existing unverified IR entry when no assignment changes.
  if(roster[index].slot===slot)return {ok:true,roster:roster.slice()};
  const result=assignment(roster[index],slot,roster,index);if(!result.ok)return result;
  return {ok:true,roster:roster.map((p,i)=>i===index?{...p,slot}:p)};
}
function inspect(roster){
  const issues=[];
  for(const [i,p] of roster.entries()){
    const identity=duplicate(p,roster,i);if(!identity.ok)issues.push(identity.message);
    const result=assignment(p,p.slot,roster,i,{allowUnverifiedIR:true});if(!result.ok)issues.push(p.name+': '+result.message);
    if(p.slot==='IR')issues.push(p.name+': restored IR placement is unverified; no league IR rules or player eligibility are connected.');
  }
  return [...new Set(issues)];
}
function backup(data){
  if(!data||!Array.isArray(data.teams)||data.teams.length>99)return fail('backup','Backup must contain at most 99 teams.');
  const ids=new Set();
  for(const t of data.teams){
    if(!t||typeof t.id!=='string'||!t.id.trim()||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||!Array.isArray(t.roster)||t.roster.length>99)return fail('backup','Invalid team details, duplicate team ID, or roster over 99 players.');
    ids.add(t.id);
    for(const [i,p] of t.roster.entries()){
      const identity=duplicate(p,t.roster,i);if(!identity.ok)return identity;
      // Recovery preserves IR entries without claiming their eligibility. It does not create a new IR assignment.
      const result=assignment(p,p?.slot,t.roster,i,{allowUnverifiedIR:true});if(!result.ok)return fail('backup',t.name+': '+result.message);
    }
  }
  return ok();
}
root.FantasyLineupRules={POSITIONS,SLOTS,TEMPLATE,duplicate,assignment,add,move,inspect,backup};
if(typeof module!=='undefined'&&module.exports)module.exports=root.FantasyLineupRules;
})(typeof window!=='undefined'?window:globalThis);
