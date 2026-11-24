import {Game,T,E,V,A,labelsE,describe} from './engine.mjs';
function boot(Game,T,E,V,A,labelsE,describe){
 const $=id=>document.getElementById(id);
 let g=null,scene=null,phaser=null,busy=false,paused=false,choice=null,page=0,last=-1,screen='home',pending=null,epoch=0,aborting=false,failed=false;
 let modes=['human','cpu','cpu','cpu'],matchModes=[],room={rounds:3,hp:10,chance:25,seed:1,deckMode:'default'},custom='',volume=40,audio=null;
 const title={home:'ホーム',room:'ルーム',roomSettings:'ルーム設定',deck:'デッキカスタマイズ',settings:'設定',game:'ゲーム',result:'対戦結果'};
 const error=e=>{$('error').textContent=String(e)};
 function sound(){if(!volume)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state!=='running')return;const o=audio.createOscillator(),v=audio.createGain();o.frequency.value=480;v.gain.setValueAtTime(volume/100*.08,audio.currentTime);v.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.08);o.connect(v);v.connect(audio.destination);o.start();o.stop(audio.currentTime+.09)}catch{}}
 function unlock(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}}
 function show(s){screen=s;for(const k of Object.keys(title))$('screen-'+k).hidden=k!==s;$('breadcrumb').textContent=title[s];$('error').textContent='';if(s==='room')renderRoom();if(s==='game'){if(!phaser)phaser=new Phaser.Game({type:Phaser.AUTO,parent:'board',width:1120,height:630,backgroundColor:'#151d2c',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Board});else phaser.scale.refresh();render()}if(s==='result')renderResult()}
 function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;return b}
 const modeName=m=>m==='cpu'?'CPU':'手動';
 function renderRoom(){$('roomSummary').textContent=modes.length+'人 / '+room.rounds+'ラウンド / 初期HP '+room.hp+' / 脱落時獲得率 '+room.chance+'% / '+(room.deckMode==='custom'?'カスタムデッキ':'標準デッキ');const box=$('roster');box.replaceChildren();
 modes.forEach((m,i)=>{const row=document.createElement('div');row.className='seat';const label=document.createElement('span');label.textContent='P'+(i+1)+'　'+modeName(m);const toggle=button(m==='cpu'?'手動に変更':'CPUに変更',()=>{modes[i]=m==='cpu'?'human':'cpu';renderRoom()});const remove=button('退出',()=>{modes.splice(i,1);renderRoom()});remove.disabled=modes.length<=2;row.append(label,toggle,remove);box.append(row)});$('addHuman').disabled=$('addCpu').disabled=modes.length>=6}
 function add(m){if(modes.length<6){modes.push(m);renderRoom()}}
 $('goRoom').onclick=()=>show('room');$('roomHome').onclick=()=>show('home');$('addHuman').onclick=()=>add('human');$('addCpu').onclick=()=>add('cpu');
 $('goRoomSettings').onclick=()=>{$('players').value=modes.length;for(const k of Object.keys(room))$(k).value=room[k];show('roomSettings')};
 $('saveRoom').onclick=()=>{const n=+$('players').value,rounds=+$('rounds').value,hp=+$('hp').value,chance=+$('chance').value,seed=+$('seed').value,deckMode=$('deckMode').value;
 if(!Number.isInteger(n)||n<2||n>6||!Number.isInteger(rounds)||rounds<1||!Number.isInteger(hp)||hp<1||!Number.isFinite(chance)||chance<0||chance>100||!Number.isInteger(seed))return error('ルーム設定値を確認してください');
 if(deckMode==='custom'&&!custom)return error('先にデッキカスタマイズで保存してください');room={rounds,hp,chance,seed,deckMode};modes=modes.slice(0,n);while(modes.length<n)modes.push('cpu');show('room')};
 $('cancelRoom').onclick=()=>show('room');
 $('deckHelp').textContent=[V,T,labelsE].map((a,i)=>['イベント','トリガー','効果'][i]+'：'+a.map((v,i)=>i+'='+v).join('、')).join('\n');
 $('goDeck').onclick=()=>{$('deck').value=custom;show('deck')};$('cancelDeck').onclick=()=>show('home');
 $('preset').onclick=()=>{$('deck').value=JSON.stringify(new Game({seed:room.seed}).deck.map(c=>c.kind==='event'?{event:c.event}:{trigger:c.t[0],effect:c.e[0].id}),null,2)};
 function parseDeck(s){const data=JSON.parse(s);if(!Array.isArray(data))throw Error('デッキは配列');return data.map(c=>{if(Number.isInteger(c.event)&&c.event>=0&&c.event<V.length)return {kind:'event',event:c.event};if(Number.isInteger(c.trigger)&&c.trigger>=0&&c.trigger<T.length&&Number.isInteger(c.effect)&&c.effect>=0&&c.effect<E.length)return {kind:'action',t:[c.trigger],e:[{id:c.effect,n:1}]};throw Error('不正なカード '+JSON.stringify(c))})}
 $('saveDeck').onclick=()=>{try{const s=$('deck').value.trim();if(!s){custom='';room.deckMode='default'}else{new Game({deck:parseDeck(s)});custom=s}show('home')}catch(e){error(e)}};
 $('goSettings').onclick=()=>show('settings');$('settingsHome').onclick=()=>show('home');$('volume').oninput=()=>{volume=+$('volume').value;$('volumeValue').textContent=volume+'%';unlock();sound()};
 function bot(p,prompt,opts){if(prompt.startsWith('任意のプレイヤー')){const a=opts.filter(x=>x.v.id!==p);return (a.length?a:opts).reduce((a,b)=>a.v.hp<=b.v.hp?a:b)}return opts[g.int(opts.length)]}
 function isCpu(p){return matchModes[p]==='cpu'}
 function choose(p,prompt,opts){if(aborting)return Promise.reject(Error('対戦終了'));if(isCpu(p)&&!paused)return Promise.resolve(bot(p,prompt,opts));return new Promise((resolve,reject)=>{choice={p,prompt,opts,resolve,reject};render();$('choice').scrollIntoView({block:'nearest'})})}
 function accept(o){if(!choice)return;const c=choice;choice=null;c.resolve(o);render()}
 function maybeAutoChoice(){if(choice&&isCpu(choice.p)&&!paused)accept(bot(choice.p,choice.prompt,choice.opts))}
 function setMode(i){matchModes[i]=isCpu(i)?'human':'cpu';maybeAutoChoice();render();schedule()}
 function render(){if(!g||screen!=='game')return;if(last!==g.turn){page=0;last=g.turn}
 $('state').textContent='ラウンド '+g.round+'/'+g.cfg.rounds+'　ターン '+g.turns+'　'+({ready:'準備',setup:'アビリティ・配札',play:'行動',upgrade:'ラウンド終了・デッキ改変',between:'次ラウンド待ち',finished:'終了'}[g.phase])+'　山札 '+g.deck.length+' / 墓地 '+g.grave.length;
 $('start').hidden=!['ready','between'].includes(g.phase);$('start').disabled=busy||failed;$('end').disabled=busy||failed||g.phase!=='play'||isCpu(g.turn);$('pauseCpu').textContent=paused?'CPU再開':'CPU一時停止';$('status').textContent=failed?'処理停止':choice?'P'+(choice.p+1)+' 選択待ち':busy?'解決中':g.phase==='play'&&isCpu(g.turn)?'CPUのターン':'';
 const box=$('choice');box.replaceChildren();box.hidden=!choice;if(choice){const h=document.createElement('h2');h.textContent='P'+(choice.p+1)+'（'+modeName(matchModes[choice.p])+'）：'+choice.prompt;box.append(h);if(isCpu(choice.p)){const p=document.createElement('p');p.textContent='CPU一時停止中。再開または手動への切替で続行。';box.append(p)}else for(const o of choice.opts)box.append(button(o.label,()=>accept(o)))}
 $('gameModes').replaceChildren();for(const p of g.p)$('gameModes').append(button('P'+(p.id+1)+' '+modeName(matchModes[p.id])+' → '+(isCpu(p.id)?'手動':'CPU'),()=>setMode(p.id)));
 $('hands').replaceChildren();for(const p of g.p){const d=document.createElement('details');d.open=$('reveal').checked;const s=document.createElement('summary');s.textContent='P'+(p.id+1)+'（'+modeName(matchModes[p.id])+'）：'+p.hand.length+'枚 / '+p.abilities.map(a=>A[a]).join('、');d.append(s);for(const c of p.hand){const line=document.createElement('div');line.textContent='#'+c.id+' '+describe(c);d.append(line)}$('hands').append(d)}
 $('log').textContent=g.log.slice(-160).join('\n');$('log').scrollTop=$('log').scrollHeight;if(scene)scene.paint()}
 async function act(fn){if(busy||failed||screen!=='game')return;busy=true;render();try{await fn();sound()}catch(e){if(!aborting){failed=true;error(e);console.error(e)}}finally{busy=false;if(aborting){g=null;choice=null;aborting=false;show('room')}else if(g.phase==='finished')show('result');else{render();schedule()}}}
 function step(){const p=g.p[g.turn],a=p.hand.filter(c=>g.playable(c));const c=a.find(c=>c.kind==='action'&&c.e.some(e=>e.id===0||e.id===1))??a[g.int(a.length)];return c?g.play(c.id):g.endTurn()}
 function canAuto(){return screen==='game'&&g&&!busy&&!failed&&!paused&&g.phase==='play'&&isCpu(g.turn)}
 function schedule(){if(pending!==null){clearTimeout(pending);pending=null}if(!canAuto())return;const t=epoch;pending=setTimeout(()=>{pending=null;if(t===epoch&&canAuto())act(step)},250)}
 $('new').onclick=()=>{if(busy)return;try{unlock();g=new Game({players:modes.length,rounds:room.rounds,hp:room.hp,seed:room.seed,reviveChance:room.chance/100,deck:room.deckMode==='custom'?parseDeck(custom):null},choose);epoch++;matchModes=[...modes];paused=false;failed=false;page=0;last=-1;show('game');act(()=>g.startRound())}catch(e){error(e)}};
 $('start').onclick=()=>act(()=>g.startRound());$('end').onclick=()=>{if(!isCpu(g.turn))act(()=>g.endTurn())};$('pauseCpu').onclick=()=>{paused=!paused;maybeAutoChoice();render();schedule()};
 $('quit').onclick=()=>{if(!window.confirm('現在の対戦を終了しますか？'))return;epoch++;if(pending!==null){clearTimeout(pending);pending=null}if(busy){aborting=true;if(choice){const c=choice;choice=null;c.reject(Error('対戦終了'))}}else{g=null;show('room')}};
 $('reveal').onchange=render;
 function download(){if(!g)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({config:g.cfg,modes:matchModes,round:g.round,turns:g.turns,players:g.p,deck:g.deck,grave:g.grave,history:g.history,log:g.log},null,2)],{type:'application/json'}));a.download='bless-us-'+g.cfg.seed+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
 $('download').onclick=$('resultDownload').onclick=download;
 function renderResult(){const max=Math.max(...g.p.map(p=>p.score));$('winner').textContent='勝者：'+g.p.filter(p=>p.score===max).map(p=>'P'+(p.id+1)+'（'+modeName(matchModes[p.id])+'）').join(' / ');$('scores').replaceChildren();for(const p of [...g.p].sort((a,b)=>b.score-a.score)){const row=document.createElement('p');row.textContent='P'+(p.id+1)+'（'+modeName(matchModes[p.id])+'）　'+p.score+'点';$('scores').append(row)}}
 $('resultRoom').onclick=()=>{g=null;show('room')};$('resultHome').onclick=()=>{g=null;show('home')};
 class Board extends Phaser.Scene{
 constructor(){super('board')}create(){scene=this;this.paint()}
 text(x,y,t,size=18,color='#e5eaf3',wrap=0){return this.add.text(x,y,String(t),{fontFamily:'system-ui, sans-serif',fontSize:size+'px',color,wordWrap:wrap?{width:wrap,useAdvancedWrap:true}:undefined})}
 rect(x,y,w,h,fill,stroke=0x40516a){return this.add.rectangle(x,y,w,h,fill).setOrigin(0).setStrokeStyle(1,stroke)}
 button(x,y,t,fn){this.rect(x,y,96,34,0x344766).setInteractive({useHandCursor:true}).on('pointerdown',fn);this.text(x+8,y+5,t,17)}
 paint(){this.children.removeAll(true);this.rect(0,0,1120,630,0x151d2c);this.text(22,15,'BLESS US  /  RULES PROTOTYPE',21,'#aabbd3');if(!g||screen!=='game')return;
 const w=(1076-(g.p.length-1)*8)/g.p.length;g.p.forEach((p,i)=>{const x=22+i*(w+8);this.rect(x,55,w,142,p.dead?0x30313a:p.id===g.turn?0x283f59:0x222d41,p.id===g.turn?0x91b6f1:0x40516a);this.text(x+10,64,'P'+(i+1)+' '+modeName(matchModes[i])+(p.dead?' / 脱落':''));this.text(x+10,90,'HP '+p.hp+'　'+p.score+'点',19);this.text(x+10,119,'手札 '+p.hand.length+'　権利 '+p.ap,15);this.text(x+10,146,'能力 '+p.abilities.length+'個',15)});
 this.text(22,214,'山札 '+g.deck.length+'　墓地 '+g.grave.length+'　発動履歴 '+g.history.length,22);const p=g.p[g.turn];this.text(22,252,'P'+(p.id+1)+' の手札（左→右）',21);const max=Math.max(0,Math.ceil(p.hand.length/5)-1);page=Math.min(page,max);
 if(g.phase==='finished')this.text(22,290,'ゲーム終了 — スコアを確認',22);
 p.hand.slice(page*5,page*5+5).forEach((c,i)=>{const x=22+i*217;const ok=!busy&&!failed&&!isCpu(p.id)&&g.phase==='play'&&!p.dead&&p.ap>0&&g.playable(c);const r=this.rect(x,304,207,267,ok?0x29425a:0x222b3a,ok?0x92c9ad:0x48556a);if(ok)r.setInteractive({useHandCursor:true}).on('pointerdown',()=>act(()=>g.play(c.id)));this.text(x+10,314,'#'+c.id+' '+(c.kind==='event'?'EVENT':'ACTION'),15,'#b0c6e3');if(c.kind==='event')this.text(x+10,350,V[c.event],25,'#e7dcad',185);else{this.text(x+10,346,'トリガー\n'+c.t.map(t=>T[t]).join(' / '),16,'#d1e4f5',185);this.text(x+10,425,'効果\n'+c.e.map(e=>E[e.id]+' ×'+e.n).join(' / '),16,'#e7dcad',185)}this.text(x+10,545,ok?'クリックで使用':isCpu(p.id)?'CPU操作':'自動発動 / 使用不可',14,ok?'#9ad8ae':'#a0a9b9')});
 if(page>0)this.button(22,582,'← 前へ',()=>{page--;this.paint()});if(page<max)this.button(1000,582,'次へ →',()=>{page++;this.paint()});this.text(500,588,(page+1)+' / '+(max+1),17);
 }}
 show('home');
}
boot(Game,T,E,V,A,labelsE,describe);
