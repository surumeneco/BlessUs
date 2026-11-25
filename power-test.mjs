import assert from 'node:assert/strict';
import {Game} from './engine.mjs';
import {PT,PE,normalizePower,powerCount,powerScore} from './power.mjs';
import {playerView,hydrateView,visualView} from './lan.mjs';
const config=(t,...pairs)=>({t:[t],e:pairs.map(([id,n=1])=>({id,n}))});
const choose=async(p,q,o,ctx)=>ctx?.kind==='player'?(o.find(x=>x.v.id!==p)??o[0]):o[0];
const game=(powers=[],extra={},pick=choose)=>{const g=new Game({players:3,rounds:2,powerEnabled:true,powers,...extra},pick);g.deck=[];g.grave=[];g.round=1;g.phase='play';return g};
const react=async(g,type,subject,actor=null)=>{const group=g.group(g.turn);g.emit(group,type,subject,actor);g.enqueue(group);await g.drain()};
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('PASS power '+name)};
await test('catalog and unit-based validation',()=>{
 assert.equal(PT.length,20);assert.equal(PE.length,24);
 assert.deepEqual(PT.map(x=>x[1]),[1,1,1,1,1,0,0,1,1,1,0,1,1,1,0,1,1,0,1,-5]);
 assert.deepEqual(PE.map(x=>x[1]),[1,3,-2,2,-1,1,-1,-2,-2,-1,1,2,2,0,0,2,2,0,0,2,-2,1,-5,6]);
 const valid=normalizePower(config(5,[0,1],[0,1],[2,1]));
 assert.deepEqual(valid.e,[{id:0,n:2},{id:2,n:1}]);assert.equal(powerCount(valid),3);assert.equal(powerScore(valid),0);
 for(const bad of [config(5,[0,1]),config(5,[2,6]),config(5,[22,2]),config(19,[23,2],[22,1],[2,1]),config(5),{t:[5,6],e:[{id:2,n:1}]},config(5,[24,1]),config(5,[2,0]),config(5,[2,.5])])assert.equal(normalizePower(bad),null);
 assert.equal(normalizePower(null),null);assert.equal(new Game().cfg.powerEnabled,false);
});
await test('all twenty trigger predicates, disabled, dead and once-per-turn',async()=>{
 for(let t=0;t<PT.length;t++){
  const g=game([config(t,[6,1])]),[a,b]=g.p;let type=PT[t][2],subject=a,actor=null;
  if(type==='damageSelf'){type='damage';actor=b}
  if(type==='damageOther'){type='damage';subject=b;actor=a}
  if(type==='otherEliminate'){type='eliminate';subject=b;b.dead=true}
  if(type==='eliminate')a.dead=true;
  if(type==='roundStart')subject=null;
  const group=g.group(0);g.emit(group,type,subject,actor);g.emit(group,type,subject,actor);
  assert.equal(group.entries.filter(e=>e.c.kind==='power').length,1,'trigger '+t);
  assert.ok(g.used.has('-1:'+t));
 }
 const g=game([config(5,[2,1])],{powerEnabled:false});await react(g,'start',g.p[0]);assert.equal(g.activations.length,0);
 g.cfg.powerEnabled=true;g.p[0].dead=true;await react(g,'start',g.p[0]);assert.equal(g.activations.length,0);
});
await test('power after each owner hand, then source-player rank; no deck or history entry',async()=>{
 const g=game([config(0,[6,1]),config(1,[6,1])]),[a,b]=g.p;
 const ac=g.action(2,9),bc=g.action(3,9);a.hand=[ac];b.hand=[bc];
 const group=g.group(1);g.hpChange(a,-1,b,group);g.enqueue(group);
 assert.deepEqual(g.queue[0].map(e=>e.c.id),[bc.id,ac.id,b.power.id,a.power.id]);
 await g.drain();assert.equal(g.history.length,2);assert.equal(g.activations.filter(x=>x.kind==='power').length,2);
 assert.ok(g.finalCards().every(c=>c.kind!=='power'));
});
await test('partial and cross-row unpaid costs settle once after all lines',async()=>{
 const g=game([config(5,[6,3],[3,1])]),a=g.p[0],seen=[];
 a.hand=[g.action(0,0)];g.onVisual=e=>{if(e.type==='hp')seen.push([e.value-e.old,e.presentation])};
 await react(g,'start',a);assert.equal(a.hp,10);assert.deepEqual(seen,[[1,null],[-1,'powerSettlement']]);assert.equal(a.hand.length,0);
 await react(g,'start',a);assert.equal(g.activations.length,1);
 const h=game([config(5,[6,1],[9,1],[3,1])]),p=h.p[0];await react(h,'start',p);assert.equal(p.hp,10);assert.equal(h.activations[0].steps.at(-1)[0].kind,'settlement');
});
await test('ability loss choice, missing ability, twofold positive and negative, unique only in build',async()=>{
 const g=game([config(5,[22,1],[23,1],[6,1])],{},async(p,q,o,ctx)=>ctx?.kind==='abilityLoss'?o[1]:choose(p,q,o,ctx)),a=g.p[0];a.abilities=[0,4];await react(g,'start',a);assert.deepEqual(a.abilities,[0]);assert.equal(a.score,1);assert.equal(a.hp,10);
 const h=game([config(5,[22,1],[23,1],[6,1])]),p=h.p[0];await react(h,'start',p);assert.equal(p.hp,7);assert.equal(p.score,1);
 const x=game([config(5,[23,1],[2,3])]),q=x.p[0];q.abilities=[6];x.rnd=()=>0;await react(x,'start',q);assert.equal(q.score,2);assert.equal(q.hp,4);assert.equal(q.roundPower,2);
 const y=game([config(5,[7,1],[3,1])]),r=y.p[0];r.abilities=[6];let rolls=0;y.rnd=()=>{rolls++;return 0};await react(y,'start',r);assert.equal(r.hp,10);assert.equal(rolls,2);
});
await test('power random uses only its own catalog, applies actual failed negative effect',async()=>{
 const g=game([config(5,[21,1],[6,1])]),p=g.p[0];g.int=()=>22;await react(g,'start',p);assert.equal(p.score,1);assert.equal(g.activations[0].randomResults[0].id,23);
 const h=game([config(5,[21,1],[6,1])]),q=h.p[0];h.int=()=>6;await react(h,'start',q);assert.equal(q.hp,9);assert.equal(h.activations[0].randomResults[0].id,6);
});
await test('elimination power is allowed exactly once, subsequent zero HP waits for next turn',async()=>{
 const g=game([config(19,[0,3])]),[a,b,c]=g.p;a.hp=0;b.hp=2;
 await g.closeTurn();assert.equal(a.dead,true);assert.equal(b.dead,false);assert.equal(b.hp,-1);assert.equal(g.used.size,0);assert.equal(g.activations.filter(x=>x.kind==='power').length,1);
 g.turn=1;await g.closeTurn();assert.equal(b.dead,true);assert.equal(c.dead,false);assert.equal(g.activations.filter(x=>x.kind==='power').length,1);
 const h=game([config(19,[23,1],[6,1])]),p=h.p[0];p.hp=0;await h.closeTurn();assert.equal(p.score,1);assert.equal(p.hp,0);
});
await test('round start order and first-turn reaction state',async()=>{
 const g=new Game({players:3,powerEnabled:true,powers:[0,1,2].map(()=>config(17,[2,1],[3,1])),seed:42},choose);
 g.startTurn=async()=>{g.phase='play'};await g.startRound();assert.deepEqual(g.activations.filter(x=>x.kind==='power').map(a=>a.player),g.seats);
 assert.ok(g.p.every(p=>g.used.has(p.power.id+':17')));await g.closeTurn();assert.equal(g.used.size,0);
});
await test('new event sources: normal AP excluded, event use/copy/modify, empty and low-HP threshold',async()=>{
 const g=game([config(12,[6,1])]),p=g.p[0];g.deck=[g.action(0,0)];await g.startTurn();assert.equal(g.activations.length,0);const group=g.group(0);await g.effect(p,8,group,{},-1);g.enqueue(group);await g.drain();assert.equal(g.activations[0].kind,'power');
 for(const [trigger,event] of [[11,0],[8,0],[9,3],[10,2],[13,3],[14,2]]){
  const h=game([config(trigger,[2,1])],{},async(id,prompt,opts,ctx)=>ctx?.kind==='moduleKind'?opts.find(o=>o.v===(trigger===13||trigger===14?'t':'e')):choose(id,prompt,opts,ctx)),a=h.p[0],v=h.event(event);a.hand=[v,h.action(0,0)];a.ap=2;await h.play(v.id);assert.ok(h.activations.some(x=>x.kind==='power'),'event trigger '+trigger);
 }
 const h=game([config(15,[2,1])]),a=h.p[0],card=h.action(0,2);a.hand=[card];a.ap=2;await h.play(card.id);assert.ok(h.activations.some(x=>x.kind==='power'));
 const l=game([config(16,[2,1])]),b=l.p[0],group2=l.group(1);b.hp=4;l.hpChange(b,-1,l.p[1],group2);l.enqueue(group2);await l.drain();assert.equal(b.hp,2);
});
await test('all power effect types have executable paths and correct custom resource semantics',async()=>{
 for(let id=0;id<PE.length;id++){
  const g=game(),[a,b,c]=g.p;a.hand=[g.action(0,0),g.action(2,2)];b.hand=[g.action(0,1),g.action(0,2)];c.hand=[g.action(0,0)];g.deck=[g.action(0,0),g.action(0,0),g.action(0,0)];g.grave=[g.action(0,0)];a.ap=2;a.abilities=[4];g.int=()=>0;g.active={randomResults:[]};
  const state={unpaid:0},group=g.group(0);await g.powerEffect(a,id,group,{target:null,selected:false},state,[]);
  assert.equal(state.unpaid,0,'effect '+id);
  const checks=[()=>b.hp===9,()=>b.hp===9&&c.hp===9,()=>a.hp===9,()=>a.hp===11,()=>b.hp===11,()=>a.hand.length===3,()=>a.hand.length===1,()=>a.hand.length===1,()=>a.hand.length===1&&b.hand.length===3,()=>b.hand.length===3,()=>b.hand.length===1,()=>a.hand.length===3&&b.hand.length===1,()=>g.grave.length===0&&a.hand.length===3,()=>g.deck.length===0,()=>a.hand.length===1&&b.hand.length===1&&c.hand.length===0,()=>a.hand[0].t.length===2,()=>a.hand[0].e.reduce((s,x)=>s+x.n,0)===2,()=>a.hand[0].t[0]!==0,()=>a.hand[0].e.length>0,()=>a.ap===3,()=>a.ap===1,()=>b.hp===9,()=>a.abilities.length===0,()=>a.score===1];
  assert.ok(checks[id](),'effect '+id);
 }
});
await test('LAN public power and used flags, no private cards, reconnect ownership independent of control mode',async()=>{
 const g=game([config(5,[2,1]),config(0,[6,1])]);g.p[0].hand=[g.action(0,0)];g.p[1].hand=[g.action(0,2)];g.humanPlayers.add(0);g.humanPlayers.delete(0);const group=g.group(0);g.emit(group,'start',g.p[0]);g.enqueue(group);
 const v=playerView(g,1);assert.deepEqual(v.p[0].hand,[null]);assert.equal(v.p[0].power.id,-1);assert.ok(v.used.includes('-1:5'));assert.ok(v.pending.includes(-1));assert.equal(v.cfg.powerEnabled,true);assert.ok(hydrateView(v,1).pendingCards().some(c=>c.id===-1));
 await g.drain();assert.equal(g.p[0].hp,9);assert.equal(visualView({type:'point',player:0,count:1,value:3},1).value,3);
});
console.log(passed+' power test groups passed');
