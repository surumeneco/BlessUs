import {Game} from './engine.mjs';
async function verify(Game){
 const eq=(actual,expected,label)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(label+': '+JSON.stringify(actual)+' != '+JSON.stringify(expected));return label};const results=[];
 const choose=async(p,q,opts)=>q.startsWith('任意のプレイヤー')?(opts.find(x=>x.v.id!==p)??opts[0]):opts[0];
 const blank=()=>{const g=new Game({players:3,seed:7},choose);g.deck=[];g.grave=[];return g};
 let g=blank();let [a,b,c]=g.p;const ar=g.action(5,2),br=g.action(4,2),cr=g.action(5,2),cr2=g.action(5,2);a.hand=[g.action(0,0),ar];b.hand=[g.action(0,0),g.action(0,0),br];c.hand=[cr,g.action(0,0),cr2];let q=g.group(1);g.emit(q,'heal',b);g.enqueue(q);results.push(eq(g.queue[0].map(x=>x.c.id),[br.id,cr.id,ar.id,cr2.id],'§9.1 relative rank and source owner'));
 // A queued card may move to another hand; the original queue order and current owner matter.
 g=blank();[a,b,c]=g.p;const card=g.action(5,2);a.hand=[card];q=g.group(1);g.emit(q,'heal',b);g.enqueue(q);a.hand=[];c.hand=[card];await g.drain();results.push(eq([a.hp,c.hp,g.grave.includes(card)],[10,11,true],'§9.1/9.3 current owner on resolution'));
 g=blank();[a,b,c]=g.p;const missing=g.action(5,2);a.hand=[missing];q=g.group(1);g.emit(q,'heal',b);g.enqueue(q);a.hand=[];g.grave=[missing];await g.drain();results.push(eq([a.hp,g.history.length],[10,0],'§9.1 absent card cancels'));
 g=blank();[a,b,c]=g.p;const child=g.action(4,2),sibling=g.action(5,2),grandchild=g.action(5,2);a.hand=[child];b.hand=[sibling];c.hand=[grandchild];q=g.group(0);g.emit(q,'heal',a);g.enqueue(q);await g.drain();results.push(eq(g.history.map(x=>x.id),[child.id,sibling.id,grandchild.id],'§9.1 original group before new source'));
 g=blank();[a,b,c]=g.p;a.dead=true;a.hp=0;const held=g.action(5,1);a.hand=[held];q=g.group(1);g.hpChange(a,1,b,q);g.hpChange(a,-1,b,q);results.push(eq([a.hp,q.entries.length,a.hand.length],[0,0,1],'§5 no HP change or trigger after elimination'));g.emit(q,'heal',b);g.enqueue(q);await g.drain();results.push(eq([b.hp,c.hp],[9,9],'§5 eliminated hand still reacts'));
 g=blank();[a,b,c]=g.p;const e=g.event(0),prev=g.action(0,10),heal=g.action(0,2);a.hand=[heal,e,prev];await g.fire(heal);await g.fire(e);const hp=a.hp;await g.fire(prev);results.push(eq([a.hp,g.history[1].e.length],[hp,0],'§8/9.3 event is history card without effects'));
 g=blank();[a,b,c]=g.p;g.deck=[g.action(0,0)];g.turn=1;q=g.group(0);await g.effect(a,5,q,{target:null,stay:false},-1);results.push(eq(g.p.map(x=>x.hand.length),[0,1,0],'§6/9.3 shared draw shortage in turn order'));
 g=blank();[a,b,c]=g.p;let sw=g.group(0);a.dead=true;a.hp=0;await g.effect(a,3,sw,{target:b},-1);results.push(eq([a.hp,b.hp,sw.entries.length],[0,10,0],'§5 dead participant exchange fails'));
 g=blank();[a,b,c]=g.p;const use=g.action(0,9);a.hand=[use];q=g.group(0);g.emit(q,'use',a,null,use);g.enqueue(q);await g.drain();q=g.group(0);g.emit(q,'use',a,null,use);g.enqueue(q);results.push(eq([g.queue.length,g.history.length,a.hand.length],[0,1,1],'§9.1 same trigger only once per turn'));
 g=new Game({players:4,rounds:2,hp:2,seed:42},choose);results.push(eq(g.deck.length,30,'§10 initial deck'));await g.startRound();for(let i=0;i<1000&&g.phase!=='finished';i++){if(g.phase==='between'){await g.startRound();continue}let p=g.p[g.turn];let card=p.hand.find(c=>g.playable(c)&&c.kind==='action'&&c.e.some(e=>e.id===0))??p.hand.find(c=>g.playable(c));if(card)await g.play(card.id);else await g.endTurn()}results.push(eq([g.phase,g.round,g.p.every(p=>p.abilities.length>=2)],['finished',2,true],'§3–7 two round complete and abilities persist'));
 return results
}
console.log((await verify(Game)).join('\n'));
