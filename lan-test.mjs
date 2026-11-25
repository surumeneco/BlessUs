import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {peerOptions,observeConnection,roomPeerId,classifyJoin,playerView,hydrateView,choiceView,hydrateChoice,visualView,combineLineVisuals} from './lan.mjs';
import {Game} from './engine.mjs';
assert.deepEqual(peerOptions().config.iceServers,[{urls:'stun:stun.l.google.com:19302'}]);
assert.notEqual(peerOptions().config.iceServers,peerOptions().config.iceServers);
const eventHandlers={},peerHandlers={},diagnostics=[];
const oldInfo=console.info;
try {
 console.info=(...args)=>diagnostics.push(args);
 const pc={iceConnectionState:'new',iceGatheringState:'gathering',connectionState:'new',signalingState:'stable',addEventListener:(key,fn)=>eventHandlers[key]=fn};
 observeConnection({peerConnection:pc,on:(key,fn)=>peerHandlers[key]=fn},'guest');
 eventHandlers.icecandidate({candidate:{type:'srflx',protocol:'udp',address:'private-address'}});
 eventHandlers.icecandidateerror({errorCode:701,url:'private-url'});
 pc.iceConnectionState='connected';eventHandlers.iceconnectionstatechange();
 peerHandlers.open();peerHandlers.error({type:'network',message:'private-message'});
 assert.ok(diagnostics.some(x=>x[2]==='icecandidate'&&x[3].type==='srflx'));
 assert.ok(diagnostics.some(x=>x[2]==='iceconnectionstatechange'&&x[3].ice==='connected'));
 assert.ok(diagnostics.some(x=>x[2]==='datachannel-open'));
 assert.ok(!JSON.stringify(diagnostics).includes('private-'));
}finally{console.info=oldInfo}
console.log('PASS STUN-only configuration and non-sensitive connection diagnostics');
assert.equal(await roomPeerId('祝福のねこ123',webcrypto),await roomPeerId('祝福のねこ123',webcrypto));
assert.equal(await roomPeerId('か\u3099',webcrypto),await roomPeerId('が',webcrypto));
await assert.rejects(roomPeerId('hello!',webcrypto));
const member={name:'ねこ',connected:false};
assert.equal(classifyJoin([member],'ねこ',true,6).resume,member);
assert.ok(classifyJoin([{...member,connected:true}],'ねこ',false,2).error);
assert.ok(classifyJoin([member],'新規',true,3).error);
assert.ok(classifyJoin([],'新規',false,6).error);
assert.equal(classifyJoin([],'新規',false,5).join,true);
const g=new Game({players:3});g.p[0].hand=[g.action(0,1)];g.p[1].hand=[g.action(1,2)];
g.direction=-1;
const v=playerView(g,1);assert.equal(v.direction,-1);assert.deepEqual(v.p[0].hand,[null]);assert.deepEqual(v.p[1].hand,g.p[1].hand);assert.equal(v.deckCount,g.deck.length);assert.equal(v.deck,undefined);assert.equal(v.cfg.seed,undefined);
const h=hydrateView(v,1);assert.equal(h.deck.length,g.deck.length);
const c=hydrateChoice(choiceView({id:1,token:3,prompt:'選択',context:{kind:'player'},opts:[{v:g.p[0],label:'P1'}]}),h);
const recovered=g.action(13,9);g.grave.push(recovered);const viewWithGrave=hydrateView(playerView(g,1),1);const graveChoice=hydrateChoice(choiceView({id:1,token:4,prompt:'墓地',context:{kind:'grave'},opts:[{v:recovered,label:'墓地'}]}),viewWithGrave);assert.equal(graveChoice.opts[0].v,viewWithGrave.grave.find(x=>x.id===recovered.id));
assert.equal(c.opts[0].v,h.p[0]);assert.equal(c.opts[0].v.hand[0],null);
console.log('PASS LAN room identification, reconnect classification, private state and choice hydration');

const hidden={type:'move',reason:'draw',card:g.p[0].hand[0],from:{zone:'deck'},to:{zone:'hand',player:0}};
assert.equal(visualView(hidden,1).card,null);assert.deepEqual(visualView(hidden,0).card,hidden.card);
const privateFusion={type:'fusion',player:0,card:hidden.card,material:g.p[1].hand[0]};
assert.equal(visualView(privateFusion,1).card,undefined);
const disconnectedVote=new Game({players:2,humanPlayers:[0,1]},async id=>id===1?null:null);
await disconnectedVote.vote();assert.equal(disconnectedVote.votingResults.length,0);
console.log('PASS animation privacy and disconnected voter skip');

const sourceEvents=[{type:'hp',player:0,actor:1,old:10,value:9},{type:'hp',player:2,actor:1,old:10,value:9},{type:'hp',player:0,actor:1,old:9,value:8},{type:'ap',player:1,value:1},{type:'ap',player:1,value:2},hidden];const originalEvents=JSON.stringify(sourceEvents),combined=combineLineVisuals(sourceEvents);assert.deepEqual(combined.map(e=>e.type),['hp','hp','ap','move']);assert.deepEqual(combined.slice(0,2).map(e=>[e.player,e.old,e.value]),[[0,10,8],[2,10,9]]);assert.equal(combined[2].count,2);assert.deepEqual(visualView(combined[2],2),{type:'ap',player:1,count:2});assert.equal(visualView(combined[3],1).card,null);assert.equal(JSON.stringify(sourceEvents),originalEvents);assert.equal(combineLineVisuals([{type:'hp',presentation:'exchange',player:0,old:1,value:4},{type:'hp',presentation:'exchange',player:0,old:4,value:2}]).length,2);console.log('PASS effect-row visual aggregation preserves source events, separate targets and privacy');
