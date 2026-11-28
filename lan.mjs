import {normalizePower} from './power.mjs';
// LAN play: one host owns the engine; each guest receives only its own view.
const copy=x=>JSON.parse(JSON.stringify(x));
// STUN adds direct routes; no TURN relay is configured.
export function peerOptions(){return {config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}}}
const networkLog=(role,event,details={})=>console.info('[Bless Us network]',role,event,details);
export function observeConnection(conn,role){
 const pc=conn.peerConnection;
 const log=(event,details)=>networkLog(role,event,details);
 log('datachannel-created');
 if(pc){
  const states=()=>({ice:pc.iceConnectionState,gathering:pc.iceGatheringState,connection:pc.connectionState,signaling:pc.signalingState});
  for(const event of ['iceconnectionstatechange','icegatheringstatechange','connectionstatechange','signalingstatechange'])pc.addEventListener(event,()=>log(event,states()));
  pc.addEventListener('icecandidate',e=>log('icecandidate',e.candidate?{type:e.candidate.type,protocol:e.candidate.protocol}:{complete:true}));
  pc.addEventListener('icecandidateerror',e=>log('icecandidateerror',{code:e.errorCode}));
  log('initial-state',states());
 }
 conn.on('open',()=>log('datachannel-open'));
 conn.on('close',()=>log('datachannel-close'));
 conn.on('error',e=>log('datachannel-error',{type:e?.type??e?.name??'unknown'}));
}
const passPattern=/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}a-zA-Z0-9０-９Ａ-Ｚａ-ｚー]+$/u;
export async function roomPeerId(value, crypto=globalThis.crypto){
 const normalized=String(value).normalize('NFC');
 if(!normalized||!passPattern.test(normalized))throw Error('合言葉はひらがな・カタカナ・漢字・英数字で入力してください');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));
 return 'bless-us-lan-'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
}
const normalizedName=s=>String(s).normalize('NFC');
export function classifyJoin(members,name,inMatch,count){
 const key=normalizedName(name),member=members.find(m=>normalizedName(m.name)===key);
 if(member)return member.connected||member.host?{error:'同じ名前のプレイヤーが接続中です'}:{resume:member};
 if(inMatch)return {error:'対戦中の新規参加はできません'};
 if(count>=6)return {error:'ルームが満員です'};
 return {join:true};
}
const publicActivation=a=>a?copy(Object.fromEntries(['kind','player','card','trigger','label','cause','from','manual','progress','randomResults','seq','round','turn','targets','steps','references'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]))):null;
export function playerView(g,id,history=null){
 const own=g.p[id],visible=new Set([...own.hand,...g.grave,...g.p.map(p=>p.power).filter(Boolean)].map(c=>c.id));
 return {cfg:{rounds:g.cfg.rounds,powerEnabled:g.cfg.powerEnabled},round:g.round,phase:g.phase,turn:g.turn,direction:g.direction,seats:[...g.seats],deckCount:g.deck.length,grave:copy(g.grave),
 p:g.p.map(p=>({id:p.id,hp:p.hp,dead:p.dead,score:p.score,ap:p.ap,abilities:[...p.abilities],power:copy(p.power??null),roundScores:copy(p.roundScores),lastRank:p.lastRank,voteScore:p.voteScore,hand:p.id===id?copy(p.hand):Array(p.hand.length).fill(null)})),
 used:[...g.used].filter(k=>visible.has(Number(k.split(':')[0]))),events:[...g.events].filter(k=>visible.has(k)),
 pending:g.pendingCards().filter(c=>visible.has(c.id)).map(c=>c.id),
 ...(history?{historyFrom:history,activeSeq:g.active?.seq??null,lastActivationSeq:g.lastActivation?.seq??null,allActivations:g.allActivations.slice(history.activations).map(publicActivation),timeline:copy(g.timeline.slice(history.timeline))}:{active:publicActivation(g.active),lastActivation:publicActivation(g.lastActivation),activations:g.activations.map(publicActivation),allActivations:g.allActivations.map(publicActivation),timeline:copy(g.timeline)})};
}
// Match confirmed targets by identity, never by the option's position.
export function targetFocusKey(active,c){
 const step=active?.progress?.at(-1),kind=c.context?.kind;
 if(!['player','card','grave'].includes(kind)||!step||!['line','random','event'].includes(step.kind))return null;
 const effect=step.kind==='event'?'event:'+active.card.event:(step.power?'power:':'effect:')+step.id;
 return JSON.stringify([c.id,effect,kind,kind==='player'?'':c.prompt]);
}
export function restoreTargetFocus(history,c){
 const id=history?.get(c.focusKey);
 return c.focusKey!=null&&id!=null?c.opts.find(o=>o.v?.id===id)??null:null;
}
export function rememberTargetFocus(history,c,o){
 if(c.focusKey!=null&&o.v?.id!=null)history.set(c.focusKey,o.v.id);
}
export function choiceView(c){
 if(!c)return null;
 return {id:c.id,token:c.token,prompt:c.prompt,context:copy(c.context??{}),selectedIndex:c.opts.indexOf(c.selected),opts:c.opts.map(o=>({...copy(o),v:c.context?.kind==='player'?{playerId:o.v.id}:copy(o.v)}))};
}
export function hydrateView(v,id,previous=null){
 if(v.historyFrom){const {activations,timeline}=v.historyFrom;if(activations>(previous?.allActivations?.length??0)||timeline>(previous?.timeline?.length??0))throw Error('Missing history prefix');const allActivations=[...(previous?.allActivations??[]).slice(0,activations),...v.allActivations],entries=[...(previous?.timeline??[]).slice(0,timeline),...v.timeline];const current=allActivations.filter(a=>a.round===v.round),find=seq=>seq==null?null:allActivations.find(a=>a.seq===seq)??null;const {historyFrom,activeSeq,lastActivationSeq,...rest}=v;v={...rest,allActivations,activations:current,timeline:entries,active:find(activeSeq),lastActivation:find(lastActivationSeq)}}
 const g={...v,deck:Array(v.deckCount).fill(null),used:new Set(v.used),events:new Set(v.events)};
 g.pendingCards=()=>[...g.p[id].hand,...g.grave,...g.p.map(p=>p.power).filter(Boolean)].filter(c=>v.pending.includes(c.id));
 g.playable=c=>c.kind==='action'||c.kind==='event'&&!g.events.has(c.id);
 g.standings=()=>[...g.p].sort((a,b)=>b.score-a.score||b.lastRank-a.lastRank);
 return g;
}
export function hydrateChoice(v,g){
 if(!v)return null;
 const opts=v.opts.map(o=>({...o,v:v.context?.kind==='player'?g.p[o.v.playerId]:v.context?.kind==='card'&&o.v?.id!=null?g.p[v.id].hand.find(c=>c.id===o.v.id)??o.v:v.context?.kind==='grave'?g.grave.find(c=>c.id===o.v.id)??o.v:o.v}));
 return {...v,selected:opts[v.selectedIndex]??null,opts};
}

