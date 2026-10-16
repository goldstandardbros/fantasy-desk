/* Shared deterministic snake-draft core — usable by Draft Lab and Time Machine. */
(function(root){
'use strict';
function pickTeam(overall,teams){if(!Number.isInteger(overall)||!Number.isInteger(teams)||overall<0||teams<2)throw Error('invalid pick');let r=Math.floor(overall/teams),p=overall%teams;return r%2?teams-1-p:p}
function score(p,format){return Number(p.avg||0)*(format==='half'?.86:format==='standard'?.72:1)}
function cpuChoice(available,roster,format){if(!available.length)throw Error('empty pool');
const count=pos=>roster.filter(p=>p.pos===pos).length;
const need={QB:1,RB:2,WR:2,TE:1};
return available.map(p=>({p,v:score(p,format)+(count(p.pos)<(need[p.pos]||0)?9:0)-(p.pos==='QB'&&count('QB')>=1?18:0)-(count(p.pos)>=4?10:0)})).sort((a,b)=>b.v-a.v||String(a.p.id).localeCompare(String(b.p.id)))[0].p}
function validateDraft(draft,players){if(!draft||!Number.isInteger(draft.teams)||draft.teams<2||!Number.isInteger(draft.rounds)||draft.rounds<1||!Array.isArray(draft.picks)||draft.picks.length>draft.teams*draft.rounds)return false;
const ids=new Set(players.map(p=>p.id)),taken=new Set();
return draft.picks.every((p,i)=>{if(!ids.has(p.id)||taken.has(p.id)||p.team!==pickTeam(i,draft.teams))return false;taken.add(p.id);return true})}
if(typeof module!=='undefined'&&module.exports){module.exports={pickTeam,score,cpuChoice,validateDraft}}else{root.DraftEngine={pickTeam,score,cpuChoice,validateDraft}}
})(typeof module!=='undefined'?module.exports:window);