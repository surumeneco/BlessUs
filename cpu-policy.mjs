// Independent, per-game CPU dispositions. Never inspect opponents' hidden card contents.
export const ACTION_POLICIES=['attack','heal','edit','random'];
export const TARGET_POLICIES=['strong','weak','random'];
const pick=(items,rnd)=>items[Math.floor(rnd()*items.length)];
export function cpuRandom(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function createCpuPolicy(seed,id){let mixed=(seed^Math.imul(id+1,0x9e3779b9))>>>0;mixed=Math.imul(mixed^(mixed>>>16),0x85ebca6b);mixed=Math.imul(mixed^(mixed>>>13),0xc2b2ae35);const rnd=cpuRandom((mixed^(mixed>>>16))>>>0);return {action:pick(ACTION_POLICIES,rnd),target:pick(TARGET_POLICIES,rnd),rnd}}
const fallback={action:'attack',target:'strong',rnd:Math.random};
export function chooseCpuTarget(id,opts,effect,policy=fallback){
 const live=opts.filter(o=>o.v&&!o.v.dead),other=live.filter(o=>o.v.id!==id),self=live.find(o=>o.v.id===id),candidates=other.length?other:live;
 if(!candidates.length)return undefined;
 if(policy.target==='random')return pick(candidates,policy.rnd);
 const sign=policy.target==='weak'?-1:1;
 if(effect===15&&self&&policy.action==='heal')return self;
 const compare=[7,16,18].includes(effect)?(a,b)=>b.v.hand.length-a.v.hand.length||b.v.hp-a.v.hp||b.v.score-a.v.score:(a,b)=>b.v.hp-a.v.hp||b.v.score-a.v.score||b.v.hand.length-a.v.hand.length;
 const sorted=[...candidates].sort((a,b)=>sign*compare(a,b));
 // Avoid deliberately losing HP on a non-random exchange; the target axis still decides among opponents.
 if(effect===3&&self&&sorted[0].v.hp<=self.v.hp)return self;
 const tied=sorted.filter(o=>compare(o,sorted[0])===0);return pick(tied,policy.rnd);
}
const complexity=c=>c.kind==='action'?c.t.length+c.e.reduce((n,e)=>n+e.n,0):1;
const EFFECT_WEIGHTS={attack:[8,10,2,2,3,1,-2,5,4,2,5,-3,1,5,-5,2,6,4,3,5,2,8],heal:[4,5,10,8,4,1,-2,2,4,3,4,-3,1,4,-8,9,5,2,3,5,2,4],edit:[5,6,3,2,5,2,-2,3,5,4,4,-2,1,4,-4,3,7,2,5,8,2,4]};
const effectWeight=(id,action)=>EFFECT_WEIGHTS[action]?.[id]??1;
const rank=(items,score,rnd)=>{if(!items.length)return undefined;const scores=items.map(item=>({item,score:score(item)})),best=Math.max(...scores.map(x=>x.score));return pick(scores.filter(x=>x.score===best),rnd).item};
export function chooseCpuCard(game,p,policy=fallback){
 const candidates=p.hand.filter(c=>game.playable(c));if(!candidates.length)return undefined;
 if(policy.action==='random')return pick(candidates,policy.rnd);
 const live=game.alive(),other=live.filter(q=>q!==p),needsDraw=p.hand.length<=3||other.length>0&&other.every(q=>p.hand.length<q.hand.length),needsHeal=p.hp<(game.cfg?.hp??10)||p.hp<(game.cfg?.hp??10)+3&&live.every(q=>p.hp<=q.hp),exchange=chooseCpuTarget(p.id,live.map(v=>({v})),3,policy)?.v,exchangeGain=Math.max(0,(exchange?.hp??p.hp)-p.hp);
 const score=c=>{if(c.kind==='event'){const possible=p.hand.some(x=>x!==c&&(c.event<2||x.kind==='action'));return possible?(policy.action==='edit'?[16,12,19,22][c.event]:[2,1,3,4][c.event]):-Infinity}if(!c.t.includes(0)||game.used.has(c.id+':0'))return -Infinity;let value=0;for(const {id,n} of c.e){let w=effectWeight(id,policy.action);if(id===2&&policy.action==='heal'&&!needsHeal)w=2;if(id===3)w=exchangeGain?Math.min(12,exchangeGain*(policy.action==='heal'?3:1)):0;if((id===4||id===5)&&needsDraw)w+=3;if(id===8)w+=2;value+=n*w}return value};
 const scores=new Map(candidates.map(c=>[c,score(c)])),active=candidates.filter(c=>Number.isFinite(scores.get(c)));const preferred=active.filter(c=>policy.action==='edit'?c.kind==='event':c.kind==='action'&&c.e.some(e=>policy.action==='attack'?[0,1,21].includes(e.id):needsHeal&&([2,15].includes(e.id)||e.id===3&&exchangeGain>0)));return rank(preferred.length?preferred:active,c=>scores.get(c),policy.rnd);
}
export function chooseCpuOption(game,id,prompt,opts,ctx={},policy=fallback){
 const usable=opts.filter(o=>o.v!=='back');if(!usable.length)return opts[0];
 const confirm=usable.find(o=>o.v==='confirm');if(confirm)return confirm; // don't loop on confirmation
 if(ctx.kind==='player')return chooseCpuTarget(id,usable,ctx.effect,policy)??usable[0];
 if(policy.action==='random')return pick(usable,policy.rnd);
 const action=policy.action,rnd=policy.rnd;
 if(prompt==='アビリティを獲得'){const priorities={attack:[7,6,4,1,0,3,2,5],heal:[0,6,7,1,4,3,2,5],edit:[3,2,5,1,6,7,4,0]}[action];return rank(usable,o=>-priorities.indexOf(o.v),rnd)}
 if(prompt==='ラウンド終了：デッキ改変'){const priorities=action==='edit'?[2,1,3,0]:action==='attack'?[1,2,0,3]:[1,0,2,3];return rank(usable,o=>-priorities.indexOf(o.v),rnd)}
 if(prompt==='追加するイベントカード')return rank(usable,o=>action==='edit'?[2,1,3,4][o.v]:[4,1,2,3][o.v],rnd);
 if(ctx.kind==='moduleKind')return usable.find(o=>o.v==='e')??usable[0];
 if(ctx.kind==='newModule'){return rank(usable,o=>ctx.module==='e'?effectWeight(o.v,action):o.v===0?10:[2,3,6,7,10,11].includes(o.v)?5:2,rnd)}
 if(ctx.kind==='oldModule'){return rank(usable,o=>ctx.module==='e'?-effectWeight(ctx.card?.e[o.v]?.id,action):ctx.card?.t[o.v]===0?-10:0,rnd)}
 if(ctx.kind==='card'||usable.some(o=>o.v?.kind)){
  const optional=usable.find(o=>o.v===null),cards=usable.filter(o=>o.v?.kind);if(prompt==='捨てる手札（任意）'){const discard=cards.filter(o=>o.v.kind==='action'&&o.v.t.includes(1));return rank(discard,o=>complexity(o.v),rnd)??optional??cards[0]}
  const low=prompt==='削除する手札'||prompt==='渡す手札'||prompt==='捨てる手札';return rank(cards,o=>(low?-1:1)*complexity(o.v),rnd)??optional??usable[0];
 }
 return pick(usable,rnd);
}
