import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
test.beforeAll(async()=>mkdir('artifacts',{recursive:true}));
async function ready(page){await page.goto('./');await page.waitForFunction(()=>window.__LAB_READY__||window.__LAB_INIT_ERROR__);expect(await page.evaluate(()=>window.__LAB_INIT_ERROR__)).toBeUndefined();}

test('initial live processing, navigation, assets and console are correct',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await ready(page);await expect(page).toHaveTitle(/Lab 07.*Image Segmentation/);
  await expect(page.locator('#threshold-metrics')).toContainText('1.0000');
  await expect(page.locator('#region-metrics')).toContainText('Watershed object regions 2');
  await expect(page.locator('#edge-metrics')).toContainText('External contours 1');
  await expect(page.locator('#threshold-status')).toHaveAttribute('data-state','success');
  await expect(page.locator('#region-status')).toHaveAttribute('data-state','success');
  await expect(page.locator('#edge-status')).toHaveAttribute('data-state','success');
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  expect(errors).toEqual([]);
});
test('threshold lighting, parameter validation, upload and real PNG download work',async({page})=>{
  await ready(page);await page.locator('#threshold-source').selectOption('uneven');await expect(page.locator('#threshold-status')).toContainText('Ready to process');await page.locator('#run-threshold').click();
  await expect(page.locator('#threshold-metrics')).toContainText('0.1003');await expect(page.locator('#threshold-metrics')).toContainText('1.0000');
  await page.locator('#threshold-block').fill('100');await page.locator('#run-threshold').click();await expect(page.locator('#threshold-status')).toContainText('must be odd');
  await page.locator('#threshold-block').fill('101');await page.locator('#threshold-upload').setInputFiles(resolve('assets/samples/cat-garden.jpg'));await expect(page.locator('#threshold-status')).toContainText('Ready to process');await page.locator('#run-threshold').click();await expect(page.locator('#threshold-metrics')).toContainText('Unavailable for this image');
  const download=page.waitForEvent('download');await page.locator('#download-threshold').click();expect((await download).suggestedFilename()).toBe('lab7-adaptive-mask.png');
});
test('seed editing, absence of markers, region comparison and edge validation work',async({page})=>{
  await ready(page);await page.locator('#clear-seeds').click();await page.locator('#run-regions').click();await expect(page.locator('#region-status')).toContainText('between 1 and 12');
  await page.locator('#seed-x').fill('9999');await page.locator('#add-seed').click();await expect(page.locator('#region-status')).toContainText('inside');
  await page.locator('#reset-seeds').click();await page.locator('#run-regions').click();await expect(page.locator('#region-status')).toHaveAttribute('data-state','success');await expect(page.locator('#seed-list .seed-chip')).toHaveCount(2);
  await page.locator('#seed-x').fill('160');await page.locator('#seed-y').fill('140');await page.locator('#add-seed').click();await expect(page.locator('#seed-list .seed-chip')).toHaveCount(3);await page.locator('#run-regions').click();await expect(page.locator('#region-metrics')).toContainText('Watershed object regions 3');
  await page.locator('#use-region-input').click();await page.locator('#run-edges').click();await expect(page.locator('#edge-status')).toHaveAttribute('data-state','success');
  await page.locator('#canny-low').fill('200');await page.locator('#canny-high').fill('100');await page.locator('#run-edges').click();await expect(page.locator('#edge-status')).toContainText('must be lower');
});
test('real semantic model, upload, trimap evaluation and exports work',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
  await page.locator('#run-semantic').click();await expect(page.locator('#semantic-status')).toHaveAttribute('data-state','success',{timeout:120000});
  await expect(page.locator('#semantic-legend')).toContainText('dog');
  const iou=await page.evaluate(()=>window.Lab7App.state.semantic.result.foregroundIoU);expect(iou).toBeGreaterThan(.90);
  const evidence=await page.evaluate(()=>{const app=window.Lab7App,s=app.state.semantic,t=app.prepareTensor(s);return {tensor:Array.from(t.input),geometry:{width:t.width,height:t.height,outputWidth:s.width,outputHeight:s.height},labels:Array.from(s.result.labels)};});
  await writeFile('artifacts/browser-input.bin',Buffer.from(new Float32Array(evidence.tensor).buffer));await writeFile('artifacts/browser-labels.bin',Buffer.from(evidence.labels));await writeFile('artifacts/browser-geometry.json',JSON.stringify(evidence.geometry));
  const labelDownload=page.waitForEvent('download');await page.locator('#download-labels').click();expect((await labelDownload).suggestedFilename()).toBe('lab7-class-ids.png');
  await page.locator('#semantic-opacity').fill('70');await expect(page.locator('#semantic-opacity-value')).toHaveText('70%');
  await page.locator('#evaluate-dataset').click();await expect(page.locator('#dataset-status')).toContainText('Completed 3 / 3',{timeout:120000});await expect(page.locator('#dataset-evaluation tbody tr')).toHaveCount(3);
  const evaluation=page.waitForEvent('download');await page.locator('#download-evaluation').click();expect((await evaluation).suggestedFilename()).toBe('lab7-dataset-evaluation.json');
  await writeFile('artifacts/browser-evaluation.json',JSON.stringify(await page.evaluate(()=>window.Lab7App.state.evaluation),null,2));
  await page.locator('#semantic-upload').setInputFiles(resolve('assets/samples/cat-garden.jpg'));await expect(page.locator('#semantic-status')).toContainText('is ready');await page.locator('#run-semantic').click();await expect(page.locator('#semantic-status')).toHaveAttribute('data-state','success',{timeout:120000});await expect(page.locator('#semantic-metrics')).toContainText('Unavailable without ground truth');
  await page.locator('#part4').screenshot({path:'artifacts/semantic-live.png'});expect(errors).toEqual([]);
});
test('mobile navigation, configurable links, image validation and accessibility work',async({page})=>{
  await page.setViewportSize({width:390,height:844});await ready(page);
  await page.getByRole('button',{name:'Open navigation'}).click();await expect(page.locator('#main-nav')).toBeVisible();await page.locator('#main-nav a[href="#experiments"]').click();await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded','false');
  await page.locator('#configure-links').click();await expect(page.locator('#links-dialog')).toBeVisible();await page.locator('#compilation-url').fill('https://example.org/labs/');await page.getByRole('button',{name:'Save links'}).click();await expect(page.locator('#links-dialog')).toBeHidden();await page.reload();await page.waitForFunction(()=>window.__LAB_READY__);await page.locator('#configure-links').click();await expect(page.locator('#compilation-url')).toHaveValue('https://example.org/labs/');await page.locator('#close-links').click();
  await page.locator('#threshold-upload').setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not a real image')});await expect(page.locator('#threshold-status')).toContainText('Cannot read this image');
  const size=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));expect(size.width).toBeLessThanOrEqual(size.viewport+1);
  await page.screenshot({path:'artifacts/mobile.png',fullPage:true});const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();await writeFile('artifacts/accessibility.json',JSON.stringify(accessibility.violations,null,2));expect(accessibility.violations).toEqual([]);
});
test('arbitrary project prefix and root both resolve bundled assets',async({page})=>{
  const response=await page.request.get('http://127.0.0.1:4179/');expect(response.ok()).toBeTruthy();
  for(const path of ['assets/models/deeplabv3-mobilenetv3.onnx','assets/vendor/ort-wasm-simd-threaded.wasm','assets/vendor/opencv.js','python/part1_thresholding.py','site-config.js']){const response=await page.request.head(path);expect(response.ok(),path).toBeTruthy();}
});
