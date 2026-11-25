// Prototype CPU: pressure the strongest relevant opponent, replenish own resources.
// Only public opponent statistics and the CPU's own cards are consulted.
export function chooseCpuTarget(id,opts,effect){
 const live=opts.filter(o=>o.v&&!o.v.dead),other=live.filter(o=>o.v.id!==id),self=live.find(o=>o.v.id===id);
 const candidates=other.length?other:live;
 if(effect===3&&self&&(!other.length||other.every(o=>o.v.hp<=self.v.hp)))return self;
 const compare=effect===7?(a,b)=>b.v.hand.length-a.v.hand.length||b.v.hp-a.v.hp||b.v.score-a.v.score:effect===11?(a,b)=>a.v.hp-b.v.hp||a.v.score-b.v.score:(a,b)=>b.v.hp-a.v.hp||b.v.score-a.v.score||b.v.hand.length-a.v.hand.length;
 return [...candidates].sort(compare)[0]??opts[0];
}
export function chooseCpuCard(game,p){
 const live=game.alive(),other=live.filter(q=>q!==p),needsHeal=live.every(q=>p.hp<=q.hp),needsDraw=p.hand.length<=3||other.length>0&&other.every(q=>p.hand.length<q.hand.length),exchangeGain=Math.max(0,...other.map(q=>q.hp-p.hp));
 const rank=c=>{
  if(c.kind==='event')return [0,0,c.event===0?2:1];
  if(!c.t.includes(0)||game.used.has(c.id+':0'))return [0,0,0];
  let heal=0,draw=0,score=0;
  for(const {id,n} of c.e){
   if(id===2)heal+=n;else if(id===3)heal+=exchangeGain;
   if(id===4||id===5)draw+=n;
   score+=n*([0,1].includes(id)?4:[2,7,13].includes(id)?3:[4,5,8].includes(id)?2:id===3?Math.min(4,exchangeGain):1);
  }
  return [needsHeal?heal:0,needsDraw?draw:0,score];
 };
 const candidates=p.hand.filter(c=>game.playable(c)).map(c=>({c,r:rank(c)})).filter(o=>o.r.some(n=>n>0));
 candidates.sort((a,b)=>b.r[0]-a.r[0]||b.r[1]-a.r[1]||b.r[2]-a.r[2]);
 return candidates[0]?.c;
}
