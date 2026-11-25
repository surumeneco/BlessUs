import assert from 'node:assert/strict';
import {Game} from './engine.mjs';
import {logLayout,activationContext} from './log-layout.mjs';
const entries=[{index:1,activation:10,root:true},{index:2,activation:10},{index:3,activation:20,root:true},{index:4,activation:30,root:true},{index:5,activation:20},{index:6,cause:10}];
const acts=[{seq:10},{seq:20,cause:10},{seq:30,cause:10}];
const graph=logLayout(entries,acts);assert.deepEqual(graph.rows.map(e=>e.index),[6,5,4,3,2,1]);assert.deepEqual(graph.rows.map(e=>e.parent),[1,3,1,1,1,null]);for(const a of graph.edges)for(const b of graph.edges)if(a!==b&&a.parent!==b.parent&&a.lane===b.lane)assert.ok(a.hi<b.lo||b.hi<a.lo);assert.equal(logLayout(entries,acts,e=>e.root).edges.length,2);console.log('PASS actual causal log edges, order, lane separation and filtered ancestors');
let g=new Game({players:3}),p=g.p[0],q=g.p[1],events=[];g.onVisual=e=>events.push(e);p.hp=4;q.hp=9;await g.effect(p,3,g.group(0),{target:q},-1);assert.deepEqual([p.hp,q.hp],[9,4]);assert.deepEqual(events.find(e=>e.type==='exchange'),{type:'exchange',players:[0,1],before:[4,9],after:[9,4]});assert.equal(events.filter(e=>e.presentation==='exchange').length,2);q.dead=true;events=[];await g.effect(p,3,g.group(0),{target:q},-1);assert.equal(events.length,0);console.log('PASS exchange motion uses original and resulting HP, failed exchange emits nothing');
let c=g.action(0,0);const snapshot=structuredClone(c);await g.modify(p,c,'add','t',true);const mod=events.find(e=>e.type==='modify');assert.deepEqual(mod.before,snapshot);assert.equal(mod.card.t.length,2);assert.ok(mod.card.t.includes(mod.added));console.log('PASS modification snapshot and actual attached module');
g=new Game({players:3},async(_,prompt,opts)=>prompt==='ラウンド終了：デッキ改変'?opts.find(o=>o.v===2):opts[0]);p=g.p[0];const a=g.action(0,0),b=g.action(1,1),before=structuredClone(a),material=structuredClone(b);p.hand=[a,b];events=[];g.onVisual=e=>events.push(e);await g.upgradePlayer(p);const fusion=events.find(e=>e.type==='fusion');assert.deepEqual(fusion.before,before);assert.deepEqual(fusion.material,material);assert.deepEqual(fusion.card.t,[0,1]);assert.deepEqual(p.hand,[a]);console.log('PASS fusion presents both original materials and final card');
// The palette source is tested without requiring a DOM or browser renderer.
const {readFileSync}=await import('node:fs');const palette=readFileSync(new URL('./presentation.mjs',import.meta.url),'utf8');const tokens=Object.fromEntries([...palette.match(/export const C=\{([^}]+)\}/)[1].matchAll(/(\w+):0x([\da-f]+)/g)].map(m=>[m[1],parseInt(m[2],16)]));const lum=n=>[16,8,0].map(x=>((n>>x)&255)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
for(const fg of ['ink','greenInk','goldInk','redInk'])for(const bg of ['paper','bg','table'])assert.ok(ratio(tokens[fg],tokens[bg])>=4.5,`${fg}/${bg} ${ratio(tokens[fg],tokens[bg])}`);assert.ok(ratio(0xffffff,tokens.purple)>=4.5);for(const [,bg] of palette.match(/export const moduleColors=\[([^;]+);/)[1].matchAll(/\[0x([\da-f]+),0x[\da-f]+\]/g))assert.ok(ratio(tokens.ink,parseInt(bg,16))>=4.5);console.log('PASS semantic text and module contrast (selected combinations >= 4.5:1)');

// Verify the real presentation hook and static result panel without starting Phaser.
const appSource=readFileSync(new URL('./app.mjs',import.meta.url),'utf8');
const hook=appSource.slice(appSource.indexOf('  g.onEffect=async info=>'),appSource.indexOf('  g.onEffectApplied=',appSource.indexOf('  g.onEffect=async info=>'))).trim();
const bind=new Function('g',hook);const shown=[];let release;
const controller={render(){},dur:n=>n,ui:{anchors:new Map([['active',{x:150,y:200}]]),effectResult(label,at,ms){shown.push({label,at,ms});return new Promise(r=>{release=r})}},delay(){throw Error('unexpected candidate delay')}};
const randomGame=new Game({players:2},async(_,q,o)=>{assert.equal(shown.length,1);assert.ok(released);return o[1]});const randomPlayer=randomGame.p[0],randomCard=randomGame.action(0,13);randomPlayer.hand=[randomCard];randomGame.int=()=>0;bind.call(controller,randomGame);let released=false;const running=randomGame.fire(randomCard);for(let i=0;i<20&&!release;i++)await Promise.resolve();assert.equal(shown.length,1);assert.equal(shown[0].label,'1ダメージを任意のプレイヤーに与える');assert.equal(shown[0].ms,650);assert.equal(randomGame.p[1].hp,10);released=true;release();await running;assert.equal(randomGame.p[1].hp,9);assert.ok(!palette.includes('rollEffect('));assert.ok(!palette.includes('効果を抽選中'));console.log('PASS random effect immediately presents its actual result, holds before target selection, and never rolls presentation candidates');

// Actual branching chain: root A -> B, C, D. D's cause is older than two recent cards.
const branchGame=new Game({players:4});branchGame.p[0].hand=[branchGame.action(0,1)];for(const player of branchGame.p.slice(1))player.hand=[branchGame.action(2,2)];
await branchGame.fire(branchGame.p[0].hand[0]);await branchGame.drain();const [root,b1,b2,b3]=branchGame.activations;assert.equal(branchGame.activations.length,4);assert.equal(b3.cause,root.seq);assert.deepEqual(activationContext(branchGame.activations,b3).map(x=>[x.activation.seq,x.role]),[[root.seq,'発動元'],[b2.seq,'直前']]);
assert.deepEqual(activationContext(branchGame.activations,b1).map(x=>[x.activation.seq,x.role]),[[root.seq,'発動元']]);assert.deepEqual(activationContext(branchGame.activations,root),[]);
const reuse={...b3,seq:5,card:root.card,cause:root.seq};assert.equal(activationContext([...branchGame.activations,reuse],reuse)[0].activation.seq,root.seq);
const ability={seq:6,kind:'ability',label:'能力'},child={...b3,seq:7,cause:6};assert.equal(activationContext([...branchGame.activations,ability,child],child)[0].activation,ability);console.log('PASS causal card survives older-than-recent branching, repeated card identity and ability source');

// Bind the real UI hooks to a real engine; the engine still resolves units independently.
const rowHooks=appSource.slice(appSource.indexOf('  g.onEffect=async info=>'),appSource.indexOf('  g.onUseWithoutTrigger=',appSource.indexOf('  g.onEffectApplied=')));
const bindRows=new Function('g',rowHooks);
async function verifyRows(effects,{repeat=false,replay=false}={}){
 const g=new Game({players:3},async(_,q,opts)=>opts.find(o=>o.v===g.p[1])??opts[0]);g.deck=[];g.grave=[];g.round=1;g.phase='play';const p=g.p[0],c=g.action(0,replay?10:effects[0].id);
 c.e=replay?[{id:10,n:1}]:effects.map(e=>({...e}));p.hand=[c];if(replay)g.history=[{id:100,e:effects}];if(repeat){p.abilities=[6];g.rnd=()=>0}
 for(let i=0;i<12;i++)g.deck.push(g.action(0,2));
 const frames=[],waits=[],controller={events:[],checkGame(game){assert.equal(game,g)},render(){},delay(n){waits.push(n)},dur:n=>n,ui:{anchors:new Map(),pulseCount(){},effectResult(){}},async flush(row){assert.equal(row,true);if(this.events.length)frames.push(this.events.splice(0))}};
 bindRows.call(controller,g);g.onVisual=e=>{if(e.reason!=='resolved')controller.events.push(e)};
 await g.fire(c);return {g,frames,waits}
}
const row=await verifyRows([{id:0,n:3},{id:5,n:2},{id:8,n:3}]);assert.deepEqual(row.frames.map(f=>f.map(e=>e.type)),[['hp','hp','hp'],Array(6).fill('move'),Array(3).fill('ap')]);assert.equal(row.g.p[1].hp,7);assert.deepEqual(row.g.p.map(p=>p.hand.length),[2,2,2]);assert.equal(row.g.p[0].ap,3);assert.equal(row.waits.length,3);
const repeated=await verifyRows([{id:1,n:3}],{repeat:true});assert.deepEqual(repeated.frames.map(f=>f.length),[6,6]);assert.deepEqual(repeated.g.p.map(p=>p.hp),[10,4,4]);
const referenced=await verifyRows([{id:0,n:3},{id:2,n:2}],{replay:true});assert.deepEqual(referenced.frames.map(f=>f.length),[3,2]);assert.deepEqual(referenced.g.p.map(p=>p.hp),[12,7,10]);console.log('PASS real engine/UI hooks batch each row, ability repeat and replay separately without changing rule units');

// Exercise the actual controller's lifecycle without a browser; the browser suite exercises UI and network.
const ControllerForLifecycle=new Function('sleep',appSource.slice(appSource.indexOf('class Controller{'),appSource.indexOf('installLan(Controller,')).trim()+';return Controller;')(ms=>new Promise(r=>setTimeout(r,ms)));
const lifecycle=()=>Object.assign(Object.create(ControllerForLifecycle.prototype),{g:{phase:'play'},page:'battle',busy:false,abort:false,pending:new Map(),hidden:new Set([1]),handOffsets:new Map(),aux:[],events:[1],generated:[1],trace:[1],ui:{cancel(){},clearAnimations(){}},scene:{cameras:{main:{resetFX(){}}}},render(){},go(page){this.page=page;this.aux=[]},flush(){this.flushCount=(this.flushCount??0)+1},cpu(){return false}});
{
 const c=lifecycle();let reject;const old=c.run(()=>new Promise((_,r)=>reject=r));c.pending.set(0,{reject});c.closeGame();await old;assert.equal(c.page,'room');assert.equal(c.busy,false);assert.equal(c.g,null);assert.equal(c.pending.size,0);assert.equal(c.hidden.size,0);assert.deepEqual(c.events,[]);
}
{
 const c=lifecycle(),g=c.g;let release;const old=c.run(()=>new Promise(r=>release=r));c.closeGame();c.g={phase:'play'};c.abort=false;c.busy=true;c.page='battle';c.events=['new'];release();await old;assert.equal(c.busy,true);assert.equal(c.flushCount,undefined);assert.deepEqual(c.events,['new']);assert.throws(()=>c.checkGame(g),/対戦中断/);
}
{
 const c=lifecycle();c.aux=[{}];const old=c.waitModal();c.closeGame();c.g={phase:'play'};c.abort=false;c.page='battle';await assert.rejects(old,/対戦中断/);
}
console.log('PASS abort resets room, stale run and modal cannot affect restarted match');
