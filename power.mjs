// Power catalog: IDs are independent from action-card IDs (game specification §12).
export const PT=[
 ['自分がダメージを受けた時',1,'damageSelf'],['自分がダメージを与えた時',1,'damageOther'],
 ['自分が体力を増やした時',1,'heal'],['自分がドローした時',1,'draw'],
 ['自分が手札を捨てた時',1,'discard'],['自分のターン開始時',0,'start'],
 ['自分のターン終了時',0,'end'],['自分のアビリティが発動した時',1,'ability'],
 ['自分がカードをコピーした時',1,'copy'],['自分が効果を追加した時',1,'addEffect'],
 ['自分が効果を変更した時',0,'changeEffect'],['自分がカードを使用した時',1,'use'],
 ['自分がアクションを獲得した時（通常獲得を除く）',1,'ap'],
 ['自分がトリガーを追加した時',1,'addTrigger'],['自分がトリガーを変更した時',0,'changeTrigger'],
 ['自分の手札が0枚になった時',1,'empty'],['自分の体力が3以下になった時',1,'lowHp'],
 ['ラウンド開始時',0,'roundStart'],['他プレイヤーが脱落した時',1,'otherEliminate'],
 ['自分が脱落した時',-5,'eliminate']
];
export const PE=[
 ['ダメージ与える',1,1,0],['ダメージ全体攻撃',3,1,1],['ダメージ受ける',-2,1,14],
 ['回復',2,2,2],['回復させる',-1,2,null],['枚ドロー',1,3,4],
 ['枚捨てる',-1,4,null],['枚ランダムに捨てる',-2,4,null],['枚渡す',-2,4,null],
 ['枚ドローさせる',-1,3,null],['枚ランダムに捨てさせる',1,4,7],
 ['枚ランダムに貰う',2,4,16],['枚を墓地から手札に加える',2,4,19],
 ['枚ずつ全員がドローする',0,3,5],['枚ずつ全員が捨てる',0,4,17],
 ['つランダムなトリガーを追加する',2,6,null],['つランダムな効果を追加する',2,6,null],
 ['つランダムなトリガーに変更する',0,6,null],['つランダムな効果に変更する',0,6,null],
 ['アクション獲得',2,0,8],['アクション失う',-2,0,null],
 ['ランダムな効果発動',1,6,null],['つアビリティを失う',-5,6,null,true],
 ['ポイント獲得',6,6,null,true]
];
export function powerEffectLabel(id,n=1){return id===21?n+'回ランダムな効果発動':n+PE[id][0]}
export function powerScore(p){return PT[p.t[0]][1]+p.e.reduce((s,e)=>s+PE[e.id][1]*e.n,0)}
export function powerCount(p){return p.e.reduce((s,e)=>s+e.n,0)}
export function normalizePower(value){
 if(value==null)return null;
 if(!Array.isArray(value.t)||value.t.length!==1||!Number.isInteger(value.t[0])||!PT[value.t[0]]||!Array.isArray(value.e)||!value.e.length||value.e.length>5)return null;
 const e=[];let count=0;
 for(const line of value.e){if(!line||!Number.isInteger(line.id)||!PE[line.id]||!Number.isInteger(line.n)||line.n<1||line.n>5)return null;
 const old=e.find(x=>x.id===line.id);if(PE[line.id][4]&&(old||line.n!==1))return null;
 count+=line.n;if(count>5)return null;if(old)old.n+=line.n;else e.push({id:line.id,n:line.n});}
 const p={kind:'power',t:[value.t[0]],e};return powerScore(p)<=0?p:null;
}
export function powerMatches(p,t,type,subject,actor){
 if(p.dead&&t!==19)return false;
 const k=PT[t][2];
 if(k==='damageSelf')return type==='damage'&&p===subject;
 if(k==='damageOther')return type==='damage'&&p===actor;
 if(k==='roundStart')return type==='roundStart';
 if(k==='otherEliminate')return type==='eliminate'&&p!==subject;
 return type===k&&p===subject;
}

// Full-text presentation for the separate power catalog.
export function powerEffectDetail(id,n=1){
 const details=[
 n+'ダメージを任意の生存プレイヤーに与える',
 n+'ダメージを他プレイヤー全員に与える',
 n+'ダメージを自分に与える',
 n+'点分、自分の体力を増やす',
 n+'点分、任意の他の生存プレイヤーの体力を増やす',
 n+'枚を山札からドローする',
 n+'枚を自分の手札から選んで捨てる',
 n+'枚を自分の手札からランダムに捨てる',
 n+'枚を自分の手札から選んで任意の他の生存プレイヤーに渡す',
 n+'枚を任意の他の生存プレイヤーが山札からドローする',
 n+'枚を任意の生存プレイヤーの手札からランダムに捨てる',
 n+'枚を任意の生存プレイヤーの手札からランダムに貰う',
 n+'枚を墓地から選んで自分の手札に加える',
 n+'枚ずつ、全プレイヤーが山札からドローする',
 n+'枚ずつ、全プレイヤーが自身の手札から選んで捨てる',
 n+'つ、手札のアクションカードにトリガーを追加する',
 n+'つ、手札のアクションカードに効果を追加する',
 n+'つ、手札のアクションカードのトリガーを変更する',
 n+'つ、手札のアクションカードの効果を変更する',
 n+'アクション権を獲得する',
 n+'アクション権を失う',
 n+'回、パワー効果からランダムに選ばれた効果を発動する',
 n+'つ、自分の所有アビリティから任意に選んで失う',
 n+'ポイントを累計得点に加算する'];
 return details[id]
}
