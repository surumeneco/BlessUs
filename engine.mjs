// Bless Us prototype — pure rules engine
function makeEngine(){
const T=['使用','捨てられた','被ダメージ','与ダメージ','自分回復','他者回復','自分ドロー','他者ドロー','自分捨札','他者捨札','ターン開始','ターン終了'];
const E=['対象ダメージ','他全員ダメージ','自己回復','体力交換','自己ドロー','全員ドロー','自己捨札','対象ランダム捨札','アクション権','手札に残る','前回効果','手札譲渡','墓地を山札へ','ランダム効果'];
const V=['コピー','削除','変更','追加'];
const A=['初期体力+1','初期手札+1','初期トリガー追加','初期効果追加','終了時+1点','追加カード効果+1','効果2回(5%)'];
const uniqueE=new Set([3,9,10,12]); // effects without quantities
const countE=new Set([0,1,2,4,5,6,7,8,11,13]);
const labelsE=['任意のプレイヤーにダメージ','他プレイヤー全員にダメージ','自分の体力を増やす','任意のプレイヤーと体力を交換','山札からドロー','全員がドロー','自分の手札を捨てる（任意）','対象のランダム手札を捨てる','アクション権獲得','発動後手札に残る','前回発動カードの効果を発動','手札を対象に渡す','墓地を山札に戻してシャッフル','ランダムな効果を発動'];
const describe=c=>c.kind==='event'?'イベント：'+V[c.event]:c.t.map(i=>T[i]).join(' / ')+' → '+c.e.map(({id,n})=>labelsE[id]+(countE.has(id)?' ×'+n:'')).join(' / ');
const copy=x=>JSON.parse(JSON.stringify(x));
class Game{
constructor({players=4,rounds=3,hp=10,seed=1,deck=null,reviveChance=.25}={},choose=async(p,prompt,opts)=>opts[0]){
if(!Number.isInteger(players)||players<2||players>6||!Number.isInteger(rounds)||rounds<1||!Number.isInteger(hp)||hp<1)throw Error('設定値が不正');
this.cfg={players,rounds,hp,seed,reviveChance};this.seed=Number(seed)>>>0;this.choose=choose;this.id=0;this.round=0;this.turn=0;this.turns=0;this.phase='ready';this.p=Array.from({length:players},(_,i)=>({id:i,hp,dead:false,score:0,hand:[],abilities:[],ap:0}));this.log=[];this.history=[];this.queue=[];this.fallen=[];this.deck=[];this.grave=[];this.used=new Set();this.events=new Set();
if(deck){if(deck.length<30||deck.length>40||V.some((_,i)=>!deck.some(c=>c.kind==='event'&&c.event===i)))throw Error('デッキは30〜40枚、各イベント1枚以上');this.deck=deck.map(c=>c.kind==='event'?this.event(c.event):this.action(c.t[0],c.e[0].id));}
else{for(let i=0;i<4;i++)for(let j=0;j<2;j++)this.deck.push(this.event(i));for(const [e,n] of [[0,8],[4,4],[2,4],[13,4]])for(let j=0;j<n;j++)this.deck.push(this.action(0,e));for(let j=0;j<2;j++)this.deck.push(this.action(this.int(T.length),this.int(E.length)));}
}
rnd(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296}
int(n){return Math.floor(this.rnd()*n)}
shuffle(a){for(let i=a.length-1;i>0;i--){let j=this.int(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
sample(a,n=3){return this.shuffle([...a]).slice(0,n)}
action(t,e){return {id:++this.id,kind:'action',t:[t],e:[{id:e,n:1}]}}
event(event){return {id:++this.id,kind:'event',event}}
say(s){this.log.push('R'+this.round+' T'+this.turns+' '+s)}
order(start=this.turn){return this.p.map((_,i)=>this.p[(start+i)%this.p.length])}
owner(c){return this.p.find(p=>p.hand.includes(c))}
async pick(p,prompt,opts){if(!opts.length)return null;const o=await this.choose(p.id,prompt,opts);if(!opts.includes(o))throw Error('無効な選択: '+prompt);return o}
opts(ids,labels){return ids.map(v=>({v,label:labels[v]}))}
cards(p,predicate=()=>true){return p.hand.filter(predicate).map(v=>({v,label:'#'+v.id+' '+describe(v)}))}
async pickCard(p,prompt,predicate=()=>true,optional=false){let o=this.cards(p,predicate);if(optional)o.unshift({v:null,label:'選択しない'});return (await this.pick(p,prompt,o))?.v??null}
async ability(p){const o=await this.pick(p,'アビリティを獲得',this.opts(this.sample(A.map((_,i)=>i)),A));p.abilities.push(o.v);this.say('P'+(p.id+1)+' 獲得 '+o.label)}
addEffect(c,id,n=1){const x=c.e.find(e=>e.id===id);if(x){if(!uniqueE.has(id))x.n+=n}else c.e.push({id,n})}
async modify(p,c,mode='add',kind=null,random=false,all=false){if(!c||c.kind!=='action')return false;
if(!kind)kind=(await this.pick(p,'改変対象',[{v:'t',label:'トリガー'},{v:'e',label:'効果'}])).v;
const arr=kind==='t'?c.t:c.e;
let old=null;if(mode==='change'){old=(await this.pick(p,'変更する項目',arr.map((v,i)=>({v:i,label:kind==='t'?T[v]:labelsE[v.id]+' ×'+v.n})))).v}
const pool=(kind==='t'?T:E).map((_,i)=>i).filter(i=>kind==='t'?!c.t.includes(i):!uniqueE.has(i)||!c.e.some(x=>x.id===i));
if(!pool.length){this.say('改変候補なし');return false}
const id=random?pool[this.int(pool.length)]:(await this.pick(p,'追加・変更先',this.opts(all?pool:this.sample(pool),kind==='t'?T:labelsE))).v;
if(mode==='change'){
if(kind==='t'){const prev=c.t[old];c.t[old]=id;if(this.used.delete(c.id+':'+prev))this.used.add(c.id+':'+id)}
else{const prev=c.e[old];c.e.splice(old,1);const existing=c.e.find(e=>e.id===id);if(existing&&!uniqueE.has(id))existing.n+=prev.n;else if(!existing)c.e.splice(old,0,{id,n:uniqueE.has(id)?1:prev.n})}
}else if(kind==='t')c.t.push(id);else this.addEffect(c,id);
this.say('P'+(p.id+1)+' 改変 #'+c.id+' '+describe(c));return true}
group(origin){return {origin,entries:[],seq:0}}
emit(g,type,subject,actor=null,card=null){
const matches=(p,c,t)=>{switch(t){case 0:return type==='use'&&c===card;case 1:return type==='discard'&&c===card;case 2:return type==='damage'&&p===subject;case 3:return type==='damage'&&p===actor;case 4:return type==='heal'&&p===subject;case 5:return type==='heal'&&p!==subject;case 6:return type==='draw'&&p===subject;case 7:return type==='draw'&&p!==subject;case 8:return type==='discard'&&p===subject;case 9:return type==='discard'&&p!==subject;case 10:return type==='start'&&p===subject;case 11:return type==='end'&&p===subject;default:return false}};
for(const p of this.order(g.origin)){for(let i=0;i<p.hand.length;i++){const c=p.hand[i];if(c.kind!=='action')continue;
for(const t of c.t){const k=c.id+':'+t;if(!this.used.has(k)&&matches(p,c,t)){this.used.add(k);g.entries.push({c,t,p:p.id,pos:i,seq:g.seq++})}}}}
}
enqueue(g){if(!g.entries.length)return;
const ordered=this.order(g.origin);const lists=ordered.map(p=>g.entries.filter(x=>x.p===p.id).sort((a,b)=>a.pos-b.pos||a.seq-b.seq));
const cards=lists.map(l=>[...new Set(l.map(x=>x.c))]);const entries=[];for(let rank=0;rank<Math.max(...cards.map(x=>x.length));rank++)for(let i=0;i<cards.length;i++)if(cards[i][rank])entries.push(...lists[i].filter(x=>x.c===cards[i][rank]));
this.queue.push(entries)}
async drain(){while(this.queue.length){const entries=this.queue.shift();for(const entry of entries){if(this.owner(entry.c))await this.fire(entry.c);else this.say('#'+entry.c.id+' 発動失敗（手札外）')}}}
take(){if(!this.deck.length&&this.grave.length){this.deck=this.shuffle(this.grave.splice(0));this.say('墓地を山札へ')}return this.deck.pop()}
draw(p,n,g=null){for(let i=0;i<n;i++){const c=this.take();if(!c){this.say('P'+(p.id+1)+' ドロー失敗');continue}p.hand.push(c);this.say('P'+(p.id+1)+' ドロー #'+c.id);if(g)this.emit(g,'draw',p)}}
discard(p,c,g){if(!p.hand.includes(c))return;this.emit(g,'discard',p,null,c);p.hand.splice(p.hand.indexOf(c),1);this.grave.push(c);this.say('P'+(p.id+1)+' 捨札 #'+c.id)}
hpChange(p,delta,actor,g){if(p.dead||delta===0)return;const old=p.hp;p.hp=Math.max(0,p.hp+delta);const d=p.hp-old;if(!d)return;this.say('P'+(p.id+1)+' HP '+old+'→'+p.hp);if(d<0)this.emit(g,'damage',p,actor);else this.emit(g,'heal',p,actor);if(p.hp===0){p.dead=true;this.fallen.push(p);this.say('P'+(p.id+1)+' 脱落')}}
alive(){return this.p.filter(p=>!p.dead)}
async target(p){return (await this.pick(p,'任意のプレイヤー（全効果共通）',this.alive().map(v=>({v,label:'P'+(v.id+1)+' HP '+v.hp}))))?.v??null}
needsTarget(e,prev){return e.some(x=>[0,3,7,11,13].includes(x.id)||(x.id===10&&prev>=0&&this.needsTarget(this.history[prev].e,prev-1)))}
async fire(c){const p=this.owner(c);if(!p)return;
if(c.kind==='event'&&this.events.has(c.id))return;
const g=this.group(p.id),prev=this.history.length-1,record={id:c.id,e:c.kind==='event'?[]:copy(c.e)};this.history.push(record);this.say('P'+(p.id+1)+' 発動 #'+c.id+' '+describe(c));
let stay=false;
if(c.kind==='event'){this.events.add(c.id);await this.eventEffect(p,c)}
else{const ctx={target:null,selected:false,stay:false};await this.effects(p,record.e,g,ctx,prev);stay=ctx.stay}
const owner=this.owner(c);if(owner&&!stay){owner.hand.splice(owner.hand.indexOf(c),1);this.grave.push(c)}
this.enqueue(g)}
async eventEffect(p,c){const other=x=>x!==c;let x;
switch(c.event){case 0:x=await this.pickCard(p,'コピーする手札',other);if(x){const clone={...copy(x),id:++this.id};p.hand.push(clone);if(clone.kind==='event')this.events.add(clone.id);this.say('コピー #'+x.id+' → #'+clone.id)}break;
case 1:x=await this.pickCard(p,'削除する手札',other);if(x){p.hand.splice(p.hand.indexOf(x),1);this.say('削除 #'+x.id)}break;
case 2:case 3:x=await this.pickCard(p,'改変する手札',x=>x.kind==='action');if(x)await this.modify(p,x,c.event===2?'change':'add');break}}
async effects(p,e,g,ctx,prev){if(this.needsTarget(e,prev)&&!ctx.selected){ctx.target=await this.target(p);ctx.selected=true}
for(const line of e){let repeat=1;for(const a of p.abilities)if(a===6&&this.rnd()<.05){repeat++;this.say('効果追加発動(5%)')}
for(let r=0;r<repeat;r++)for(let i=0;i<line.n;i++)await this.effect(p,line.id,g,ctx,prev)}}
async effect(p,id,g,ctx,prev){let q=ctx.target;switch(id){
case 0:if(q)this.hpChange(q,-1,p,g);break;
case 1:for(const x of this.order())if(x!==p)this.hpChange(x,-1,p,g);break;
case 2:this.hpChange(p,1,p,g);break;
case 3:if(q&&!p.dead&&!q.dead&&q!==p){const a=p.hp,b=q.hp;this.hpChange(p,b-a,p,g);this.hpChange(q,a-b,p,g)}break;
case 4:this.draw(p,1,g);break;
case 5:for(const x of this.order())this.draw(x,1,g);break;
case 6:{const x=await this.pickCard(p,'捨てる手札（任意）',()=>true,true);if(x)this.discard(p,x,g);break}
case 7:if(q&&q.hand.length)this.discard(q,q.hand[this.int(q.hand.length)],g);break;
case 8:p.ap++;break;
case 9:ctx.stay=true;break;
case 10:if(prev>=0)await this.effects(p,this.history[prev].e,g,ctx,prev-1);break;
case 11:if(q){const x=await this.pickCard(p,'渡す手札');if(x&&q!==p){p.hand.splice(p.hand.indexOf(x),1);q.hand.push(x);this.say('手札譲渡 #'+x.id)}}break;
case 12:this.deck=this.shuffle(this.deck.concat(this.grave.splice(0)));break;
case 13:{const random=this.int(E.length-1);if([0,3,7,11].includes(random)&&!ctx.selected){ctx.target=await this.target(p);ctx.selected=true}await this.effect(p,random,g,ctx,prev);break}
}}
async startRound(){if(!['ready','between'].includes(this.phase))throw Error('ラウンド開始不可');this.round++;this.turn=(this.round-1)%this.p.length;this.turns=0;this.fallen=[];this.history=[];this.used.clear();this.events.clear();this.queue=[];this.phase='setup';
for(const p of this.order()){await this.ability(p);p.dead=false;p.ap=0;p.hp=this.cfg.hp+p.abilities.filter(a=>a===0).length}
this.shuffle(this.deck);
for(const p of this.order())this.draw(p,5+p.abilities.filter(a=>a===1).length);
for(const p of this.order())for(const a of p.abilities)if(a===2||a===3){const c=await this.pickCard(p,'開始時アビリティ '+A[a],x=>x.kind==='action');if(c)await this.modify(p,c,'add',a===2?'t':'e',true)}
await this.startTurn()}
async startTurn(){while(true){this.used.clear();this.events.clear();this.turns++;const p=this.p[this.turn];this.say('P'+(p.id+1)+' ターン開始');if(p.dead){this.say('P'+(p.id+1)+' 脱落者ターン');if(this.rnd()<this.cfg.reviveChance)await this.ability(p);this.turn=(this.turn+1)%this.p.length;continue}
const g=this.group(p.id);this.emit(g,'start',p);this.draw(p,1,g);p.ap++;this.enqueue(g);await this.drain();if(this.alive().length<=1){await this.finishRound();return}
if(p.dead||p.ap<=0){await this.closeTurn();if(this.alive().length<=1){await this.finishRound();return}this.turn=(this.turn+1)%this.p.length;continue}
this.phase='play';return}}
playable(c){return c.kind==='event'?!this.events.has(c.id):c.t.includes(0)&&!this.used.has(c.id+':0')}
async play(id){if(this.phase!=='play')throw Error('操作不可');const p=this.p[this.turn];const c=p.hand.find(x=>x.id===id);if(!c||!this.playable(c)||p.dead||p.ap<1)throw Error('使用不可');p.ap--;if(c.kind==='event')await this.fire(c);else{const g=this.group(p.id);this.emit(g,'use',p,null,c);this.enqueue(g)}await this.drain();if(this.alive().length<=1)await this.finishRound();else if(p.dead||p.ap===0)await this.endTurn()}
async closeTurn(){const p=this.p[this.turn];const g=this.group(p.id);this.emit(g,'end',p);this.enqueue(g);await this.drain();p.ap=0}
async endTurn(){if(this.phase!=='play')throw Error('ターン終了不可');await this.closeTurn();if(this.alive().length<=1){await this.finishRound();return}this.turn=(this.turn+1)%this.p.length;await this.startTurn()}
async finishRound(){this.phase='upgrade';const rank=[...this.fallen,...this.alive()];rank.forEach((p,i)=>{p.score+=i;for(const a of p.abilities)if(a===4)p.score++;this.say('P'+(p.id+1)+' 累計 '+p.score+'点')});
for(const p of this.order()){const ac=p.hand.filter(x=>x.kind==='action');let opts=[{v:0,label:'ランダムカード追加'}];if(ac.length)opts.push({v:1,label:'手札を改変'});if(ac.length>=2)opts.push({v:2,label:'手札を融合'});
const choice=(await this.pick(p,'ラウンド終了：デッキ改変',opts)).v;
if(choice===0){const c=this.rnd()<.5?this.action(this.int(T.length),this.int(E.length)):this.event(this.int(V.length));if(c.kind==='action')for(const a of p.abilities)if(a===5){const pool=E.map((_,i)=>i).filter(i=>!uniqueE.has(i)||!c.e.some(e=>e.id===i));this.addEffect(c,pool[this.int(pool.length)])}this.deck.push(c);this.say('追加 #'+c.id+' '+describe(c))}
else if(choice===1){const c=await this.pickCard(p,'改変する手札',c=>c.kind==='action');await this.modify(p,c,'add',null,false,true)}
else {const a=await this.pickCard(p,'融合する1枚目',c=>c.kind==='action');const b=await this.pickCard(p,'融合する2枚目',c=>c.kind==='action'&&c!==a);a.t=[...new Set([...a.t,...b.t])];for(const e of b.e)this.addEffect(a,e.id,e.n);p.hand.splice(p.hand.indexOf(b),1);this.say('融合 #'+a.id+' + #'+b.id)}}
this.deck.push(...this.grave.splice(0));for(const p of this.p)this.deck.push(...p.hand.splice(0));this.phase=this.round>=this.cfg.rounds?'finished':'between';if(this.phase==='finished'){const max=Math.max(...this.p.map(p=>p.score));this.say('勝者 '+this.p.filter(p=>p.score===max).map(p=>'P'+(p.id+1)).join(' / '))}}
}
return {Game,T,E,V,A,labelsE,describe}
}
export const {Game,T,E,V,A,labelsE,describe}=makeEngine();
