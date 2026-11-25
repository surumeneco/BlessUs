// Identity is separate from logical player ID and game rules. Session-only preferences.
export const PALETTE=[0xb8a2eb,0x78cec8,0xf6a38e,0xf7c865,0x91b8ed,0xeaa7ca,0xa6d5a2,0xf1bd8c,0xa4a8f0,0x85d1ed,0xc5d69b,0xc8b2a2];
export const PARTS={color:['ラベンダー','ミント','コーラル','サン','ブルー','ローズ','リーフ','ピーチ','アイリス','スカイ','ライム','モカ'],eyes:['まる','たれ目','にっこり','きりっ','きらきら','ねむい'],mouth:['スマイル','まる','にっこり','むっ','ねこ','ちいさい'],accessory:['なし','天使の輪','王冠','リボン','星','葉っぱ','メガネ']};
const index=(n,rnd)=>Math.floor(rnd()*n);
// Precomposed kana letters, including small kana and voiced kana. No word or script-order constraint.
const KANA=Array.from({length:0x3096-0x3041+1},(_,i)=>String.fromCharCode(0x3041+i)).concat(Array.from({length:0x30fa-0x30a1+1},(_,i)=>String.fromCharCode(0x30a1+i)));
export function cpuName(rnd=Math.random){return Array.from({length:3+index(5,rnd)},()=>KANA[index(KANA.length,rnd)]).join('')}
export function randomAppearance(rnd=Math.random){return Object.fromEntries(Object.entries(PARTS).map(([key,values])=>[key,index(values.length,rnd)]))}
export function newProfile(id,rnd=Math.random){return {humanName:`P${id+1}`,cpuName:cpuName(rnd),appearance:randomAppearance(rnd)}}
export function cleanName(value){return Array.from(String(value).replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu,'').trim()).slice(0,12).join('')}
