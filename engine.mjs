// Bless Us prototype — pure rules engine
import {PT,PE,normalizePower,powerMatches,powerEffectLabel} from './power.mjs?v=random-effect-quantity-1';
function makeEngine(){
const T=['使用した時','捨てられた時','自分がダメージを受けた時','自分がダメージを与えた時','自分が体力を増やした時','他プレイヤーが体力を増やした時','自分がドローした時','他プレイヤーがドローした時','自分が手札を捨てた時','他プレイヤーが手札を捨てた時','自分のターン開始時','自分のターン終了時','他プレイヤーがアクションを獲得した時（通常獲得を除く）','手札に加わった時','自分のアビリティが発動した時','他プレイヤーのアビリティが発動した時','他プレイヤーがカードをコピーした時'];
const E=['対象ダメージ','他全員ダメージ','自己回復','体力交換','自己ドロー','全員ドロー','自己捨札','対象ランダム捨札','アクション権','手札に残る','前回効果','手札譲渡','墓地を山札へ','ランダム効果','自己ダメージ','対象回復','手札取得','全員捨札','手札交換','墓地回収','ターン順反転','被ダメージ反撃'];
const V=['コピー','削除','変更','追加'];
// Presentation order is independent of stable numeric identifiers used in saves, rules and networking.
const triggerOrder=Object.freeze([0,1,13,10,11,2,3,4,5,6,7,8,9,12,16,14,15]);
const effectOrder=Object.freeze([0,1,14,21,2,15,3,4,5,19,6,7,17,11,16,18,12,8,20,9,10,13]);
const presets=Object.freeze([{id:'default',name:'ベーシック',events:[[0,4],[1,1],[2,5],[3,10]],actions:[[0,0,6],[0,1,3],[0,2,4],[0,4,4],[0,10,2],[0,13,2],[0,9,4],[10,8,2],[11,21,1],[13,14,2]]}]);
const presetCards=(id=presets[0].id)=>{
 const p=presets.find(x=>x.id===id);if(!p)throw Error('不明なプリセット');
 return [...p.events.flatMap(([event,n])=>Array.from({length:n},()=>({kind:'event',event}))),...p.actions.flatMap(([t,e,n])=>Array.from({length:n},()=>({kind:'action',t:[t],e:[{id:e,n:1}]})))];
};
const A=['初期体力+1','初期手札+1','初期トリガー追加','初期効果追加','終了時+1点','追加カード効果+1','効果2回(25%)','ターン終了時：他全員に1ダメージ（ラウンド限定）'];
const uniqueE=new Set([3,9,10,12,18,20,21]); // effects without quantities
const countE=new Set([0,1,2,4,5,6,7,8,11,13,14,15,16,17,19]);
const labelsE=['任意のプレイヤーにダメージ','他プレイヤー全員にダメージ','自分の体力を増やす','任意のプレイヤーと体力を交換','山札からドロー','全員がドロー','自分の手札を捨てる（任意）','対象のランダム手札を捨てる','アクション権獲得','発動後手札に残る','前回発動カードの効果を発動','手札を対象に渡す','墓地を山札に戻してシャッフル','ランダムな効果を発動','自分にダメージ','任意のプレイヤーを回復','ランダムに手札を貰う','全員が手札を捨てる','手札を交換','墓地から手札に加える','ターン進行順を反転','このターンに受けた分のダメージを与える'];
const describe=c=>c.kind==='power'?PT[c.t[0]][0]+' → '+c.e.map(({id,n})=>powerEffectLabel(id,n)).join(' / '):c.kind==='event'?'イベント：'+V[c.event]:c.t.map(i=>T[i]).join(' / ')+' → '+c.e.map(({id,n})=>labelsE[id]+(countE.has(id)?' ×'+n:'')).join(' / ');
const effectLabel=(id,n=1)=>[`${n}ダメージを任意のプレイヤーに与える`,`${n}ダメージを他のプレイヤー全員に与える`,`${n}点分、自分の体力を増やす`,'任意のプレイヤーと体力を交換する',`${n}枚のカードを山札からドローする`,`${n}枚ずつ、全プレイヤーが山札からドローする`,`${n}枚まで、自分の手札からカードを捨てる`,`${n}枚のカードを任意のプレイヤーの手札からランダムに捨てる`,`${n}つのアクション権を獲得する`,'発動後に墓地へ行かず、手札に残る','前回発動したカードの効果を発動する',`${n}枚のカードを自分の手札から任意のプレイヤーに渡す`,'墓地のカードをすべて山札に戻し、シャッフルする',`${n}回ランダムな効果を発動する`,`${n}ダメージを自分に与える`,`${n}点分、任意のプレイヤーの体力を増やす`,`${n}枚のカードを任意のプレイヤーの手札からランダムに貰う`,`${n}枚ずつ、全プレイヤーが自身の手札からカードを選んで捨てる`,'任意のプレイヤーと手札を全て交換する',`${n}枚のカードを墓地から選んで自分の手札に加える`,'ターン進行順を逆にする','このターン中に自分が受けたダメージの合計と同じダメージを任意のプレイヤーに与える'][id];
const cardEffectLabel=(id,n=1)=>[`${n}ダメージ与える`,`${n}ダメージ全体攻撃`,`${n}回復`,'体力を交換',`${n}枚ドロー`,`${n}枚全員ドロー`,`${n}枚まで捨てる`,`${n}枚ランダムに捨てさせる`,`${n}アクション獲得`,'手札に残る','前回発動したカード効果を発動',`${n}枚渡す`,'墓地を山札に戻す',`${n}回ランダムな効果発動`,`${n}ダメージを自分に与える`,`${n}回復させる`,`${n}枚ランダムに貰う`,`${n}枚ずつ全員が捨てる`,'手札を全て交換する',`${n}枚を墓地から手札に加える`,'ターン進行順を反転する','このターンに受けた分のダメージを与える'][id];
const formatCard=c=>c.kind==='power'?'[パワー]\n[トリガー]\n'+PT[c.t[0]][0]+'\n[効果]\n'+c.e.map(({id,n})=>'・'+powerEffectLabel(id,n)).join('\n'):c.kind==='event'?'[イベント]\n'+V[c.event]:'[トリガー]\n'+c.t.map(i=>'・'+T[i]).join('\n')+'\n[効果]\n'+c.e.map(({id,n})=>'・'+cardEffectLabel(id,n)).join('\n');
const copy=x=>JSON.parse(JSON.stringify(x));
class Game{
constructor({players=4,rounds=3,hp=10,seed=1,deck=null,reviveChance=.25,humanPlayers=[],powerEnabled=false,powers=[]}={},choose=async(p,prompt,opts)=>opts[0]){
if(!Number.isInteger(players)||players<2||players>6||!Number.isInteger(rounds)||rounds<1||!Number.isInteger(hp)||hp<1)throw Error('設定値が不正');
this.cfg={players,rounds,hp,seed,reviveChance,powerEnabled:powerEnabled===true};this.seed=Number(seed)>>>0;this.choose=choose;this.id=0;this.round=0;this.turn=0;this.turns=0;this.direction=1;this.phase='ready';this.p=Array.from({length:players},(_,i)=>({id:i,hp,dead:false,score:0,hand:[],abilities:[],ap:0,damageTaken:0}));for(const p of this.p){const power=normalizePower(powers?.[p.id]);p.power=power?{...power,id:-p.id-1}:null;p.roundPower=0}this.seats=this.p.map(p=>p.id);this.humanPlayers=new Set(humanPlayers);this.log=[];this.timeline=[];this.activations=[];this.allActivations=[];this.activationSeq=0;this.resolvingEntries=[];this.pendingGroups=new Set();this.votingResults=[];this.onRoundResult=null;this.onGenerated=null;this.onVotes=null;for(const p of this.p){p.roundScores=[];p.voteScore=0;p.lastRank=0}this.history=[];this.queue=[];this.fallen=[];this.deck=[];this.grave=[];this.used=new Set();this.events=new Set();this.active=null;this.lastActivation=null;this.onActivation=null;this.onEffect=null;
deck??=presetCards();if(deck){if(deck.length<40||deck.length>60||V.some((_,i)=>!deck.some(c=>c.kind==='event'&&c.event===i)))throw Error('デッキは40〜60枚、各イベント1枚以上');this.deck=deck.map(c=>c.kind==='event'?this.event(c.event):this.action(c.t[0],c.e[0].id));}
}
rnd(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296}
int(n){return Math.floor(this.rnd()*n)}
shuffle(a){for(let i=a.length-1;i>0;i--){let j=this.int(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
sample(a,n=3){return this.shuffle([...a]).slice(0,n)}
action(t,e){return {id:++this.id,kind:'action',t:[t],e:[{id:e,n:1}],changes:{}}}
event(event){return {id:++this.id,kind:'event',event,changes:{}}}
say(s){this.log.push('R'+this.round+' T'+this.turns+' '+s);let publicText=s.replace(/(ドロー|手札譲渡|コピー|削除|改変|融合|変更|強化|捨てたカード) #.*$/u,'$1');this.timeline.push({round:this.round,turn:this.turns,text:publicText,activation:this.active?.seq??null})}
order(start=this.turn){const at=this.seats.indexOf(start),n=this.seats.length;return this.seats.map((_,i)=>this.p[this.seats[(Math.max(at,0)+i*this.direction+n)%n]])}
nextTurn(){this.turn=this.order()[1].id}
recordChange(c,id){c.changes??={};c.changes[id]=(c.changes[id]??0)+1}
pendingCards(){return [...this.resolvingEntries,...this.queue.flat(),...[...this.pendingGroups].flatMap(g=>g.entries)].map(x=>x.c)}
finalCards(){return [...this.deck,...this.grave,...this.p.flatMap(p=>p.hand)]}
standings(){return [...this.p].sort((a,b)=>b.score-a.score||b.lastRank-a.lastRank)}
owner(c){return this.p.find(p=>p.hand.includes(c))}
location(c){const p=this.owner(c);return p?{zone:'hand',player:p.id}:this.grave.includes(c)?{zone:'grave'}:this.deck.includes(c)?{zone:'deck'}:{zone:'outside'}}
observe(event){this.onVisual?.(copy(event))}
move(c,from,to,reason,extra={}){this.observe({type:'move',card:copy(c),from,to,reason,...extra})}
async pick(p,prompt,opts,context={}){if(!opts.length)return null;const o=await this.choose(p.id,prompt,opts,context);if(!opts.includes(o))throw Error('無効な選択: '+prompt);return o}
opts(ids,labels){return ids.map(v=>({v,label:labels[v]}))}
cards(p,predicate=()=>true){return p.hand.filter(predicate).map(v=>({v,label:'#'+v.id+' '+describe(v)}))}
async pickCard(p,prompt,predicate=()=>true,optional=false,context={}){let o=this.cards(p,predicate);if(optional)o.unshift({v:null,label:'選択しない'});return (await this.pick(p,prompt,o,{kind:'card',...context}))?.v??null}
async ability(p,options=this.opts(this.sample(A.map((_,i)=>i)),A)){const o=await this.pick(p,'アビリティを獲得',options,{kind:'ability'});p.abilities.push(o.v);this.say('P'+(p.id+1)+' がアビリティを獲得');this.observe({type:'ability',player:p.id,ability:o.v})}
addEffect(c,id,n=1){const x=c.e.find(e=>e.id===id);if(x){if(!uniqueE.has(id))x.n+=n}else c.e.push({id,n})}
modulePool(c,kind){return (kind==='t'?T:E).map((_,i)=>i).filter(i=>kind==='t'?!c.t.includes(i):!uniqueE.has(i)||!c.e.some(x=>x.id===i))}
modificationKinds(c){return c?.kind==='action'?['t','e'].filter(kind=>this.modulePool(c,kind).length):[]}
modificationOptions(cards,kind=null){return ['t','e'].filter(k=>(!kind||k===kind)&&cards.some(c=>this.modificationKinds(c).includes(k)))}
async pickModifiableCard(p,mode,kind=null){const cards=p.hand.filter(c=>this.modificationOptions([c],kind).length);return this.pickCard(p,'改変する手札',c=>cards.includes(c),false,{mode,modules:this.modificationOptions(cards,kind),...(kind?{module:kind}:{})})}
async modify(p,c,mode='add',kind=null,random=false,all=false,g=null){if(!c||c.kind!=='action')return false;
const kinds=this.modificationKinds(c).filter(k=>!kind||k===kind);
if(!kinds.length){this.say('改変候補なし');return false}
if(!kind)kind=(await this.pick(p,'改変対象',kinds.map(v=>({v,label:v==='t'?'トリガー':'効果'})),{kind:'moduleKind',mode,card:copy(c)})).v;
const before=copy(c);const arr=kind==='t'?c.t:c.e;
let old=null;if(mode==='change'){old=(await this.pick(p,'変更する項目',arr.map((v,i)=>({v:i,label:kind==='t'?T[v]:effectLabel(v.id,v.n)})),{kind:'oldModule',module:kind,mode,card:copy(c)})).v}
const pool=this.modulePool(c,kind);
if(!pool.length){this.say('改変候補なし');return false}
const id=random?pool[this.int(pool.length)]:(await this.pick(p,'追加・変更先',this.opts(all?pool:this.sample(pool),kind==='t'?T:E.map((_,i)=>effectLabel(i))),{kind:'newModule',module:kind,mode,card:copy(c)})).v;
if(mode==='change'){
if(kind==='t'){const prev=c.t[old];c.t[old]=id;if(this.used.delete(c.id+':'+prev))this.used.add(c.id+':'+id)}
else{const prev=c.e[old];c.e.splice(old,1);const existing=c.e.find(e=>e.id===id);if(existing&&!uniqueE.has(id))existing.n+=prev.n;else if(!existing)c.e.splice(old,0,{id,n:uniqueE.has(id)?1:prev.n})}
}else if(kind==='t')c.t.push(id);else this.addEffect(c,id);
this.recordChange(c,p.id);this.say('P'+(p.id+1)+' がカードを'+(mode==='change'?'変更':'強化')+' #'+c.id);this.observe({type:'modify',player:p.id,card:copy(c),before,module:kind,mode,added:id,removed:mode==='change'?(kind==='t'?before.t[old]:before.e[old].id):null});if(g)this.emit(g,mode+(kind==='t'?'Trigger':'Effect'),p);return true}
group(origin){return {origin,entries:[],seq:0,cause:this.active?.seq??null}}
emit(g,type,subject,actor=null,card=null){
const matches=(p,c,t)=>{switch(t){case 0:return type==='use'&&c===card;case 1:return type==='discard'&&c===card;case 2:return type==='damage'&&p===subject;case 3:return type==='damage'&&p===actor;case 4:return type==='heal'&&p===subject;case 5:return type==='heal'&&p!==subject;case 6:return type==='draw'&&p===subject;case 7:return type==='draw'&&p!==subject;case 8:return type==='discard'&&p===subject;case 9:return type==='discard'&&p!==subject;case 10:return type==='start'&&p===subject;case 11:return type==='end'&&p===subject;case 12:return type==='ap'&&p!==subject;case 13:return type==='hand'&&c===card;case 14:return type==='ability'&&p===subject;case 15:return type==='ability'&&p!==subject;case 16:return type==='copy'&&p!==subject;default:return false}};
for(const p of this.order(g.origin)){for(let i=0;i<p.hand.length;i++){const c=p.hand[i];if(c.kind!=='action')continue;
for(const t of c.t){const k=c.id+':'+t;if(!this.used.has(k)&&matches(p,c,t)){const entry={c,t,p:p.id,pos:i,seq:g.seq++,order:this.order(g.origin).map(x=>x.id)};if(g.lineEvents)g.lineEvents.push(entry);else this.registerReaction(g,entry)}}}
const c=p.power;if(this.cfg.powerEnabled&&c&&powerMatches(p,c.t[0],type,subject,actor)&&!this.used.has(c.id+':'+c.t[0])){
const entry={c,t:c.t[0],p:p.id,pos:Number.MAX_SAFE_INTEGER,seq:g.seq++,order:this.order(g.origin).map(x=>x.id)};
if(g.lineEvents)g.lineEvents.push(entry);else this.registerReaction(g,entry)}
}
}
registerReaction(g,entry){const k=entry.c.id+':'+entry.t;if(this.used.has(k))return;this.used.add(k);g.entries.push(entry);this.pendingGroups.add(g)}
flushLine(g){for(const entry of g.lineEvents??[])this.registerReaction(g,entry);if(g.lineEvents)g.lineEvents.length=0}
enqueue(g){this.flushLine(g);this.pendingGroups.delete(g);if(!g.entries.length)return;
const ordered=g.entries[0].order??this.order(g.origin).map(p=>p.id);const lists=ordered.map(id=>g.entries.filter(x=>x.p===id).sort((a,b)=>a.pos-b.pos||a.seq-b.seq));
const cards=lists.map(l=>[...new Set(l.map(x=>x.c))]);const entries=[];for(let rank=0;rank<Math.max(...cards.map(x=>x.length));rank++)for(let i=0;i<cards.length;i++)if(cards[i][rank])entries.push(...lists[i].filter(x=>x.c===cards[i][rank]));
this.queue.push(entries.map(x=>({...x,cause:g.cause})))}
async drain(){while(this.queue.length){this.resolvingEntries=this.queue.shift();while(this.resolvingEntries.length){const entry=this.resolvingEntries.shift();if(entry.c.kind==='power'){const p=this.p[entry.p];if(!p.dead||entry.t===19)await this.firePower(p,entry.c,entry.cause);continue}if(this.owner(entry.c)||entry.t===1)await this.fire(entry.c,entry.t===1?this.p[entry.p]:null,entry.t,entry.cause);else {this.say('カード発動失敗（手札外）');this.timeline.at(-1).cause=entry.cause??null}}}}
take(){if(!this.deck.length&&this.grave.length){const cards=this.grave.splice(0);this.deck=this.shuffle(cards);this.observe({type:'shuffle',count:cards.length,from:{zone:'grave'},to:{zone:'deck'}});this.say('墓地を山札に戻してシャッフル')}return this.deck.pop()}
draw(p,n,g=null){let drawn=0;for(let i=0;i<n;i++){const c=this.take();if(!c){this.say('P'+(p.id+1)+' ドロー失敗');continue}p.hand.push(c);drawn++;this.move(c,{zone:'deck'},{zone:'hand',player:p.id},'draw');this.say('P'+(p.id+1)+' ドロー #'+c.id);if(g){this.emit(g,'draw',p);this.emit(g,'hand',p,null,c)}}return drawn}
handLost(p,g){if(g&&p.hand.length===0)this.emit(g,'empty',p)}
discard(p,c,g){if(!p.hand.includes(c))return;this.emit(g,'discard',p,null,c);p.hand.splice(p.hand.indexOf(c),1);this.handLost(p,g);this.grave.push(c);this.move(c,{zone:'hand',player:p.id},{zone:'grave'},'discard');this.say('P'+(p.id+1)+' 捨てたカード #'+c.id)}
hpChange(p,delta,actor,g,presentation=null){if(p.dead||delta===0)return;const old=p.hp;p.hp+=delta;const d=p.hp-old;if(!d)return;this.say('P'+(p.id+1)+' の体力：'+old+' → '+p.hp);this.observe({type:'hp',player:p.id,actor:actor?.id,old,value:p.hp,presentation});if(d<0){p.damageTaken=(p.damageTaken??0)-d;this.emit(g,'damage',p,actor)}else this.emit(g,'heal',p,actor);if(old>3&&p.hp<=3)this.emit(g,'lowHp',p,actor);}
settleEliminations(g=null){const fallen=[];for(const p of this.order())if(!p.dead&&p.hp<=0){p.hp=0;p.dead=true;p.ap=0;this.fallen.push(p);this.say('P'+(p.id+1)+' が脱落');this.observe({type:'eliminate',player:p.id});fallen.push(p)}if(g)for(const p of fallen)this.emit(g,'eliminate',p)}
alive(){return this.p.filter(p=>!p.dead)}
async target(p,label,effect,other=false){const target=(await this.pick(p,'任意のプレイヤーを選択：'+label,this.alive().filter(q=>!other||p!==q).map(v=>({v,label:'P'+(v.id+1)+' HP '+v.hp})),{kind:'player',effect}))?.v??null;if(target&&this.active){(this.active.targets??=[]).push(target.id);this.say('P'+(p.id+1)+' がP'+(target.id+1)+' を効果の対象に選択')}return target}
needsTarget(e,prev){return e.some(x=>[0,3,7,11,13,15,16,18,21].includes(x.id)||(x.id===10&&prev>=0&&this.needsTarget(this.history[prev].e,prev-1)))}
async activation(info,run){info.progress=null;info.randomResults=[];info.seq=++this.activationSeq;info.round=this.round;info.turn=this.turns;this.activations.push(info);this.allActivations.push(info);this.active=info;this.timeline.push({round:this.round,turn:this.turns,text:info.kind==='card'?'P'+(info.player+1)+' カード発動':info.kind==='power'?'P'+(info.player+1)+' パワー発動':'P'+(info.player+1)+' アビリティ発動',activation:info.seq,root:true});this.lastActivation=info;try{await this.onActivation?.(info);return await run()}finally{this.active=null;await this.onActivation?.(null)}}
async reportEffect(path){if(!this.active)return;this.active.progress=copy(path);(this.active.steps??=[]).push(copy(path));await this.onEffect?.(this.active)}
async fire(c,discardOwner=null,trigger=0,cause=null){const p=this.owner(c)??discardOwner;if(!p)return;
if(c.kind==='event'&&this.events.has(c.id))return;
const g=this.group(p.id),prev=this.history.length-1,record={id:c.id,e:c.kind==='event'?[]:copy(c.e)};const from=this.location(c);this.history.push(record);await this.activation({kind:'card',player:p.id,card:copy(c),trigger,label:describe(c),cause,from,manual:c.kind==='event'||trigger===0},async()=>{
g.cause=this.active.seq;this.log.push('R'+this.round+' T'+this.turns+' P'+(p.id+1)+' 発動 #'+c.id+' '+describe(c));
let stay=false;
if(c.kind==='event'){this.events.add(c.id);this.emit(g,'use',p,null,c);await this.reportEffect([{label:V[c.event],kind:'event'}]);await this.eventEffect(p,c,g)}
else{const ctx={stay:false};await this.effects(p,record.e,g,ctx,prev);stay=ctx.stay}
const owner=this.owner(c);if(stay&&!owner){const pile=this.grave.includes(c)?this.grave:this.deck.includes(c)?this.deck:null;if(pile){pile.splice(pile.indexOf(c),1);p.hand.push(c);this.emit(g,'hand',p,null,c)}}else if(!stay){if(owner){owner.hand.splice(owner.hand.indexOf(c),1);this.handLost(owner,g);this.grave.push(c)}else if(discardOwner&&this.deck.includes(c)){this.deck.splice(this.deck.indexOf(c),1);this.grave.push(c)}}const destination=this.location(c);this.move(c,{zone:'active',player:p.id},destination,'resolved',{stay});
this.enqueue(g)})}
async eventEffect(p,c,g=this.group(p.id)){const other=x=>x!==c;let x;
switch(c.event){case 0:x=await this.pickCard(p,'コピーする手札',other);if(x){const clone={...copy(x),id:++this.id};this.recordChange(clone,p.id);p.hand.push(clone);this.move(clone,{zone:'hand',player:p.id,cardId:x.id},{zone:'hand',player:p.id},'copy');if(clone.kind==='event')this.events.add(clone.id);this.say('コピー #'+x.id+' → #'+clone.id);this.emit(g,'hand',p,null,clone);this.emit(g,'copy',p,null,clone)}break;
case 1:x=await this.pickCard(p,'削除する手札',other);if(x){p.hand.splice(p.hand.indexOf(x),1);this.handLost(p,g);this.move(x,{zone:'hand',player:p.id},{zone:'outside'},'delete');this.say('削除 #'+x.id)}break;
case 2:case 3:x=await this.pickModifiableCard(p,c.event===2?'change':'add');if(x)await this.modify(p,x,c.event===2?'change':'add',null,false,false,g);break}}
async effects(p,e,g,ctx,prev,trail=[]){
for(const [index,line] of e.entries()){let repeat=1;for(const a of p.abilities)if(a===6&&this.rnd()<.25){repeat++;this.say('効果追加発動(25%)');this.emit(g,'ability',p)}
for(let r=0;r<repeat;r++){const lineCtx={target:null,selected:false,stay:false};const parent=g.lineEvents;/* A direct previous-card replay consists of its referenced rows, not a new enclosing row. */const replay=!ctx.power&&line.id===10&&!parent;g.lineEvents=replay?undefined:[];try{for(let i=0;i<line.n;i++){const path=[...trail,{kind:'line',id:line.id,index,total:e.length,unit:i+1,units:line.n,repeat:r+1,repeats:repeat,label:ctx.power?powerEffectLabel(line.id):effectLabel(line.id),...(ctx.power?{power:true}:{})}];await this.reportEffect(path);if(ctx.power)await this.powerEffect(p,line.id,g,lineCtx,ctx,path);else await this.effect(p,line.id,g,lineCtx,prev,path);if(i===line.n-1&&!replay){if(parent)parent.push(...g.lineEvents);else this.flushLine(g)}await this.onEffectApplied?.(this.active,path)}ctx.stay ||= lineCtx.stay}finally{g.lineEvents=parent}}}}
async effect(p,id,g,ctx,prev,path=[]){if([0,3,7,11,15,16,18,21].includes(id)&&!ctx.selected&&!ctx.target){ctx.target=await this.target(p,effectLabel(id),id);ctx.selected=true}let q=ctx.target;switch(id){
case 0:if(q)this.hpChange(q,-1,p,g);break;
case 1:for(const x of this.order())if(x!==p)this.hpChange(x,-1,p,g);break;
case 2:this.hpChange(p,1,p,g);break;
case 3:if(q&&!p.dead&&!q.dead&&q!==p){const a=p.hp,b=q.hp;this.hpChange(p,b-a,p,g,'exchange');this.hpChange(q,a-b,p,g,'exchange');this.observe({type:'exchange',players:[p.id,q.id],before:[a,b],after:[p.hp,q.hp]});this.say('P'+(p.id+1)+' とP'+(q.id+1)+' が体力を交換した')}break;
case 4:this.draw(p,1,g);break;
case 5:for(const x of this.order())this.draw(x,1,g);break;
case 6:{const x=await this.pickCard(p,'捨てる手札（任意）',()=>true,true);if(x)this.discard(p,x,g);break}
case 7:if(q&&q.hand.length)this.discard(q,q.hand[this.int(q.hand.length)],g);break;
case 8:p.ap++;this.observe({type:'ap',player:p.id,value:p.ap});this.emit(g,'ap',p);break;
case 9:ctx.stay=true;break;
case 10:if(prev>=0){const ref=this.history[prev];if(this.active)(this.active.references??=[]).push({path:copy(path),cardId:ref.id,e:copy(ref.e)});if(ref.e.length){/* Replay the entire referenced card, not a single effect or a card activation. */await this.effects(p,ref.e,g,ctx,prev-1,path);}else{this.say('前回のカードには効果がないため、発動しない');this.observe({type:'notice',text:'前回のカードには効果がありません'})}}else{this.say('前回の発動カードがないため、発動しない');this.observe({type:'notice',text:'前回の発動カードがありません'})}break;
case 11:if(q){const x=await this.pickCard(p,'渡す手札');if(x&&q!==p){p.hand.splice(p.hand.indexOf(x),1);this.handLost(p,g);q.hand.push(x);this.move(x,{zone:'hand',player:p.id},{zone:'hand',player:q.id},'transfer');this.say('P'+(p.id+1)+' からP'+(q.id+1)+' へカードを渡した');this.emit(g,'hand',q,null,x)}}break;
case 12:{const cards=this.grave.splice(0);this.deck=this.shuffle(this.deck.concat(cards));this.observe({type:'shuffle',count:cards.length,from:{zone:'grave'},to:{zone:'deck'}});break}
case 13:{const randomIndex=this.int(E.length-1),random=randomIndex>=13?randomIndex+1:randomIndex;const result={kind:'random',id:random,label:effectLabel(random)};this.say('ランダム効果 → '+result.label);if(this.active)this.active.randomResults.push(result);const next=[...path,result];await this.reportEffect(next);const randomCtx={target:null,selected:false,stay:false};await this.effect(p,random,g,randomCtx,prev,next);ctx.stay ||= randomCtx.stay;break}
case 14:this.hpChange(p,-1,p,g);break;
case 15:if(q)this.hpChange(q,1,p,g);break;
case 16:if(q&&q!==p&&q.hand.length){const c=q.hand[this.int(q.hand.length)];q.hand.splice(q.hand.indexOf(c),1);this.handLost(q,g);p.hand.push(c);this.move(c,{zone:'hand',player:q.id},{zone:'hand',player:p.id},'receive');this.emit(g,'hand',p,null,c);this.say('P'+(p.id+1)+' がP'+(q.id+1)+' からカードを貰った')}break;
case 17:for(const x of this.order()){const c=await this.pickCard(x,'捨てる手札');if(c)this.discard(x,c,g)}break;
case 18:if(q&&q!==p){const a=p.hand,b=q.hand;p.hand=b;q.hand=a;if(a.length&&!b.length)this.handLost(p,g);if(b.length&&!a.length)this.handLost(q,g);for(const [from,to,cards] of [[p,q,a],[q,p,b]])for(const c of cards){this.move(c,{zone:'hand',player:from.id},{zone:'hand',player:to.id},'exchangeHand');this.emit(g,'hand',to,null,c)}this.say('P'+(p.id+1)+' とP'+(q.id+1)+' が手札を交換した')}break;
case 19:{const c=(await this.pick(p,'墓地から手札に加えるカードを選んでください',this.grave.map(v=>({v,label:describe(v)})),{kind:'grave'}))?.v;if(c){this.grave.splice(this.grave.indexOf(c),1);p.hand.push(c);this.move(c,{zone:'grave'},{zone:'hand',player:p.id},'recover');this.emit(g,'hand',p,null,c);this.say('P'+(p.id+1)+' が墓地からカードを回収した')}break}
case 20:this.direction*=-1;this.say('ターン進行順を反転した');break;
case 21:if(q)this.hpChange(q,-(p.damageTaken??0),p,g);break;
}}
async firePower(p,c,cause=null){
 const g=this.group(p.id),ctx={power:true,unpaid:0,stay:false};
 await this.activation({kind:'power',player:p.id,card:copy(c),trigger:c.t[0],label:describe(c),cause,from:{zone:'power',player:p.id},manual:false},async()=>{
 g.cause=this.active.seq;await this.effects(p,c.e,g,ctx,-1);
 const damage=Math.floor(ctx.unpaid/2);
 if(damage&&!p.dead){const path=[{kind:'settlement',label:damage+'代替ダメージ'}];await this.reportEffect(path);
 this.hpChange(p,-damage,p,g,'powerSettlement');await this.onEffectApplied?.(this.active,path)}
 this.enqueue(g)
 })
}
async powerEffect(p,id,g,ctx,state,path){
 let success=true;
 const target=async(label,common)=>{if(!ctx.selected){ctx.target=await this.target(p,label,common,true);ctx.selected=true}return ctx.target};
 const common=PE[id][3];
 if(common!==null){if(id===2&&p.dead)success=false;else await this.effect(p,common,g,ctx,-1,path)}
 else switch(id){
 case 4:{const q=await target(powerEffectLabel(id),15);if(q)this.hpChange(q,1,p,g);else success=false;break}
 case 6:{const c=await this.pickCard(p,'捨てる手札');if(c)this.discard(p,c,g);else success=false;break}
 case 7:if(p.hand.length)this.discard(p,p.hand[this.int(p.hand.length)],g);else success=false;break;
 case 8:{const q=await target(powerEffectLabel(id),11);const c=q&&await this.pickCard(p,'渡す手札');if(c){p.hand.splice(p.hand.indexOf(c),1);this.handLost(p,g);q.hand.push(c);this.move(c,{zone:'hand',player:p.id},{zone:'hand',player:q.id},'transfer');this.emit(g,'hand',q,null,c);this.say('P'+(p.id+1)+' からP'+(q.id+1)+' へカードを渡した')}else success=false;break}
 case 9:{const q=await target(powerEffectLabel(id),4);success=!!q&&this.draw(q,1,g)===1;break}
 case 15:case 16:case 17:case 18:{const mode=id<17?'add':'change',kind=id===15||id===17?'t':'e';const c=await this.pickModifiableCard(p,mode,kind);if(c)await this.modify(p,c,mode,kind,false,false,g);break}
 case 20:if(p.ap>0){p.ap--;this.observe({type:'ap',player:p.id,value:p.ap,count:-1})}else success=false;break;
 case 21:{const r=this.int(PE.length-1),random=r>=21?r+1:r;const result={kind:'random',id:random,label:powerEffectLabel(random),power:true};this.say('ランダム効果 → '+result.label);this.active.randomResults.push(result);const next=[...path,result];await this.reportEffect(next);await this.powerEffect(p,random,g,{target:null,selected:false},state,next);break}
 case 22:{const o=await this.pick(p,'失うアビリティを選択',p.abilities.map((a,i)=>({v:i,label:A[a]})),{kind:'abilityLoss'});if(o){const [ability]=p.abilities.splice(o.v,1);this.observe({type:'abilityLoss',player:p.id,ability});this.say('P'+(p.id+1)+' がアビリティを失った')}else success=false;break}
 case 23:p.score++;p.roundPower++;this.observe({type:'point',player:p.id,count:1,value:p.score});this.say('P'+(p.id+1)+' 1ポイント獲得');break;
 }
 if(!success&&PE[id][1]<0)state.unpaid-=PE[id][1];
}
async startRound(){if(!['ready','between'].includes(this.phase))throw Error('ラウンド開始不可');this.round++;if(this.round===1)this.shuffle(this.seats);else this.seats.sort((a,b)=>this.p[a].score-this.p[b].score);this.turn=this.seats[0];this.direction=1;this.turns=0;this.fallen=[];this.history=[];this.activations=[];this.resolvingEntries=[];this.pendingGroups.clear();this.active=null;this.lastActivation=null;this.used.clear();this.events.clear();this.queue=[];this.phase='setup';
const ordered=this.order();await this.onRoundStart?.();const options=ordered.map(()=>this.opts(this.sample(A.map((_,i)=>i)),A));await Promise.all(ordered.map((p,i)=>this.ability(p,options[i])));await this.onAbilitiesChosen?.();for(const p of ordered){p.dead=false;p.ap=0;p.roundPower=0;p.hp=this.cfg.hp+p.abilities.filter(a=>a===0).length}
this.shuffle(this.deck);
for(const p of this.order())this.draw(p,5+p.abilities.filter(a=>a===1).length);await this.onRoundDealt?.();
await Promise.all(ordered.map(async p=>{for(const a of p.abilities)if(a===2||a===3){const c=await this.pickCard(p,a===2?'トリガーを追加するアクションカードを選択':'効果を追加するアクションカードを選択',x=>this.modificationKinds(x).includes(a===2?'t':'e'));if(c)await this.modify(p,c,'add',a===2?'t':'e',true)}}));
const start=this.group(this.turn);this.emit(start,'roundStart',null);this.enqueue(start);await this.drain();
await this.startTurn()}
async startTurn(){while(true){for(const x of this.p)x.damageTaken=0;this.turns++;const p=this.p[this.turn];this.say('P'+(p.id+1)+' ターン開始');await this.onTurnStart?.(p);if(p.dead){this.say('P'+(p.id+1)+' 脱落者ターン');const g=this.group(p.id);this.emit(g,'start',p);this.enqueue(g);await this.drain();if(this.rnd()<this.cfg.reviveChance)await this.ability(p);await this.closeTurn();if(this.alive().length<=1){await this.finishRound();return}this.nextTurn();continue}
const g=this.group(p.id);this.emit(g,'start',p);this.draw(p,1,g);p.ap++;this.enqueue(g);await this.drain();
if(p.dead||p.ap<=0){await this.closeTurn();if(this.alive().length<=1){await this.finishRound();return}this.nextTurn();continue}
this.phase='play';return}}
playable(c){return c.kind==='event'?!this.events.has(c.id):c.kind==='action'}
async play(id){if(this.phase!=='play')throw Error('操作不可');const p=this.p[this.turn];const c=p.hand.find(x=>x.id===id);if(!c||!this.playable(c)||p.dead||p.ap<1)throw Error('使用不可');p.ap--;if(c.kind==='event')await this.fire(c);else{const g=this.group(p.id);this.emit(g,'use',p,null,c);if(!g.entries.some(x=>x.c===c)){this.say('P'+(p.id+1)+' カードを使用（発動なし）');await this.onUseWithoutTrigger?.(p,c)}this.enqueue(g)}await this.drain();if(p.dead||p.ap===0)await this.endTurn()}
async closeTurn(){const p=this.p[this.turn];const g=this.group(p.id);this.emit(g,'end',p);this.enqueue(g);await this.drain();for(const a of p.abilities)if(a===7){const source=this.group(p.id);await this.activation({kind:'ability',player:p.id,label:A[a]},async()=>{source.cause=this.active.seq;this.say('P'+(p.id+1)+' 発動 '+A[a]);await this.reportEffect([{kind:'ability',id:1,label:effectLabel(1)}]);source.lineEvents=[];this.emit(source,'ability',p);for(const x of this.order())if(x!==p)this.hpChange(x,-1,p,source);this.enqueue(source)});await this.drain()}p.ap=0;const fallen=this.group(p.id);this.settleEliminations(fallen);this.enqueue(fallen);await this.drain();this.used.clear();this.events.clear()}
async endTurn(){if(this.phase!=='play')throw Error('ターン終了不可');await this.closeTurn();if(this.alive().length<=1){await this.finishRound();return}this.nextTurn();await this.startTurn()}
randomRoundAction(p){const c={id:++this.id,kind:'action',t:[],e:[],changes:{}};const count=this.round;
for(let i=0;i<Math.min(count,T.length);i++){const pool=T.map((_,id)=>id).filter(id=>!c.t.includes(id));c.t.push(pool[this.int(pool.length)])}
const addRandom=()=>{const pool=E.map((_,id)=>id).filter(id=>!uniqueE.has(id)||!c.e.some(e=>e.id===id));this.addEffect(c,pool[this.int(pool.length)])};
for(let i=0;i<count;i++)addRandom();for(const a of p.abilities)if(a===5)addRandom();return c}
// A round modification is a draft until its final confirmation; Back never consumes randomness.
async upgradePlayer(p){
 const actions=p.hand.filter(c=>c.kind==='action'), back={v:'back',label:'戻る'};
 const select=async(prompt,opts,context={})=> (await this.pick(p,prompt,[...opts,back],context)).v;
 const confirm=async(label,preview=null,materials=[])=> (await this.pick(p,label,[{v:'confirm',label:'確定',preview,materials},back])).v==='confirm';
 while(true){const opts=[{v:0,label:'ランダムなアクションカードを追加'},{v:3,label:'任意のイベントカードを追加'}];if(actions.length)opts.push({v:1,label:'手札を改変'});if(actions.length>=2)opts.push({v:2,label:'手札を融合'});
 const method=(await this.pick(p,'ラウンド終了：デッキ改変',opts)).v;
 if(method===0){if(!await confirm('ランダムカード生成を確定（トリガー '+Math.min(this.round,T.length)+'・効果 '+(this.round+p.abilities.filter(a=>a===5).length)+'）'))continue;const c=this.randomRoundAction(p);this.deck.push(c);this.move(c,{zone:'generated',player:p.id},{zone:'deck'},'generate');this.say('追加 #'+c.id+' '+describe(c));await this.onGenerated?.(p,c);return}
 if(method===3){const id=await select('追加するイベントカード',this.opts(V.map((_,i)=>i),V));if(id==='back')continue;const preview={kind:'event',event:id};if(!await confirm('イベント追加を確定',preview))continue;const c=this.event(id);this.deck.push(c);this.move(c,{zone:'generated',player:p.id},{zone:'deck'},'generate');return}
 const a=await select(method===1?'改変する手札':'融合する1枚目',this.cards(p,c=>c.kind==='action'&&(method!==1||this.modificationKinds(c).length)),{kind:'card',mode:method===1?'strengthen':'fusion',...(method===1?{modules:this.modificationOptions(actions)}:{})});if(a==='back')continue;
 if(method===1){const kind=await select('改変対象',this.modificationKinds(a).map(v=>({v,label:v==='t'?'トリガー':'効果'})),{kind:'moduleKind',mode:'add',card:copy(a)});if(kind==='back')continue;const pool=this.modulePool(a,kind);if(!pool.length)continue;const id=await select('追加・変更先',this.opts(pool,kind==='t'?T:E.map((_,i)=>effectLabel(i))),{kind:'newModule',module:kind,mode:'add',card:copy(a)});if(id==='back')continue;const preview=copy(a);if(kind==='t')preview.t.push(id);else this.addEffect(preview,id);if(!await confirm('カード強化を確定',preview,[a]))continue;const before=copy(a);if(kind==='t')a.t.push(id);else this.addEffect(a,id);this.recordChange(a,p.id);this.observe({type:'modify',player:p.id,card:copy(a),before,module:kind,mode:'add',added:id});this.say('P'+(p.id+1)+' がカードを強化 #'+a.id);return}
 const b=await select('融合する2枚目',this.cards(p,c=>c.kind==='action'&&c!==a),{kind:'card',mode:'fusion'});if(b==='back')continue;const preview=copy(a);preview.t=[...new Set([...a.t,...b.t])];for(const e of b.e)this.addEffect(preview,e.id,e.n);if(!await confirm('カード融合を確定',preview,[a,b]))continue;const before=copy(a);a.t=preview.t;a.e=preview.e;a.changes??={};for(const [id,n] of Object.entries(b.changes??{}))a.changes[id]=(a.changes[id]??0)+n;this.recordChange(a,p.id);p.hand.splice(p.hand.indexOf(b),1);this.observe({type:'fusion',player:p.id,card:copy(a),before,material:copy(b)});this.say('融合 #'+a.id+' + #'+b.id);return
 }}
async vote(){this.phase='vote';const cards=this.finalCards();const votes=new Map();for(const p of this.p){if(!this.humanPlayers.has(p.id))continue;const opts=cards.map(v=>({v,label:'#'+v.id+' '+describe(v)}));const o=opts.length?await this.choose(p.id,'ベストカード投票',opts,{}):null;if(o&&!opts.includes(o))throw Error('無効な投票');if(o)votes.set(o.v,(votes.get(o.v)??0)+1)}this.votingResults=[...votes].sort((a,b)=>b[1]-a[1]).map(([card,count])=>{const max=Math.max(0,...Object.values(card.changes??{}));const recipients=max?this.p.filter(p=>(card.changes?.[p.id]??0)===max).map(p=>p.id):[];for(const id of recipients){this.p[id].score+=count;this.p[id].voteScore+=count}return {card:copy(card),count,recipients}});await this.onVotes?.(this.votingResults)}
async finishRound(){this.phase='score';const before=this.p.map(p=>p.score);for(const p of this.p){if(p.abilities.includes(7))this.say('P'+(p.id+1)+' ラウンド限定アビリティ喪失');p.abilities=p.abilities.filter(a=>a!==7)}const rank=[...this.fallen,...this.alive()];rank.forEach((p,i)=>{const bonus=p.abilities.filter(a=>a===4).length;p.score+=i+bonus;p.lastRank=i;p.roundScores.push({survival:i,bonus,...(p.roundPower?{power:p.roundPower}:{}),total:i+bonus+p.roundPower});this.say('P'+(p.id+1)+' 累計 '+p.score+'点')});await this.onRoundResult?.(before);
if(this.round>=this.cfg.rounds){await this.vote();this.phase='finished';this.say('勝者 P'+(this.standings()[0].id+1));return}
this.phase='upgrade';await Promise.all(this.order().map(p=>this.upgradePlayer(p)));await this.onUpgradesComplete?.();
const grave=this.grave.splice(0);this.deck.push(...grave);if(grave.length)this.observe({type:'shuffle',count:grave.length,from:{zone:'grave'},to:{zone:'deck'}});for(const p of this.p){const hand=p.hand.splice(0);this.deck.push(...hand);for(const c of hand)this.move(c,{zone:'hand',player:p.id},{zone:'deck'},'collect')}this.phase='between';}

}
return {Game,T,E,V,A,labelsE,describe,formatCard,effectLabel,cardEffectLabel,presets,presetCards,triggerOrder,effectOrder}
}
export const {Game,T,E,V,A,labelsE,describe,formatCard,effectLabel,cardEffectLabel,presets,presetCards,triggerOrder,effectOrder}=makeEngine();
