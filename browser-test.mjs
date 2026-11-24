import assert from 'node:assert/strict';
import {chromium} from 'playwright';
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
  await page.route('https://cdn.jsdelivr.net/**',route=>route.abort()); // Phaser is optional, not required for startup.
  await page.goto(base);
  await page.locator('.home-menu [data-action="room"]').waitFor({state:'visible'});
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
  await page.locator('[data-action="deckHome"]').click();
  await page.locator('[data-action="settings"]').click();
  await page.locator('.dialog').waitFor();
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
}finally{await browser.close()}