// Presentation-only aggregation; never merge engine events or trigger/log entries.
export function combineLineVisuals(events){
 const result=[],groups=new Map();
 for(const e of events){
  const key=e.type==='hp'&&e.presentation!=='exchange'?JSON.stringify(['hp',e.player,e.actor,Math.sign(e.value-e.old)]):e.type==='ap'?JSON.stringify(['ap',e.player,Math.sign(e.count??1)]):null;
  if(key===null){result.push(e);continue}
  const prior=groups.get(key);
  if(prior){if(e.type==='hp')prior.value+=e.value-e.old;else{prior.count+=(e.count??1);prior.value=e.value}}
  else{const item={...e,...(e.type==='ap'?{count:e.count??1}:{})};groups.set(key,item);result.push(item)}
 }
 return result;
}
// Individual event projection: private cards and their IDs never leave the owner view.
export function visualView(e,id){
 const location=l=>l?{zone:l.zone,...(l.player!==undefined?{player:l.player}:{}),...(l.player===id&&l.cardId!==undefined?{cardId:l.cardId}:{})}:null;
 if(e.type==='move'){
  const own=l=>l?.zone==='hand'&&l.player===id;
  const visible=e.reason==='resolved'||e.from?.zone==='grave'||e.to?.zone==='grave'||e.from?.zone==='generated'||own(e.from)||own(e.to);
  return {type:e.type,reason:e.reason,from:location(e.from),to:location(e.to),card:visible?copy(e.card):null};
 }
 if(e.type==='modify'||e.type==='fusion')return e.player===id?copy(e):{type:e.type,player:e.player,mode:e.mode};
 const keys={hp:['player','actor','old','value','presentation'],exchange:['players','before','after'],ability:['player','ability'],abilityLoss:['player','ability'],point:['player','count','value'],ap:['player','count'],eliminate:['player'],shuffle:['count','from','to'],notice:['text']}[e.type];
 return keys?copy(Object.fromEntries([['type',e.type],...keys.filter(k=>e[k]!==undefined).map(k=>[k,e[k]])])):null;
}

