import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:4179/lab-07/');await page.waitForFunction(()=>window.__LAB_READY__);
 await page.screenshot({path:'artifacts/hero-desktop.png'});
 await page.locator('#part1').screenshot({path:'artifacts/threshold-desktop.png'});
 await page.locator('#part2').screenshot({path:'artifacts/regions-desktop.png'});
 await page.locator('#run-semantic').click();await page.waitForFunction(()=>document.querySelector('#semantic-status').dataset.state==='success');
 await page.locator('#part4').screenshot({path:'artifacts/semantic-desktop.png'});
 const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 await writeFile('artifacts/accessibility-desktop.json',JSON.stringify(accessibility.violations,null,2));
 if(accessibility.violations.length)throw Error(`Desktop accessibility violations: ${accessibility.violations.map(x=>x.id)}`);
 const layouts=[];
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
  const geometry=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));layouts.push(geometry);
  if(geometry.width>width+1)throw Error(`Horizontal overflow at ${width}`);
  if(width===390){await page.screenshot({path:'artifacts/hero-mobile.png'});await page.locator('#part4').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/semantic-mobile-viewport.png'});}
 }
 await writeFile('artifacts/responsive-geometry.json',JSON.stringify(layouts,null,2));
 console.log('Screenshots, real semantic output, desktop accessibility, and five responsive widths verified.');
}finally{await browser.close();}
