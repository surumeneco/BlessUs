import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
const phaser=resolve('node_modules/phaser/dist/phaser.min.js');
const loadPhaser=page=>page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({path:phaser,contentType:'application/javascript'}));
const base=process.env.BLESS_TEST_URL||'http://127.0.0.1:8000/';
const browser=await chromium.launch({headless:true});
const sizes=[[320,568],[360,640],[393,740],[412,915],[844,390],[1280,800]];
async function fits(page,label){
 const result=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 assert.ok(result.scroll<=result.viewport+1,`${label}: horizontal overflow ${JSON.stringify(result)}`);
}
try{
 for(const [width,height] of sizes){
  const mobile=width<500;
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await loadPhaser(page);
  page.on('dialog',d=>{errors.push('native browser dialog: '+d.type());d.dismiss()});
  await page.goto(base);
  await page.locator('.home-menu [data-action="room"]').waitFor({state:'visible'});
  await page.locator('body.phaser-rendered').waitFor();
  assert.equal(await page.locator('.phaser-stage canvas').count(),2);
  assert.equal(await page.locator('.home-copy .sub,.home-copy .eyebrow').count(),0);
  await fits(page,`${width}x${height} home`);
  for(const button of await page.locator('.home-menu button').all()){
   const box=await button.boundingBox();assert.ok(box&&box.x>=-1&&box.x+box.width<=width+1,`${width}x${height} menu button clipped`);
  }
  await page.locator('[data-action="room"]').click();
  await page.locator('.room-page').waitFor();
  await fits(page,`${width}x${height} room`);
  await page.locator('[data-action="home"]').click();
  await page.locator('[data-action="deck"]').click();
  await page.locator('.deck-page').waitFor();
  await fits(page,`${width}x${height} deck`);
  const ratio=await page.locator('.collection-item .card').first().evaluate(el=>el.clientWidth/el.clientHeight);assert.ok(Math.abs(ratio-5/7)<.04,`wrong card ratio ${ratio}`);
  await page.locator('[data-action="matrix"]').click();await page.locator('.matrix').waitFor();
  const color=await page.locator('.matrix td:not(:first-child):not(.nonzero)').first().evaluate(el=>getComputedStyle(el).backgroundColor);assert.equal(color,'rgba(0, 0, 0, 0)');
  await page.locator('.dialog-foot [data-dialog="close"]').click();
  await page.locator('[data-action="resetDeck"]').click();await page.locator('#game-confirm').waitFor();await page.locator('#game-confirm').click();
  await page.locator('[data-action="deckHome"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('.dialog').waitFor();
  for(const key of ['master','bgm','se'])assert.equal(await page.locator('#set-'+key).inputValue(),'50');
  const dialog=await page.locator('.dialog').boundingBox();assert.ok(dialog&&dialog.x>=-1&&dialog.x+dialog.width<=width+1&&dialog.y>=-1&&dialog.y+dialog.height<=height+1,`settings outside viewport ${width}x${height}`);
  assert.deepEqual(errors,[],`${width}x${height} startup errors`);
  await context.close();console.log(`PASS ${width}x${height} home/room/deck/settings`);
 }
 const context=await browser.newContext({viewport:{width:393,height:740},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());
 await page.addInitScript(()=>localStorage.setItem('bless-us-decks-v1','{"obsolete":true}'));
 await page.goto(base);await page.locator('.home-menu').waitFor();console.log('PASS corrupt saved deck state');
 await page.route('**/engine.mjs*',r=>r.abort());
 await page.reload();await page.getByRole('alert').filter({hasText:'ゲームを読み込めませんでした'}).waitFor();
 await fits(page,'startup failure');assert.ok(await page.getByRole('button',{name:'再読み込み'}).isVisible());console.log('PASS visible module-failure recovery');
 await context.close();
 const gameplay=await browser.newContext({viewport:{width:393,height:740},isMobile:true,hasTouch:true});
 const battle=await gameplay.newPage(),errors=[];battle.on('pageerror',e=>errors.push(e.message));await loadPhaser(battle);
 await battle.addInitScript(()=>localStorage.setItem('bless-us-settings-v1',JSON.stringify({speed:4,reduced:true,master:0,bgm:0,se:0})));
 await battle.goto(base);await battle.locator('body.phaser-rendered').waitFor();await battle.locator('[data-action="room"]').click();
 await battle.locator('[data-mode="1"]').click();await battle.locator('[data-mode="2"]').click();await battle.locator('[data-mode="3"]').click();await battle.locator('#room-seed').fill('42');await battle.locator('[data-action="newGame"]').click();
 await battle.locator('.choice-grid.ability-grid').waitFor();await battle.locator('[data-switch-choice]').nth(3).waitFor();
 await battle.locator('[data-switch-choice]').nth(3).click();await battle.locator('.choice-grid.ability-grid [data-opt]').first().click();await battle.locator('[data-dialog="choiceConfirm"]').click();
 for(let i=0;i<3;i++){await battle.locator('.choice-grid.ability-grid [data-opt]').first().click();await battle.locator('[data-dialog="choiceConfirm"]').click()}
 for(let i=0;i<20;i++){if(await battle.locator('#end-turn:enabled').count())break;if(await battle.locator('[data-action="confirmTarget"]:visible:enabled').count()){await battle.locator('[data-action="confirmTarget"]:visible:enabled').click();continue}if(await battle.locator('.hand-card.target:visible').count()){await battle.locator('.hand-card.target:visible').last().click({position:{x:12,y:20},timeout:5000});continue}if(await battle.locator('.seat-node.target:visible').count()){await battle.locator('.seat-node.target:visible').first().click();continue}if(await battle.locator('.choice-grid [data-opt]:visible').count()){await battle.locator('.choice-grid [data-opt]:visible').first().click();await battle.locator('[data-dialog="choiceConfirm"]').click();continue}await battle.waitForTimeout(100)}
 await battle.locator('#end-turn:enabled').waitFor();await fits(battle,'actual battle');assert.ok(await battle.locator('.hand-card').count()>0);assert.equal(await battle.locator('.hand-card').first().evaluate(el=>getComputedStyle(el.querySelector('.card')).opacity),'0');assert.equal(await battle.getByText('使用可能',{exact:true}).count(),0);
 await battle.locator('#end-turn').click();await battle.waitForTimeout(250);assert.deepEqual(errors,[],'Phaser battle startup errors');await gameplay.close();console.log('PASS Phaser battle and simultaneous human prompts');
}finally{await browser.close()}