export function installLan(Controller,{newProfile,cleanName,createCpuPolicy,PARTS,rect,C}){
 const P=Controller.prototype;
 P.ownId=function(){return this.net?.role==='guest'?this.net.id:0};
 P.isGuest=function(){return this.net?.role==='guest'};
 P.isMember=function(id){return id===0||!!this.net?.members?.some(m=>this.profiles[id]===m.profile)||!!this.net?.memberIds?.includes(id)};
 P.member=function(id){return this.net?.members?.find(m=>this.profiles[id]===m.profile)};
 P.isDisconnected=function(id){return !!(this.member(id)&&!this.member(id).connected||this.net?.disconnected?.includes(id))};
 P.canEditRoom=function(){return !this.isGuest()};
 P.canRemove=function(id){return this.canEditRoom()&&!this.isMember(id)&&this.modes.length>2};
 P.localRoom=function(){this.resetRoom();this.go('room')};
 P.resetRoom=function(){const old=this.profiles[this.ownId()]??newProfile(0);if(this.isGuest())this.room=this.net.localRoom??{rounds:3,hp:10,chance:25,deckId:'default',seed:'',powerEnabled:false};this.discardGame();this.stopNetwork();this.modes=['human','cpu','cpu','cpu'];this.profiles=[old,...[1,2,3].map(newProfileSafe)];this.view=0;this.abort=false};
 function newProfileSafe(i){return newProfile(i)}
 P.stopNetwork=function(){const n=this.net;this.net=null;if(n){clearTimeout(n.timer);clearInterval(n.interval);n.peer?.destroy()}};
 P.drawMultiplayer=function(m){const u=this.ui;if(m.kind==='multi'){u.modal('みんなで遊ぶ',400,190,()=>this.close(),r=>{u.button('create-room','ルームを作成',rect(r.x,r.y,r.w,44),()=>{this.close();this.open('connect',{role:'host',name:this.profiles[0].humanName,pass:''})},{primary:true});u.button('join-room','ルームに参加',rect(r.x,r.y+54,r.w,44),()=>{this.close();this.open('connect',{role:'guest',name:this.profiles[0].humanName,pass:''})})});return}
 u.modal(m.role==='host'?'ルームを作成':'ルームに参加',450,255,()=>{this.stopNetwork();this.close()},(r,o)=>{u.button('network-name','名前：'+(m.name||'未入力'),rect(r.x,r.y,r.w,39),()=>this.editText('プレイヤー名',m.name,v=>{m.name=cleanName(v);this.render()}),{disabled:!!m.waiting});u.button('network-pass','合言葉：'+(m.pass||'未入力'),rect(r.x,r.y+48,r.w,39),()=>this.editText('合言葉',m.pass,v=>{m.pass=v;this.render()}),{disabled:!!m.waiting});u.text(m.error??(m.waiting?'接続中…':'同じLAN内での直接通信を推奨します'),r.x,r.y+98,13,{width:r.w,color:m.error?C.redInk:C.muted});u.button('network-connect',m.role==='host'?'作成する':'参加する',rect(o.x+o.w-120,o.y+o.h-49,108,38),()=>this.connectRoom(m),{primary:true,disabled:!!m.waiting||!m.name||!m.pass})})};
 P.connectRoom=async function(m){
 if(m.waiting)return;m.error=null;m.waiting=true;this.render();let n;
 try{
 const id=await roomPeerId(m.pass);if(this.aux.at(-1)!==m){m.waiting=false;return}
 const PeerCtor=globalThis.Peer??globalThis.peerjs?.Peer;if(typeof PeerCtor!=='function')throw Error('通信ライブラリを読み込めませんでした');
 const name=cleanName(m.name);if(!name)throw Error('名前を入力してください');
 const profile={...this.profiles[0],humanName:name};this.stopNetwork();
 n={role:m.role,members:[],id:0,pass:m.pass,ready:false,profile,localRoom:{...this.room},serial:0,modal:m};
 this.net=n;const fail=msg=>{if(this.net!==n)return;if(n.ready){if(n.role==='guest'){this.abort=true;this.resetRoom();this.go('home');this.notify(msg)}else this.notify(msg);return}this.stopNetwork();m.waiting=false;m.error=msg;this.render()};
 n.fail=fail;n.stage='signaling';networkLog(n.role,'signaling-start');
 const peer=n.peer=m.role==='host'?new PeerCtor(id,peerOptions()):new PeerCtor(peerOptions());
 n.timer=setTimeout(()=>{networkLog(n.role,'timeout',{stage:n.stage});fail('接続がタイムアウトしました（'+({signaling:'接続先登録',direct:'端末間通信',join:'ルーム応答'}[n.stage]??'接続')+'）')},30000);
 peer.on('error',e=>{networkLog(n.role,'signaling-error',{type:e.type});fail(e.type==='unavailable-id'?'その合言葉のルームが既に存在します':e.type==='peer-unavailable'?'ルームが見つかりません':'接続できませんでした')});
 peer.on('open',()=>{if(this.net!==n)return;networkLog(n.role,'signaling-open');if(n.role==='host'){this.modes=['human','cpu','cpu','cpu'];this.profiles=[profile,...[1,2,3].map(newProfileSafe)];n.ready=true;clearTimeout(n.timer);this.go('room');n.interval=setInterval(()=>this.heartbeat(),1000)}else{n.stage='direct';const conn=n.conn=peer.connect(id,{reliable:true,serialization:'binary'});observeConnection(conn,n.role);conn.on('open',()=>{n.stage='join';networkLog(n.role,'join-sent');conn.send({type:'join',name,appearance:profile.appearance,power:normalizePower(profile.power),historyDelta:true})});conn.on('data',msg=>{if(this.net!==n)return;n.lastSeen=Date.now();if(msg?.type==='ping'){if(conn.open)conn.send({type:'pong'});return}if(msg?.type==='error'){if(!n.ready)fail(msg.message);else this.notify(msg.message);return}if(msg?.type==='state'){clearTimeout(n.timer);if(!n.ready){networkLog(n.role,'join-accepted');n.interval=setInterval(()=>this.heartbeat(),1000)}n.ready=true;this.receiveState(msg)}else if(msg?.type==='visual'&&n.ready)this.animateRemote(msg.event)});conn.on('close',()=>fail('ホストとの接続が切断されました'));conn.on('error',()=>fail('ホストとの接続に失敗しました'))}});
 peer.on('connection',conn=>{if(this.net!==n||n.role!=='host'){conn.close();return}observeConnection(conn,n.role);this.hostConnection(n,conn)});
 }catch(e){if(n&&this.net===n)this.stopNetwork();m.waiting=false;m.error=e.message;this.render()}
 };
 P.hostConnection=function(n,conn){
 let member=null,closed=false;const reject=message=>{try{conn.send({type:'error',message})}catch{};setTimeout(()=>conn.close(),200)};
 const closedFn=()=>{if(closed)return;closed=true;if(this.net!==n||!member||member.conn!==conn)return;member.connected=false;member.conn=null;const id=this.profiles.indexOf(member.profile);if(id<0)return;
 if(this.page==='room'){this.modes[id]='cpu';this.notify(member.profile.humanName+' が切断しました（CPU代行）');this.broadcast();return}
 this.modes[id]='cpu';if(this.g){this.g.humanPlayers.delete(id);this.cpuPolicies[id]??=createCpuPolicy(this.g.cfg.seed,id);const c=this.pending.get(id);if(c){this.pending.delete(id);c.resolve(c.prompt==='ベストカード投票'?null:this.bot(id,c.prompt,c.opts,c.context))}if(!this.busy&&this.g.phase==='play'&&this.g.turn===id)this.run(async()=>{})}
 this.notify(member.profile.humanName+' が切断しました（CPU代行）');this.broadcast()};
 conn.on('close',closedFn);conn.on('error',closedFn);
 conn.on('data',msg=>{if(this.net!==n||closed||!msg||typeof msg!=='object')return;
 if(!member){if(msg.type!=='join')return;networkLog(n.role,'join-received');const name=cleanName(msg.name??'');if(!name){reject('名前を入力してください');return}
 const records=[{name:this.profiles[0].humanName,connected:true,host:true},...n.members.map(m=>({name:m.profile.humanName,connected:m.connected,record:m}))];
 const result=classifyJoin(records,name,this.page!=='room',this.modes.length);if(result.error){reject(result.error);return}
 if(result.resume){member=result.resume.record;member.connected=true;member.conn=conn;const id=this.profiles.indexOf(member.profile);this.modes[id]=member.mode;if(this.g&&this.page!=='room'){if(member.mode==='human')this.g.humanPlayers.add(id);else this.g.humanPlayers.delete(id)}}
 else{const profile=newProfile(this.profiles.length);profile.humanName=name;profile.appearance=this.validAppearance(msg.appearance,profile.appearance);profile.power=normalizePower(msg.power);this.profiles.push(profile);this.modes.push('human');member={profile,connected:true,conn,mode:'human'};n.members.push(member)}
 member.historyDelta=msg.historyDelta===true;member.historyGame=null;member.historyCursor=null;member.last=null;member.lastSeen=Date.now();member.lastPing=0;member.onLost=closedFn;if(result.resume){this.notify(member.profile.humanName+' が再接続しました');this.broadcast(true)}else{this.render();this.broadcast(true)}return}
 if(member.conn!==conn||!member.connected)return;member.lastSeen=Date.now();if(msg.type==='pong')return;this.hostAction(member,msg)});
 };
 P.validAppearance=function(a,def){return Object.fromEntries(Object.entries(PARTS).map(([key,values])=>[key,Number.isInteger(a?.[key])&&a[key]>=0&&a[key]<values.length?a[key]:def[key]]))};
 P.uniqueName=function(name,id){return !this.profiles.some((p,i)=>i!==id&&this.isMember(i)&&normalizedName(p.humanName)===normalizedName(name))};
 P.hostAction=function(member,msg){
 const id=this.profiles.indexOf(member.profile);if(id<0)return;
 const error=message=>member.conn?.send({type:'error',message});
 if(msg.type==='profile'){
 if(msg.appearance)member.profile.appearance=this.validAppearance(msg.appearance,member.profile.appearance);
 if('power'in msg)member.profile.power=normalizePower(msg.power);
 if(this.page==='room'){if(msg.name!==undefined){const name=cleanName(msg.name);if(!name||!this.uniqueName(name,id)){error('同じ名前は使用できません');return}member.profile.humanName=name}
 if(['human','cpu'].includes(msg.mode)){member.mode=msg.mode;this.modes[id]=msg.mode}}this.renderState();return}
 if(this.page!=='battle'||!this.g||this.cpu(id))return;
 if(msg.type==='choice'){const c=this.pending.get(id);if(c&&c.token===msg.token&&Number.isInteger(msg.index)&&c.opts[msg.index]){rememberTargetFocus(this.targetFocus??=new Map(),c,c.opts[msg.index]);this.pending.delete(id);c.resolve(c.opts[msg.index]);this.renderState()}return}
 if(msg.seq!==(this.actionSeq??0)||this.busy||this.pending.size||this.flow||this.g.phase!=='play'||this.g.turn!==id||this.g.p[id].dead||this.g.p[id].ap<1)return;
 if(msg.type==='play'){const c=this.g.p[id].hand.find(c=>c.id===msg.card);if(c&&this.g.playable(c))this.run(()=>this.g.play(c.id))}
 else if(msg.type==='end')this.run(()=>this.g.endTurn());
 };
 P.heartbeat=function(){const n=this.net;if(!n?.ready)return;const now=Date.now();if(n.role==='guest'){if(now-(n.lastSeen??now)>10000)n.fail('ホストとの通信が途絶えました');return}for(const m of n.members){if(!m.connected)continue;if(now-(m.lastSeen??now)>10000){const conn=m.conn;m.onLost?.();conn?.close();continue}if(now-(m.lastPing??0)>=1000&&m.conn?.open){m.lastPing=now;try{m.conn.send({type:'ping'})}catch{}}}};
 P.broadcast=function(force=false){
 const n=this.net;if(n?.role!=='host'||!n.ready)return;
 const memberIds=[0,...n.members.map(m=>this.profiles.indexOf(m.profile))],disconnected=n.members.filter(m=>!m.connected).map(m=>this.profiles.indexOf(m.profile));
 for(const m of n.members){if(!m.connected||!m.conn?.open)continue;const id=this.profiles.indexOf(m.profile);if(id<0)continue;
 const battle=['battle','result'].includes(this.page)&&this.g;
 // The newest activation and log entry may still change. Replace those along with any appended suffix.
 const cursor=battle&&m.historyDelta?(m.historyGame===this.g&&!force?m.historyCursor:null)??{activations:0,timeline:0}:null;
 const f=this.flow,flow=f?copy(Object.fromEntries(['kind','before','order','values','stage','ready','result','index','total'].filter(k=>f[k]!==undefined).map(k=>[k,f[k]]))):null;
 if(this.testMode)n.stateBuilds=(n.stateBuilds??0)+1;
 const state={type:'state',id,page:this.page,profiles:copy(this.profiles),modes:[...this.modes],memberIds,disconnected,room:{rounds:this.room.rounds,hp:this.room.hp,chance:this.room.chance,powerEnabled:this.room.powerEnabled===true,deckId:this.room.deckId,deckName:this.deckName(),seed:''},busy:this.busy,actionSeq:this.actionSeq??0,game:battle?playerView(this.g,id,cursor):null,choice:battle?choiceView(this.pending.get(id)):null,flow:battle?flow:null};
 const serialized=JSON.stringify(state);if(force||serialized!==m.last){try{m.conn.send(state);m.last=serialized;m.historyGame=battle?this.g:null;m.historyCursor=cursor?{activations:Math.max(0,this.g.allActivations.length-1),timeline:Math.max(0,this.g.timeline.length-1)}:null;if(this.testMode)n.stateBytes=(n.stateBytes??0)+new TextEncoder().encode(serialized).length}catch{}}
 }
 };
 P.receiveState=function(msg){
 const n=this.net;if(n?.role!=='guest')return;if(msg.page==='error'){n.fail('ホスト側で対戦を続行できなくなりました');return}const first=n.id===0&&!n.received,oldPage=this.page,oldActionSeq=n.actionSeq,oldChoice=this.choice,oldFlow=this.flow,selectedIndex=oldChoice?.opts.indexOf(oldChoice.selected),oldCard=this.selected?.id;
 n.received=true;n.actionSeq=msg.actionSeq;n.id=msg.id;n.memberIds=msg.memberIds;const previous=n.disconnected??[];n.disconnected=msg.disconnected;const dropped=n.disconnected.find(id=>!previous.includes(id)),returned=previous.find(id=>!n.disconnected.includes(id));if(n.received&&!first&&(dropped!==undefined||returned!==undefined)){const id=dropped??returned;this.notice=(msg.profiles[id]?.humanName??'プレイヤー')+(dropped!==undefined?' が切断しました（CPU代行）':' が再接続しました');clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>{this.notice=null;this.render()},2200)}this.view=msg.id;this.modes=msg.modes;this.profiles=msg.profiles;this.room={...msg.room};this.busy=msg.busy;
 this.g=msg.game?hydrateView(msg.game,msg.id,this.g):null;this.choice=msg.choice&&this.g?hydrateChoice(msg.choice,this.g):null;this.pending.clear();if(this.choice){if(oldChoice?.token===this.choice.token){this.choice.selected=this.choice.opts[selectedIndex]??null;if(this.collapsedModal===oldChoice)this.collapsedModal=this.choice}else{this.collapsedModal=null;this.filter={type:'all',trigger:'all',effect:'all',sort:'complex'};this.ui.offsets.delete('choice');this.ui.offsets.delete('vote')}this.pending.set(msg.id,this.choice)}
 this.flow=msg.flow;if(oldFlow&&this.flow&&this.collapsedModal===oldFlow&&oldFlow.kind===this.flow.kind&&oldFlow.index===this.flow.index)this.collapsedModal=this.flow;
 this.selected=this.g?.p[msg.id].hand.find(c=>c.id===oldCard)??null;this.page=msg.page;this.winnerLarge=false;
 if(first||oldPage!==this.page){if(this.page==='room'){this.ui.clearAnimations();this.scene.cameras.main.resetFX()}this.endNativeText();this.aux=[];this.ui.offsets.clear();this.collapsedModal=null}
 if(this.drag){const current=this.g?.p[msg.id]?.hand.find(c=>c?.id===this.drag.c.id);if(oldActionSeq!==msg.actionSeq||!current||!this.canUse())this.ui.cancel();else this.drag.c=current}
 this.render();
 };
 P.send=function(msg){if(this.isGuest()&&this.net.conn?.open)this.net.conn.send(['play','end'].includes(msg.type)?{...msg,seq:this.net.actionSeq}:msg)};
 P.profileChanged=function(){if(this.isGuest())this.send({type:'profile',appearance:this.appearance(this.ownId()),power:normalizePower(this.profiles[this.ownId()]?.power)});this.renderState()};
 P.toggleMode=function(id){if(id!==this.ownId()||this.page!=='room')return;const mode=this.cpu(id)?'human':'cpu';if(this.isGuest())this.send({type:'profile',mode});else{this.modes[id]=mode;this.renderState()}};
 P.bindLanGame=function(g){
 if(this.net?.role!=='host')return;
 const emit=g.onVisual,activate=g.onActivation;
 g.onVisual=e=>{if(!this.gameCurrent(g))return;const kind=g.active?.progress?.at(-1)?.kind;if(kind==='line'||kind==='random'||kind==='settlement')emit({...e,remoteDeferred:true});else{emit(e);this.sendVisual(id=>visualView(e,id))}};
 g.onActivation=async info=>{this.checkGame(g);if(info)this.sendVisual(()=>({type:'activation',activation:publicActivation(info)}));return activate(info)};
 };
 P.sendVisual=function(project){if(this.net?.role!=='host')return;for(const m of this.net.members){if(!m.connected||!m.conn?.open)continue;const id=this.profiles.indexOf(m.profile),event=project(id);if(event)try{m.conn.send({type:'visual',event:copy(event)})}catch{}}};
 P.publishVisuals=function(events){if(!events.length)return;this.sendVisual(id=>{const projected=events.map(({remoteDeferred,fromPoint,view,...e})=>visualView(e,id)).filter(Boolean);return projected.length?{type:'batch',events:projected}:null})};
 P.animateRemote=function(e){
 if(!e||this.page!=='battle'||!this.g)return;
 if(e.type==='batch'){for(const event of e.events)this.animateRemote(event);return}
 const u=this.ui,at=id=>u.anchors.get('seat:'+id),ms=this.dur(650),back={kind:'event',event:0},jobs=[];
 if(e.type==='activation'){
 const a=e.activation,from=this.anchor(a.from,a.card?.id)??at(a.player),to=u.anchors.get('active');
 if(a.card&&from&&to)jobs.push(u.fly(a.card,from,to,this.dur(380),{reason:a.manual?'use':'reaction'}));
 else if(from)jobs.push(u.floatText('アビリティ発動',from,ms));
 }else if(e.type==='move'){const from=this.anchor(e.from,e.card?.id),to=this.anchor(e.to,e.card?.id);
 if(from&&(to||e.reason==='delete'))jobs.push(u.fly(e.card??back,from,to??from,ms,{fade:e.reason==='delete',back:!e.card||e.to?.zone==='deck',reason:e.reason}));
 if(e.reason==='copy'&&to)jobs.push(u.floatText('コピー',to,ms));
 }else if(e.type==='hp'&&e.presentation!=='exchange'){const where=at(e.player),delta=e.value-e.old;if(where){jobs.push(u.floatText((delta>0?'+':'')+delta,where,ms,delta>0?C.greenInk:C.redInk));if(delta<0&&at(e.actor))jobs.push(u.flashLine(at(e.actor),where,this.dur(400),C.red))}}
 else if(e.type==='exchange')jobs.push(u.exchangeNumbers(at(e.players[0]),at(e.players[1]),e.before,ms));
 else if(e.type==='modify'||e.type==='fusion'){const where=at(e.player);if(where)jobs.push(u.floatText(e.type==='fusion'?'融合':'カード改変',where,ms));}
 else if(e.type==='eliminate'&&at(e.player))jobs.push(u.floatText('脱落',at(e.player),ms,C.muted));
 else if(e.type==='ability'&&at(e.player))jobs.push(u.attachIcon(e.ability,at(e.player),ms));
 else if(e.type==='abilityLoss'&&at(e.player))jobs.push(u.floatText('アビリティ喪失',at(e.player),ms,C.muted));
 else if(e.type==='point'&&at(e.player))jobs.push(u.floatText('+'+e.count+'pt',at(e.player),ms,C.gold));
 else if(e.type==='ap'&&at(e.player))jobs.push(u.floatText(((e.count??1)>0?'+':'')+(e.count??1),at(e.player),ms,C.gold));
 else if(e.type==='notice')jobs.push(this.banner(e.text,650,null,C.muted));
 else if(e.type==='shuffle'){const from=this.anchor(e.from),to=this.anchor(e.to);if(from&&to)jobs.push(u.fly(back,from,to,ms,{back:true,reason:'shuffle'}))}
 Promise.all(jobs).catch(()=>{});
 };
}
