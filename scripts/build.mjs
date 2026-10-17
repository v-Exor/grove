import {mkdir,cp,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const destination=join(root,'dist');
await mkdir(destination,{recursive:true});
// Copy only explicitly selected public files; no cache, environment or test artifact.
const files=['index.html','styles.css','site-config.js','processing.js','app.js','worker.js','inference-worker.js','.nojekyll','README.md','SOURCE_MAP.md','VALIDATION.md'];
for(const path of [...files,'assets','downloads','python'])await cp(join(root,path),join(destination,path),{recursive:true});
await mkdir(join(destination,'scripts'),{recursive:true});
for(const path of ['prepare-content.py','validate-browser.py'])await cp(join(root,'scripts',path),join(destination,'scripts',path));
let total=0,count=0;async function visit(path){for(const item of await readdir(path,{withFileTypes:true})){if(item.isDirectory())await visit(join(path,item.name));else{total+=(await stat(join(path,item.name))).size;count++;}}}await visit(destination);
console.log(`Production static directory: ${destination}\n${count} files · ${(total/1024/1024).toFixed(1)} MiB. No compilation or backend needed.`);
