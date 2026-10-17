import {readFile,stat,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);let count=0;
async function exists(path){const info=await stat(new URL(path,root));if(info.isFile()&&info.size===0&&path!=='.nojekyll')throw Error(`Empty asset: ${path}`);count++;return info;}
for(const file of ['index.html','styles.css','app.js','processing.js','worker.js','inference-worker.js','site-config.js','assets/models/manifest.json','assets/models/deeplabv3-mobilenetv3.onnx','assets/models/TORCHVISION-LICENSE.txt','assets/vendor/opencv.js','assets/vendor/OPENCV-LICENSE.txt','assets/vendor/ort.wasm.min.mjs','assets/vendor/ort-wasm-simd-threaded.mjs','assets/vendor/ort-wasm-simd-threaded.wasm','assets/vendor/ONNX-RUNTIME-LICENSE.txt','downloads/lab7-python-kit.zip','downloads/lab7-original-results.zip','downloads/lab7-answers.txt','README.md','SOURCE_MAP.md','VALIDATION.md'])await exists(file);
for(const file of ['app.js','processing.js','worker.js','inference-worker.js','site-config.js']){const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,root))],{encoding:'utf8'});if(result.status)throw Error(result.stderr);}
const html=await readFile(new URL('index.html',root),'utf8');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML IDs.');
for(const match of html.matchAll(/(?:href|src)="(\.\/[^"#]+)(?:#[^"]*)?"/g))await exists(match[1]);
for(const match of html.matchAll(/href="#([^"]+)"/g))if(!ids.includes(match[1]))throw Error(`Unknown anchor ${match[1]}`);
for(const part of [1,2,3,4])if(!ids.includes(`part${part}`))throw Error('A required experiment is missing.');
const model=JSON.parse(await readFile(new URL('assets/models/manifest.json',root),'utf8')),bytes=await readFile(new URL(model.url,root));
if(bytes.length!==model.bytes||createHash('sha256').update(bytes).digest('hex')!==model.sha256)throw Error('Model hash/size mismatch.');
if(model.categories.length!==21||model.categories[8]!=='cat'||model.categories[12]!=='dog')throw Error('VOC category mapping mismatch.');
const references=JSON.parse(await readFile(new URL('assets/data/semantic-reference.json',root),'utf8'));if(references.filter(x=>x.mask).length!==3)throw Error('The three annotated samples are missing.');
for(const item of references){for(const key of ['url','overlay','classes','mask','truthPreview'])if(item[key])await exists(item[key]);if(item.foregroundIoU!==undefined&&!(item.foregroundIoU>=0&&item.foregroundIoU<=1))throw Error('Invalid reference IoU.');}
const samples=JSON.parse(await readFile(new URL('assets/data/samples.json',root),'utf8'));
for(const sample of samples){const image=await readFile(new URL(sample.url,root));if(createHash('sha256').update(image).digest('hex')!==sample.sha256)throw Error('Sample hash mismatch.');}
if(!html.includes('Laboratory Activity 7')||html.includes('Laboratory Activity 6'))throw Error('Wrong activity identity.');
async function sizes(path){for(const entry of await readdir(path,{withFileTypes:true})){if(['node_modules','dist','.model-cache','.npm-cache','artifacts','test-results'].includes(entry.name))continue;const url=new URL(entry.name+(entry.isDirectory()?'/':''),path);if(entry.isDirectory())await sizes(url);else if((await stat(url)).size>=100*1024*1024)throw Error(`GitHub file exceeds 100 MiB: ${url.pathname}`);}}
await sizes(root);
console.log(`Passed ${count} asset checks, all script syntax, anchors/IDs, Lab 7 identity, 21 model classes, sample/model hashes, dataset annotations, and GitHub file-size limits.`);
