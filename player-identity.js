/* Shared player identity helpers. Current-season data is intentionally not asserted. */
(function(root){
'use strict';
const VALID_POS=new Set(['QB','RB','FB','WR','TE','K','P','LS','C','G','OG','T','OT','OL','DE','DT','DL','NT','EDGE','LB','ILB','OLB','MLB','CB','DB','S','FS','SS','D/ST']);
const normalizeName=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/gi,' ').replace(/\s+/g,' ').trim().toLowerCase();
const validPlayer=p=>p&&typeof p.id==='string'&&/^espn:[0-9]+$/.test(p.id)&&typeof p.name==='string'&&p.name.trim()&&VALID_POS.has(p.pos)&&typeof p.team==='string'&&p.team.trim()&&typeof p.season==='number'&&Number.isInteger(p.season)&&typeof p.source==='string'&&p.source.trim()&&typeof p.checkedAt==='string'&&!Number.isNaN(Date.parse(p.checkedAt));
function index(records){const byName=new Map(),issues=[];for(const [i,p] of records.entries()){if(!validPlayer(p)){issues.push('Invalid record '+i);continue}const key=normalizeName(p.name);const group=byName.get(key)||[];group.push(p);byName.set(key,group)}return {byName,issues}}
function resolve(records,name,season){const {byName}=index(records);const options=(byName.get(normalizeName(name))||[]).filter(p=>p.season===season);return options.length===1?{status:'verified',player:options[0]}:options.length>1?{status:'ambiguous',options}:{status:'unverified',options:[]}}
root.FantasyPlayerIdentity={normalizeName,validPlayer,index,resolve};
})(typeof window!=='undefined'?window:globalThis);
