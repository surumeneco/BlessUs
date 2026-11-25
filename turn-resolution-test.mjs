import assert from 'node:assert/strict';
import {Game} from './engine.mjs';
const blank=(choose=async(_,__,opts)=>opts[0])=>{const g=new Game({players:3,rounds:1},choose);g.deck=[];g.grave=[];g.phase='play';return g};
const check=async(label,fn)=>{await fn();console.log('PASS '+label)};
await check('Discard trigger returns same card from grave to right end of hand',async()=>{
 const g=blank(),p=g.p[0],stay=g.action(1,9),other=g.action(0,2),group=g.group(0);p.hand=[stay,other];g.discard(p,stay,group);g.enqueue(group);assert.deepEqual(p.hand,[other]);await g.drain();assert.deepEqual(p.hand,[other,stay]);assert.ok(!g.grave.includes(stay));assert.equal(g.finalCards().filter(c=>c===stay).length,1);
});
await check('Stay has no passive discard protection, including used discard trigger',async()=>{
 const g=blank(),p=g.p[0],stay=g.action(0,9),used=g.action(1,9),group=g.group(0);p.hand=[stay,used];g.used.add(used.id+':1');g.discard(p,stay,group);g.discard(p,used,group);g.enqueue(group);await g.drain();assert.deepEqual(g.grave,[stay,used]);assert.equal(g.history.length,0);
});
await check('Discard reaction can reclaim same card after reshuffle into deck',async()=>{
 const g=blank(),p=g.p[0],stay=g.action(1,9),group=g.group(0);p.hand=[stay];g.discard(p,stay,group);g.enqueue(group);g.deck=g.grave.splice(0);await g.drain();assert.deepEqual(p.hand,[stay]);assert.equal(g.deck.length,0);
});
await check('All damage units finish before reaction registration, then healing resolves',async()=>{
 const g=blank(async(_,q,opts)=>opts.find(o=>o.v.id===1)),[a,b]=g.p,attack=g.action(0,0),heal=g.action(2,2);attack.e[0].n=2;a.hand=[attack];b.hand=[heal];b.hp=2;const seen=[];g.onEffectApplied=(info,path)=>{if(info?.card.id===attack.id)seen.push([path[0].unit,b.hp,g.used.has(heal.id+':2'),g.pendingCards().includes(heal)])};await g.fire(attack);assert.deepEqual(seen,[[1,1,false,false],[2,0,true,true]]);assert.equal(b.dead,false);await g.drain();assert.equal(b.hp,1);await g.closeTurn();assert.equal(b.dead,false);
});
await check('Negative HP remains exact and turn-end trigger rescues it',async()=>{
 const g=blank(),[a,b]=g.p;a.hp=1;const damage=g.group(1);g.hpChange(a,-3,b,damage);assert.equal(a.hp,-2);assert.equal(a.dead,false);const recover=g.action(11,2);recover.e[0].n=3;a.hand=[recover];g.enqueue(damage);await g.drain();await g.closeTurn();assert.equal(a.hp,1);assert.equal(a.dead,false);
});
await check('Negative HP can be exchanged and elimination is only at end',async()=>{
 const g=blank(),[a,b]=g.p;a.hp=-2;b.hp=5;await g.effect(a,3,g.group(0),{target:b},-1);assert.deepEqual([a.hp,b.hp,a.dead,b.dead],[5,-2,false,false]);await g.closeTurn();assert.deepEqual([a.hp,b.hp,a.dead,b.dead],[5,0,false,true]);
});
await check('Final elimination runs after end abilities and chains, clamping without heal reaction',async()=>{
 const g=blank(),[a,b,c]=g.p;a.abilities=[7];b.hp=1;c.hp=-2;const heal=g.action(2,2),watch=g.action(5,2);b.hand=[heal];a.hand=[watch];await g.closeTurn();assert.deepEqual([b.hp,b.dead,c.hp,c.dead],[1,false,0,true]);assert.ok(a.hand.includes(watch)===false);assert.equal(g.fallen.length,1);assert.equal(g.fallen[0],c);
});
await check('Ability repeat resolves full separate rows and preserves per-turn reaction limit',async()=>{
 const choices=[],g=blank(async(_,q,opts)=>{const i=choices.length+1;choices.push(i);return opts[i]}),[a,b,c]=g.p,attack=g.action(0,0),healB=g.action(2,2),healC=g.action(2,2);a.abilities=[6];attack.e[0].n=2;a.hand=[attack];b.hand=[healB];c.hand=[healC];g.rnd=()=>0;const seen=[];g.onEffectApplied=(info,path)=>{if(info?.card.id===attack.id)seen.push([path[0].repeat,path[0].unit,g.used.has(healB.id+':2'),g.used.has(healC.id+':2')])};await g.fire(attack);assert.deepEqual(choices,[1,2]);assert.deepEqual(seen,[[1,1,false,false],[1,2,true,false],[2,1,true,false],[2,2,true,true]]);await g.drain();assert.deepEqual([b.hp,c.hp],[9,9]);
});
await check('A player at nonpositive HP keeps AP and the round does not terminate early',async()=>{
 const g=blank(async(_,q,opts)=>opts[1]??opts[0]),[a,b,c]=g.p;a.ap=2;a.hp=1;b.hp=1;c.dead=true;c.hp=0;g.fallen=[c];const attack=g.action(0,0),heal=g.action(0,2);attack.e[0].n=2;a.hand=[attack,heal];await g.play(attack.id);assert.equal(g.phase,'play');assert.equal(a.ap,1);assert.equal(b.hp,-1);assert.equal(b.dead,false);await g.play(heal.id);assert.equal(g.phase,'finished');assert.equal(b.dead,true);assert.equal(b.hp,0);
});
