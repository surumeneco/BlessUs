import assert from 'node:assert/strict';
import {newProfile,randomAppearance,cleanName,cpuName,PARTS,PALETTE} from './player-profile.mjs';
import {cpuRandom,createCpuPolicy,chooseCpuCard,chooseCpuOption} from './cpu-policy.mjs';
import {Game} from './engine.mjs';
const r=cpuRandom(123),names=new Set(),choices=new Map(Object.keys(PARTS).map(k=>[k,new Set()]));
for(let i=0;i<300;i++){const p=newProfile(i,r);assert.match(p.cpuName,/^[\u3041-\u3096\u30a1-\u30fa]{3,7}$/u);names.add(p.cpuName);assert.equal(p.humanName,`P${i+1}`);for(const k of Object.keys(PARTS)){assert.ok(p.appearance[k]>=0&&p.appearance[k]<PARTS[k].length);choices.get(k).add(p.appearance[k])}}
assert.ok(names.size>100);
// Independently chosen characters; neither script nor a pronounceable word is forced.
const pool=Array.from({length:86},(_,i)=>String.fromCharCode(0x3041+i)).concat(Array.from({length:90},(_,i)=>String.fromCharCode(0x30a1+i)));
assert.equal(cpuName(()=>0),'ぁぁぁ');assert.equal(cpuName(()=>0.999999),'ヺ'.repeat(7));
for(let i=0;i<pool.length;i++){let calls=0;assert.equal(cpuName(()=>calls++===0?0:(i+.5)/pool.length),pool[i].repeat(3))}
let draws=[0,...['メ','す','ょ'].map(c=>(pool.indexOf(c)+.5)/pool.length)];assert.equal(cpuName(()=>draws.shift()),'メすょ');
assert.deepEqual([...new Set([...names].map(n=>n.length))].sort(),[3,4,5,6,7]);
for(const [k,v] of choices)assert.equal(v.size,PARTS[k].length);assert.equal(PALETTE.length,PARTS.color.length);assert.equal(cleanName('  かみ\nさま  '),'かみさま');assert.equal(Array.from(cleanName('あ'.repeat(40))).length,12);assert.equal(cleanName(' \t '),'');assert.notEqual(randomAppearance(r),randomAppearance(r));console.log('PASS session profile name generation, all appearance options, name input normalization');
// Exercise the real engine across mixed policy assignments and rounds. No forced turn/round cap in production.
for(let seed=1;seed<=12;seed++){
 const ps=Array.from({length:4},(_,id)=>createCpuPolicy(seed,id));const g=new Game({players:4,rounds:3,seed},(id,prompt,opts,ctx)=>chooseCpuOption(g,id,prompt,opts,ctx,ps[id]));let steps=0;await g.startRound();while(g.phase!=='finished'&&steps++<4000){if(g.phase==='between')await g.startRound();else if(g.phase==='play'){const p=g.p[g.turn],c=chooseCpuCard(g,p,ps[p.id]);if(c&&p.ap>0)await g.play(c.id);else await g.endTurn()}else throw Error(`unexpected phase ${g.phase}`)}assert.equal(g.phase,'finished',`seed ${seed}: ${steps} operations`);assert.equal(g.round,3);console.log(`PASS CPU profiles complete 4-player 3-round game seed ${seed}, ${steps} operations`)
}
