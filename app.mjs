import {Game,T,E,V,A,labelsE,describe} from './engine.mjs';
function boot(Game,T,E,V,A,labelsE,describe){
 const $=id=>document.getElementById(id);let g,scene,busy=false,auto=false,token=0,choice=null,page=0,last=-1;
 $('deckHelp').textContent=[V,T,labelsE].map((a,i)=>['イベント','トリガー','効果'][i]+'：'+a.map((v,i)=>i+'='+v).join('、')).join('\n');
 $('preset').onclick=()=>{$('deck').value=JSON.stringify(new Game({seed:+$('seed').value}).deck.map(c=>c.kind==='event'?{event:c.event}:{trigger:c.t[0],effect:c.e[0].id}),null,2)};
 function parseDeck(){if(!$('deck').value.trim())return null;const data=JSON.parse($('deck').value);if(!Array.isArray(data))throw Error('デッキは配列');return data.map(c=>{if(Number.isInteger(c.event)&&c.event>=0&&c.event<V.length)return {kind:'event',event:c.event};if(Number.isInteger(c.trigger)&&c.trigger>=0&&c.trigger<T.length&&Number.isInteger(c.effect)&&c.effect>=0&&c.effect<E.length)return {kind:'action',t:[c.trigger],e:[{id:c.effect,n:1}]};throw Error('不正なカード '+JSON.stringify(c))})}
 function bot(p,prompt,opts){if(prompt.startsWith('任意のプレイヤー')){const a=opts.filter(x=>x.v.id!==p);return (a.length?a:opts).reduce((a,b)=>a.v.hp<=b.v.hp?a:b)}return opts[g.int(opts.length)]}
 function choose(p,prompt,opts){if(auto)return Promise.resolve(bot(p,prompt,opts));return new Promise(resolve=>{choice={p,prompt,opts,resolve};render();$('choice').scrollIntoView({block:'nearest'})})}
 function accept(o){if(!choice)return;const c=choice;choice=null;c.resolve(o);render()}
 function render(){if(!g)return;if(last!==g.turn){page=0;last=g.turn}
 $('state').textContent='R '+g.round+'/'+g.cfg.rounds+'　T '+g.turns+'　'+({ready:'準備',setup:'準備中',play:'行動',upgrade:'改変',between:'次ラウンド待ち',finished:'終了'}[g.phase])+'　山札 '+g.deck.length+' / 墓地 '+g.grave.length;
 $('start').disabled=busy||!['ready','between'].includes(g.phase);$('end').disabled=busy||g.phase!=='play';$('step').disabled=busy||g.phase==='finished';$('auto').textContent=auto?'自動試遊停止':'自動試遊開始';$('status').textContent=choice?'選択待ち':busy?'解決中':'';
 const box=$('choice');box.replaceChildren();box.hidden=!choice;if(choice){const h=document.createElement('h2');h.textContent='P'+(choice.p+1)+'：'+choice.prompt;box.append(h);for(const o of choice.opts){const b=document.createElement('button');b.textContent=o.label;b.onclick=()=>accept(o);box.append(b)}}
 $('hands').replaceChildren();for(const p of g.p){const d=document.createElement('details');d.open=$('reveal').checked;const s=document.createElement('summary');s.textContent='P'+(p.id+1)+'：'+p.hand.length+'枚 / '+p.abilities.map(a=>A[a]).join('、');d.append(s);for(const c of p.hand){const line=document.createElement('div');line.textContent='#'+c.id+' '+describe(c);d.append(line)}$('hands').append(d)}
 $('log').textContent=g.log.slice(-160).join('\n');$('log').scrollTop=$('log').scrollHeight;if(scene)scene.paint()}
 async function act(fn){if(busy)return;busy=true;render();try{await fn()}catch(e){auto=false;$('error').textContent=String(e);console.error(e)}finally{busy=false;render()}}
 async function step(){if(['ready','between'].includes(g.phase))return g.startRound();if(g.phase==='play'){const p=g.p[g.turn],a=p.hand.filter(c=>g.playable(c));const c=a.find(c=>c.kind==='action'&&c.e.some(e=>e.id===0||e.id===1))??a[g.int(a.length)];return c?g.play(c.id):g.endTurn()}}
 async function loop(t){while(auto&&t===token&&g.phase!=='finished'){if(!busy)await act(step);await new Promise(r=>setTimeout(r,100))}if(t===token){auto=false;render()}}
 $('new').onclick=()=>{if(busy)return;try{auto=false;token++;const chance=+$('chance').value;if(chance<0||chance>100)throw Error('獲得率は0〜100');g=new Game({players:+$('players').value,rounds:+$('rounds').value,hp:+$('hp').value,seed:+$('seed').value,reviveChance:chance/100,deck:parseDeck()},choose);page=0;last=-1;$('error').textContent='';render()}catch(e){$('error').textContent=String(e)}};
 $('start').onclick=()=>act(()=>g.startRound());$('end').onclick=()=>act(()=>g.endTurn());$('step').onclick=()=>{if(busy||auto)return;auto=true;act(step).finally(()=>{auto=false;render()})};$('auto').onclick=()=>{auto=!auto;token++;if(auto){if(choice)accept(bot(choice.p,choice.prompt,choice.opts));loop(token)}render()};
 $('reveal').onchange=render;$('download').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({config:g.cfg,round:g.round,turns:g.turns,players:g.p,deck:g.deck,grave:g.grave,history:g.history,log:g.log},null,2)],{type:'application/json'}));a.download='bless-us-'+g.cfg.seed+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
 class Board extends Phaser.Scene{
 constructor(){super('board')}create(){scene=this;this.paint()}
 text(x,y,t,size=18,color='#e5eaf3',wrap=0){return this.add.text(x,y,String(t),{fontFamily:'system-ui, sans-serif',fontSize:size+'px',color,wordWrap:wrap?{width:wrap,useAdvancedWrap:true}:undefined})}
 rect(x,y,w,h,fill,stroke=0x40516a){return this.add.rectangle(x,y,w,h,fill).setOrigin(0).setStrokeStyle(1,stroke)}
 button(x,y,t,fn){this.rect(x,y,96,34,0x344766).setInteractive({useHandCursor:true}).on('pointerdown',fn);this.text(x+8,y+5,t,17)}
 paint(){this.children.removeAll(true);this.rect(0,0,1120,630,0x151d2c);this.text(22,15,'BLESS US  /  RULES PROTOTYPE',21,'#aabbd3');if(!g)return;
 const w=(1076-(g.p.length-1)*8)/g.p.length;g.p.forEach((p,i)=>{const x=22+i*(w+8);this.rect(x,55,w,142,p.dead?0x30313a:p.id===g.turn?0x283f59:0x222d41,p.id===g.turn?0x91b6f1:0x40516a);this.text(x+10,64,'P'+(i+1)+(p.dead?' / 脱落':''));this.text(x+10,90,'HP '+p.hp+'　'+p.score+'点',19);this.text(x+10,119,'手札 '+p.hand.length+'　権利 '+p.ap,15);this.text(x+10,146,'能力 '+p.abilities.length+'個',15)});
 this.text(22,214,'山札 '+g.deck.length+'　墓地 '+g.grave.length+'　発動履歴 '+g.history.length,22);const p=g.p[g.turn];this.text(22,252,'P'+(p.id+1)+' の手札（左→右）',21);const max=Math.max(0,Math.ceil(p.hand.length/5)-1);page=Math.min(page,max);
 if(g.phase==='finished')this.text(22,290,'ゲーム終了 — スコアを確認',22);
 p.hand.slice(page*5,page*5+5).forEach((c,i)=>{const x=22+i*217;const ok=!busy&&!auto&&g.phase==='play'&&!p.dead&&p.ap>0&&g.playable(c);const r=this.rect(x,304,207,267,ok?0x29425a:0x222b3a,ok?0x92c9ad:0x48556a);if(ok)r.setInteractive({useHandCursor:true}).on('pointerdown',()=>act(()=>g.play(c.id)));this.text(x+10,314,'#'+c.id+' '+(c.kind==='event'?'EVENT':'ACTION'),15,'#b0c6e3');if(c.kind==='event')this.text(x+10,350,V[c.event],25,'#e7dcad',185);else{this.text(x+10,346,'トリガー\n'+c.t.map(t=>T[t]).join(' / '),16,'#d1e4f5',185);this.text(x+10,425,'効果\n'+c.e.map(e=>E[e.id]+' ×'+e.n).join(' / '),16,'#e7dcad',185)}this.text(x+10,545,ok?'クリックで使用':'自動発動 / 使用不可',14,ok?'#9ad8ae':'#a0a9b9')});
 if(page>0)this.button(22,582,'← 前へ',()=>{page--;this.paint()});if(page<max)this.button(1000,582,'次へ →',()=>{page++;this.paint()});this.text(500,588,(page+1)+' / '+(max+1),17);
 }}
 new Phaser.Game({type:Phaser.AUTO,parent:'board',width:1120,height:630,backgroundColor:'#151d2c',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Board});$('new').click();
}
boot(Game,T,E,V,A,labelsE,describe);
