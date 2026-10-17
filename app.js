const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const P = window.Lab7;
const state = {threshold:null,region:null,edge:null,semantic:null,model:null,samples:[],evaluation:null};
let sequence=0,cvWorker,cvReady,semanticWorker,toastTimer;
const cvPending=new Map(),semanticPending=new Map();
const regionPalette=[[255,255,255],[0,0,0],[255,122,60],[48,171,227],[143,104,200],[63,171,113],[225,120,166],[217,183,51],[78,179,177],[180,102,76],[112,132,216],[182,173,103],[195,122,210],[110,174,61]];

function status(id,message,mode='ready'){const el=$(id);el.textContent=message;el.dataset.state=mode;}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function blank(id,width=400,height=280,text='Run the experiment'){
  const canvas=$(id);canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f4ed';ctx.fillRect(0,0,width,height);ctx.fillStyle='#646953';ctx.font=`${Math.max(10,Math.min(15,width/24))}px Segoe UI`;ctx.textAlign='center';ctx.fillText(text,width/2,height/2);
}
function paint(id,rgba,width,height){const canvas=typeof id==='string'?$(id):id;canvas.width=width;canvas.height=height;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),width,height),0,0);}
function mono(id,array,width,height){paint(id,P.grayRGBA(array),width,height);}
function metrics(id,items){$(id).replaceChildren(...items.map(([name,value])=>{const el=document.createElement('span');el.append(name+' ');const strong=document.createElement('strong');strong.textContent=value;el.append(strong);return el;}));}
function busy(part,value){const el=$(`#part${part}`);el.setAttribute('aria-busy',String(value));all(`#part${part} input, #part${part} select, #part${part} button`).forEach(input=>{if(value){input.dataset.wasDisabled=String(input.disabled);input.disabled=true;}else{input.disabled=input.dataset.wasDisabled==='true';delete input.dataset.wasDisabled;}});}
function syncDownloads(){for(const [id,ready] of [['#download-threshold',state.threshold?.result],['#download-region',state.region?.result],['#download-edges',state.edge?.result],['#download-semantic',state.semantic?.result],['#download-labels',state.semantic?.result],['#download-evaluation',state.evaluation]])$(id).disabled=!ready;}
async function loadAction(part,statusId,loader){busy(part,true);status(statusId,'Loading your selected image…','busy');try{await loader();}catch(error){status(statusId,error.message,'error');}finally{busy(part,false);syncDownloads();}}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function downloadCanvas(id,name){$(id).toBlob(blob=>{if(blob)downloadBlob(blob,name);else toast('The image could not be exported.');},'image/png');}
function downloadJSON(value,name){downloadBlob(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),name);}
async function json(url){const response=await fetch(url);if(!response.ok)throw Error(`Could not load ${url} (${response.status}).`);return response.json();}
async function loadImage(url,maxSide=640){
  const image=new Image();image.src=url;await image.decode();if(image.naturalWidth<3||image.naturalHeight<3)throw Error('Choose an image at least 3 × 3 pixels.');
  const ratio=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(3,Math.round(image.naturalWidth*ratio)),height=Math.max(3,Math.round(image.naturalHeight*ratio));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='white';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
  return {width,height,rgba:context.getImageData(0,0,width,height).data,name:url.split('/').pop(),truth:null,seeds:[],result:null};
}
async function loadUpload(input){
  const file=input.files?.[0];if(!file)return null;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG, or WebP image.');
  if(file.size>20*1024*1024)throw Error('The file exceeds 20 MB. Choose a smaller image.');
  const url=URL.createObjectURL(file);try{const image=await loadImage(url);image.name=file.name;return image;}catch(error){throw Error(`Cannot read this image: ${error.message}`);}finally{URL.revokeObjectURL(url);input.value='';}
}
function cloneImage(image){return {...image,rgba:new Uint8ClampedArray(image.rgba),seeds:image.seeds.map(x=>({...x})),result:null};}
function bindMessages(worker,pending,onStatus){
  worker.onmessage=({data})=>{
    if(data.type==='status'){onStatus?.(data);return;}
    const request=pending.get(data.id);if(!request)return;
    clearTimeout(request.timer);pending.delete(data.id);
    if(data.type==='error')request.reject(Error(data.message));else request.resolve(data.result||data);
  };
  worker.onerror=()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Processing worker stopped. Reload the page and try again.'));}pending.clear();};
}
async function ensureCV(){
  if(cvReady)return cvReady;
  cvWorker=new Worker(new URL('./worker.js',import.meta.url));
  $('#engine-badge').textContent='Loading local OpenCV engine…';
  cvReady=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('OpenCV loading timed out. Reload this page using an HTTP server.')),60000);
    cvWorker.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timer);bindMessages(cvWorker,cvPending);$('#engine-badge').textContent='OpenCV ready · local processing';resolve();}else if(data.type==='engine-error'){clearTimeout(timer);reject(Error(data.message));}};
    cvWorker.onerror=()=>{clearTimeout(timer);reject(Error('Could not start OpenCV. Use the local preview server or GitHub Pages.'));};
  });
  return cvReady;
}
function request(worker,pending,payload,onProgress){
  const id=++sequence;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Processing timed out. Try a smaller image or reload the page.'));},180000);pending.set(id,{resolve,reject,timer,onProgress});worker.postMessage({...payload,id});});
}
async function runCV(image,parameters){await ensureCV();return request(cvWorker,cvPending,{type:'process',width:image.width,height:image.height,rgba:image.rgba.buffer,parameters});}
function histogram(gray,threshold){
  const canvas=$('#threshold-histogram'),ctx=canvas.getContext('2d'),hist=P.histogram(gray),maximum=Math.max(...hist,1);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fffdf8';ctx.fillRect(0,0,640,135);ctx.fillStyle='#c16b2c';
  for(let i=0;i<256;i++){const h=90*Math.log1p(hist[i])/Math.log1p(maximum);ctx.fillRect(18+i*2.34,107-h,2.5,h);}
  const x=18+threshold*2.34;ctx.strokeStyle='#4d6240';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x,109);ctx.stroke();ctx.font='11px Segoe UI';ctx.fillStyle='#525a47';ctx.fillText('0',16,125);ctx.fillText('255',597,125);ctx.fillText(`Otsu = ${threshold}`,Math.min(510,Math.max(25,x+8)),23);
}
async function thresholdSource(){
  const value=$('#threshold-source').value;
  const paths={uniform:'./assets/results/part1_0_input.png',uneven:'./assets/results/part1_1_input.png',garden:'./assets/samples/cat-garden.jpg'};
  const image=await loadImage(paths[value]);
  if(value!=='garden'){const mask=await loadImage('./assets/results/part1_0_otsu.png');image.truth=Uint8Array.from({length:mask.width*mask.height},(_,i)=>mask.rgba[i*4]);}
  state.threshold=image;showThresholdInput();return image;
}
function showThresholdInput(){const s=state.threshold;paint('#threshold-input',s.rgba,s.width,s.height);for(const id of ['#threshold-otsu','#threshold-adaptive'])blank(id,s.width,s.height);blank('#threshold-histogram',640,135,'Histogram appears after processing');$('#threshold-metrics').textContent='Run the experiment to measure the selected input and parameters.';$('#download-threshold').disabled=true;s.result=null;status('#threshold-status',`${s.name} · ${s.width} × ${s.height}. Ready to process.`);}
async function runThreshold(){
  if(!state.threshold)return;busy(1,true);status('#threshold-status','Applying real Otsu and Gaussian adaptive thresholds…','busy');
  try{const s=state.threshold;const result=await runCV(s,{part:1,block:Number($('#threshold-block').value),offset:Number($('#threshold-offset').value),dark:$('#threshold-tone').value==='dark'});s.result=result;mono('#threshold-input',result.gray,s.width,s.height);mono('#threshold-otsu',result.images.otsu,s.width,s.height);mono('#threshold-adaptive',result.images.adaptive,s.width,s.height);histogram(result.gray,result.threshold);$('#otsu-caption').textContent=`Global threshold = ${result.threshold}`;const values=[['Otsu threshold',String(result.threshold)],['Processing',`${result.milliseconds.toFixed(1)} ms`]];if(s.truth){values.push(['Otsu foreground IoU',P.binaryIoU(result.images.otsu,s.truth).toFixed(4)],['Adaptive foreground IoU',P.binaryIoU(result.images.adaptive,s.truth).toFixed(4)]);}else values.push(['Ground truth','Unavailable for this image']);metrics('#threshold-metrics',values);status('#threshold-status','Complete · computed on your device with OpenCV.js.','success');}
  catch(error){status('#threshold-status',error.message,'error');}
  finally{busy(1,false);$('#download-threshold').disabled=!state.threshold?.result;}
}
function defaultSeeds(image){return image.name==='touching.png'?[{x:140,y:140},{x:235,y:140}]:[{x:Math.floor(image.width*.4),y:Math.floor(image.height*.45)},{x:Math.floor(image.width*.65),y:Math.floor(image.height*.5)}];}
async function regionSource(){const source=$('#region-source').value;const image=await loadImage(source==='touching'?'./assets/samples/touching.png':'./assets/samples/cat-garden.jpg');image.seeds=defaultSeeds(image);if(source==='touching')image.truth=Uint8Array.from({length:image.width*image.height},(_,i)=>image.rgba[i*4]===200?255:0);state.region=image;showRegionInput();return image;}
function drawSeeds(){
  const s=state.region;if(!s)return;paint('#region-input',s.rgba,s.width,s.height);const ctx=$('#region-input').getContext('2d');const radius=Math.max(5,s.width/55);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${Math.max(10,s.width/32)}px Segoe UI`;
  s.seeds.forEach((seed,i)=>{ctx.beginPath();ctx.arc(seed.x,seed.y,radius,0,Math.PI*2);ctx.fillStyle='#b54800';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='white';ctx.fillText(String(i+1),seed.x,seed.y-15);});
  $('#seed-list').replaceChildren(...s.seeds.map((seed,i)=>{const el=document.createElement('span');el.className='seed-chip';el.append(`Seed ${i+1} · (${seed.x}, ${seed.y})`);const b=document.createElement('button');b.textContent='×';b.setAttribute('aria-label',`Remove seed ${i+1}`);b.addEventListener('click',()=>{s.seeds.splice(i,1);invalidateRegion();});el.append(b);return el;}));
  $('#seed-x').max=String(s.width-1);$('#seed-y').max=String(s.height-1);
}
function invalidateRegion(){state.region.result=null;drawSeeds();for(const id of ['#region-grown','#region-watershed'])blank(id,state.region.width,state.region.height);$('#region-metrics').textContent='Run again to measure the current markers and tolerance.';$('#download-region').disabled=true;status('#region-status','Markers or parameters changed. Run Grow & separate to update the results.');}
function showRegionInput(){const s=state.region;drawSeeds();for(const id of ['#region-grown','#region-watershed'])blank(id,s.width,s.height);$('#region-metrics').textContent='Your seed choices determine how the regions form.';$('#download-region').disabled=true;status('#region-status',`${s.name} · ${s.width} × ${s.height}. Place seeds inside the objects.`);}
function addSeed(x,y){const s=state.region;if(!s||$('#part2').getAttribute('aria-busy')==='true')return;if(s.seeds.length>=12){status('#region-status','Use at most 12 markers. Remove one before adding another.','error');return;}if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=s.width||y>=s.height){status('#region-status',`Seed coordinates must be inside 0–${s.width-1}, 0–${s.height-1}.`,'error');return;}if(s.seeds.some(seed=>seed.x===x&&seed.y===y)){status('#region-status','That seed position is already selected.','error');return;}s.seeds.push({x,y});invalidateRegion();}
function watershedColors(labels){const rgba=new Uint8ClampedArray(labels.length*4);for(let i=0;i<labels.length;i++){const color=labels[i]===-1?[255,255,255]:regionPalette[labels[i]]||[0,0,0];rgba.set([...color,255],i*4);}return rgba;}
async function runRegions(){
  if(!state.region)return;busy(2,true);status('#region-status','Growing from seed 1 and separating all watershed markers…','busy');
  try{const s=state.region;const result=await runCV(s,{part:2,seeds:s.seeds,tolerance:Number($('#region-tolerance').value),dark:$('#region-tone').value==='dark'});s.result=result;mono('#region-grown',result.images.grown,s.width,s.height);paint('#region-watershed',watershedColors(result.labels),s.width,s.height);const values=[['Watershed object regions',String(result.objectLabels.length)],['Processing',`${result.milliseconds.toFixed(1)} ms`]];if(s.truth)values.push(['Region foreground IoU',P.binaryIoU(result.images.grown,s.truth).toFixed(4)],['Watershed foreground IoU',P.binaryIoU(result.images.watershed,s.truth).toFixed(4)]);else values.push(['Ground truth','Unavailable for this image']);metrics('#region-metrics',values);status('#region-status','Complete · region growing uses the first seed; watershed uses all selected seeds.','success');}
  catch(error){status('#region-status',error.message,'error');}
  finally{busy(2,false);$('#download-region').disabled=!state.region?.result;}
}
function useRegionInput(){if(!state.region)return;state.edge=cloneImage(state.region);state.edge.tolerance=Number($('#region-tolerance').value);state.edge.dark=$('#region-tone').value==='dark';showEdgeInput();}
function showEdgeInput(){const s=state.edge;paint('#edge-input',s.rgba,s.width,s.height);for(const id of ['#edge-canny','#edge-filled','#edge-overlay','#edge-region','#edge-watershed'])blank(id,s.width,s.height);$('#edge-metrics').textContent='Run the experiment to compare contours and borders on this input.';$('#download-edges').disabled=true;status('#edge-status',`${s.name} · same image and ${s.seeds.length} marker(s) as the selected Part 2 input.`);}
async function runEdges(){
  if(!state.edge)return;busy(3,true);status('#edge-status','Detecting real edges, filling contours, and comparing region boundaries…','busy');
  try{const s=state.edge;const result=await runCV(s,{part:3,seeds:s.seeds,tolerance:s.tolerance,dark:s.dark,low:Number($('#canny-low').value),high:Number($('#canny-high').value)});s.result=result;mono('#edge-canny',result.images.edges,s.width,s.height);mono('#edge-filled',result.images.contours,s.width,s.height);paint('#edge-overlay',result.overlay,s.width,s.height);mono('#edge-region',result.images.regionBorder,s.width,s.height);mono('#edge-watershed',result.images.watershedBorder,s.width,s.height);const values=[['External contours',String(result.contourCount)],['Processing',`${result.milliseconds.toFixed(1)} ms`]];if(s.truth)values.push(['Filled-contour foreground IoU',P.binaryIoU(result.images.contours,s.truth).toFixed(4)]);metrics('#edge-metrics',values);status('#edge-status','Complete · edges and region borders were computed on the same input.','success');}
  catch(error){status('#edge-status',error.message,'error');}
  finally{busy(3,false);$('#download-edges').disabled=!state.edge?.result;}
}
async function semanticSource(){const sample=state.samples.find(x=>x.id===$('#semantic-source').value);if(!sample)return;const image=await loadImage(sample.url);image.sample=sample;if(sample.mask){const gt=await loadImage(sample.mask);const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const maskImage=new Image();maskImage.src=sample.mask;await maskImage.decode();const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(maskImage,0,0,image.width,image.height);const pixels=ctx.getImageData(0,0,image.width,image.height).data;image.trimap=Uint8Array.from({length:image.width*image.height},(_,i)=>pixels[4*i]);}state.semantic=image;showSemanticInput();return image;}
function showSemanticInput(){const s=state.semantic;paint('#semantic-input',s.rgba,s.width,s.height);for(const id of ['#semantic-classes','#semantic-overlay'])blank(id,s.width,s.height,'Run segmentation');$('#semantic-legend').replaceChildren();for(const id of ['#download-semantic','#download-labels'])$(id).disabled=true;$('#semantic-source-caption').textContent=s.sample?.mask?`Oxford-IIIT Pet · ${s.sample.species} annotation`:'No annotated ground truth';metrics('#semantic-metrics',[['Input',`${s.width} × ${s.height}`],['Ground truth',s.trimap?'Trimap available':'Unavailable']]);status('#semantic-status',`${s.name} is ready. The bundled model loads on your first run.`);}
function prepareTensor(image){const ratio=384/Math.max(image.width,image.height),width=Math.max(32,Math.round(image.width*ratio/32)*32),height=Math.max(32,Math.round(image.height*ratio/32)*32);const source=document.createElement('canvas');paint(source,image.rgba,image.width,image.height);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0,width,height);return {input:P.normalize(ctx.getImageData(0,0,width,height).data),width,height};}
async function infer(image,onProgress){
  if(!semanticWorker){semanticWorker=new Worker(new URL('./inference-worker.js',import.meta.url),{type:'module'});bindMessages(semanticWorker,semanticPending,data=>semanticPending.get(data.id)?.onProgress?.(data.message));}
  const tensor=prepareTensor(image);const result=await request(semanticWorker,semanticPending,{...tensor,model:state.model},onProgress);
  result.labels=P.resizeLabels(result.labels,result.width,result.height,image.width,image.height);result.inputWidth=tensor.width;result.inputHeight=tensor.height;
  if(image.trimap)result.foregroundIoU=P.semanticIoU(result.labels,image.trimap,image.sample.classId);return result;
}
function renderSemantic(){
  const s=state.semantic;if(!s?.result)return;const result=s.result,alpha=Number($('#semantic-opacity').value)/100;
  paint('#semantic-classes',P.colorLabels(result.labels,state.model.palette),s.width,s.height);paint('#semantic-overlay',P.colorLabels(result.labels,state.model.palette,s.rgba,alpha),s.width,s.height);
  const counts=new Map();for(const label of result.labels)counts.set(label,(counts.get(label)||0)+1);
  $('#semantic-legend').replaceChildren(...[...counts].sort((a,b)=>b[1]-a[1]).map(([id,count])=>{const el=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=`rgb(${state.model.palette[id].join(',')})`;el.append(swatch,`${id===0?'background':state.model.categories[id]} `);const small=document.createElement('small');small.textContent=`${(100*count/result.labels.length).toFixed(2)}%`;el.append(small);return el;}));
  const values=[['Model','DeepLabV3 MobileNetV3'],['Inference',`${result.milliseconds.toFixed(0)} ms`],['Network input',`${result.inputWidth} × ${result.inputHeight}`]];
  values.push(['Pet foreground IoU',result.foregroundIoU===undefined?'Unavailable without ground truth':result.foregroundIoU.toFixed(4)]);metrics('#semantic-metrics',values);
}
async function runSemantic(){
  if(!state.semantic||!state.model)return;busy(4,true);status('#semantic-status','Preparing your image for real model inference…','busy');
  try{const result=await infer(state.semantic,message=>status('#semantic-status',message,'busy'));state.semantic.result=result;renderSemantic();status('#semantic-status','Complete · live DeepLabV3 predictions computed on your device. Percentages describe pixel coverage, not accuracy.','success');}
  catch(error){status('#semantic-status',error.message,'error');}
  finally{busy(4,false);$('#download-semantic').disabled=!state.semantic?.result;$('#download-labels').disabled=!state.semantic?.result;}
}
async function evaluateDataset(){
  busy(4,true);state.evaluation=null;$('#download-evaluation').disabled=true;$('#dataset-progress').value=0;status('#dataset-status','Preparing three annotated images…');const records=[];
  try{const previous=state.semantic;for(const sample of state.samples.filter(x=>x.mask)){
      const image=await loadImage(sample.url);image.sample=sample;const mask=await loadImage(sample.mask);image.trimap=Uint8Array.from({length:mask.width*mask.height},(_,i)=>mask.rgba[i*4]);
      status('#dataset-status',`Processing ${sample.title} · ${records.length+1} / 3…`);const result=await infer(image,message=>status('#dataset-status',message));records.push({sample:sample.id,species:sample.species,foregroundIoU:result.foregroundIoU,inferenceMilliseconds:result.milliseconds});$('#dataset-progress').value=records.length;
    }
    state.semantic=previous;const mean=records.reduce((a,b)=>a+b.foregroundIoU,0)/records.length;state.evaluation={model:state.model.title,dataset:'Oxford-IIIT Pet · 3 selected annotated samples',metric:'Mean of per-image pet-class foreground IoU; trimap label 3 excluded',meanForegroundIoU:mean,records};
    const table=document.createElement('table');table.innerHTML='<caption>Live dataset evaluation · computed on this device</caption><thead><tr><th scope="col">Image</th><th scope="col">Pet class</th><th scope="col">Foreground IoU</th><th scope="col">Inference</th></tr></thead><tbody></tbody>';
    for(const row of records){const tr=document.createElement('tr');for(const value of [row.sample,row.species,row.foregroundIoU.toFixed(4),`${row.inferenceMilliseconds.toFixed(0)} ms`]){const td=document.createElement('td');td.textContent=value;tr.append(td);}table.tBodies[0].append(tr);}$('#dataset-evaluation').replaceChildren(table);status('#dataset-status',`Completed 3 / 3 · mean per-image foreground IoU = ${mean.toFixed(4)}. Boundary label 3 excluded.`,'success');
  }catch(error){status('#dataset-status',`Evaluation stopped: ${error.message}`,'error');}
  finally{busy(4,false);$('#download-evaluation').disabled=!state.evaluation;$('#download-semantic').disabled=!state.semantic?.result;$('#download-labels').disabled=!state.semantic?.result;}
}

// Public navigation exposes the compilation destination only.
document.querySelectorAll('[data-destination="compilation"]').forEach(button => button.addEventListener('click', () => {
  try {
    const url = new URL(window.LAB_CONFIG?.compilationUrl || '');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid compilation address.');
    window.location.assign(url.href);
  } catch { toast('The compilation link is not configured.'); }
}));

$('#menu-toggle').addEventListener('click',()=>{const open=$('#menu-toggle').getAttribute('aria-expanded')!=='true';$('#menu-toggle').setAttribute('aria-expanded',String(open));$('#main-nav').classList.toggle('open',open);$('#menu-toggle').setAttribute('aria-label',open?'Close navigation':'Open navigation');});
all('#main-nav a').forEach(link=>link.addEventListener('click',()=>{$('#main-nav').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');$('#menu-toggle').setAttribute('aria-label','Open navigation');}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){$('#main-nav').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');$('#menu-toggle').setAttribute('aria-label','Open navigation');}});
const sectionObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){all('#main-nav a').forEach(link=>link.classList.toggle('active',link.hash===`#${entry.target.id}`));}},{rootMargin:'-15% 0px -65% 0px'});all('main > section[id]').forEach(section=>sectionObserver.observe(section));
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const reveal=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');reveal.unobserve(e.target);}});},{threshold:.08});all('.reveal').forEach(el=>{el.classList.add('will-reveal');reveal.observe(el);});}
let openedForPrint=[];
$('#print-answers').addEventListener('click',()=>{document.body.classList.add('print-answers');openedForPrint=all('.qa-list details').filter(el=>!el.open);openedForPrint.forEach(el=>el.open=true);window.print();});
window.addEventListener('afterprint',()=>{document.body.classList.remove('print-answers');openedForPrint.forEach(el=>el.open=false);});

// Experiment controls.
$('#threshold-source').addEventListener('change',()=>loadAction(1,'#threshold-status',thresholdSource));
$('#run-threshold').addEventListener('click',runThreshold);
for(const id of ['#threshold-block','#threshold-offset','#threshold-tone'])$(id).addEventListener('change',()=>{if(state.threshold)showThresholdInput();});
$('#threshold-upload').addEventListener('change',event=>loadAction(1,'#threshold-status',async()=>{const image=await loadUpload(event.target);if(image){state.threshold=image;showThresholdInput();}}));
$('#download-threshold').addEventListener('click',()=>downloadCanvas('#threshold-adaptive','lab7-adaptive-mask.png'));
$('#region-source').addEventListener('change',()=>loadAction(2,'#region-status',regionSource));
$('#region-upload').addEventListener('change',event=>loadAction(2,'#region-status',async()=>{const image=await loadUpload(event.target);if(image){image.seeds=defaultSeeds(image);state.region=image;showRegionInput();}}));
$('#region-input').addEventListener('click',event=>{const s=state.region,rect=event.currentTarget.getBoundingClientRect();if(s)addSeed(Math.floor((event.clientX-rect.left)/rect.width*s.width),Math.floor((event.clientY-rect.top)/rect.height*s.height));});
$('#add-seed').addEventListener('click',()=>addSeed(Number($('#seed-x').value),Number($('#seed-y').value)));
$('#reset-seeds').addEventListener('click',()=>{if(state.region){state.region.seeds=defaultSeeds(state.region);invalidateRegion();}});
$('#clear-seeds').addEventListener('click',()=>{if(state.region){state.region.seeds=[];invalidateRegion();}});
for(const id of ['#region-tolerance','#region-tone'])$(id).addEventListener('change',()=>{if(state.region)invalidateRegion();});
$('#run-regions').addEventListener('click',runRegions);$('#download-region').addEventListener('click',()=>downloadCanvas('#region-watershed','lab7-watershed.png'));
$('#use-region-input').addEventListener('click',useRegionInput);$('#run-edges').addEventListener('click',runEdges);$('#download-edges').addEventListener('click',()=>downloadCanvas('#edge-filled','lab7-contour-mask.png'));
for(const id of ['#canny-low','#canny-high'])$(id).addEventListener('change',()=>{if(state.edge){state.edge.result=null;showEdgeInput();status('#edge-status','Thresholds changed. Run Detect & compare to update the result.');}});
$('#semantic-source').addEventListener('change',()=>loadAction(4,'#semantic-status',semanticSource));
$('#semantic-upload').addEventListener('change',event=>loadAction(4,'#semantic-status',async()=>{const image=await loadUpload(event.target);if(image){state.semantic=image;showSemanticInput();}}));
$('#run-semantic').addEventListener('click',runSemantic);$('#semantic-opacity').addEventListener('input',()=>{$('#semantic-opacity-value').value=`${$('#semantic-opacity').value}%`;renderSemantic();});
$('#download-semantic').addEventListener('click',()=>downloadCanvas('#semantic-overlay','lab7-semantic-overlay.png'));
$('#download-labels').addEventListener('click',()=>{const s=state.semantic;const canvas=document.createElement('canvas');paint(canvas,P.grayRGBA(s.result.labels),s.width,s.height);canvas.toBlob(blob=>downloadBlob(blob,'lab7-class-ids.png'),'image/png');});
$('#evaluate-dataset').addEventListener('click',evaluateDataset);$('#download-evaluation').addEventListener('click',()=>downloadJSON(state.evaluation,'lab7-dataset-evaluation.json'));

async function initialize(){
  const [model,references]=await Promise.all([json('./assets/models/manifest.json'),json('./assets/data/semantic-reference.json')]);state.model={...model,url:new URL(model.url,location.href).href};state.samples=references;
  $('#semantic-source').replaceChildren(...references.map(sample=>{const option=document.createElement('option');option.value=sample.id;option.textContent=sample.mask?`Oxford Pet · ${sample.title}`:'Pinterest · garden cat';return option;}));
  $('#semantic-reference-gallery').replaceChildren(...references.filter(x=>x.mask).map(sample=>{const figure=document.createElement('figure');const image=document.createElement('img');image.src=sample.overlay;image.alt=`Saved MobileNetV3 prediction for ${sample.title}`;image.width=400;image.height=300;image.loading='lazy';const caption=document.createElement('figcaption'),title=document.createElement('strong');title.textContent=sample.title;const p=document.createElement('p');p.textContent=`Recorded pet foreground IoU: ${sample.foregroundIoU.toFixed(4)} · boundary pixels excluded.`;const links=document.createElement('div');links.className='toolbar';for(const [text,url] of [['Original',sample.url],['Prediction',sample.classes],['Ground truth',sample.truthPreview]]){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.className='text-button';a.textContent=text;links.append(a);}caption.append(title,p,links);figure.append(image,caption);return figure;}));
  await Promise.all([thresholdSource(),regionSource(),semanticSource()]);useRegionInput();
  await runThreshold();await runRegions();await runEdges();
  window.__LAB_READY__=true;
}
window.Lab7App={state,prepareTensor,infer,runCV};
initialize().catch(error=>{status('#engine-badge','Some resources could not load');for(const id of ['#threshold-status','#region-status','#edge-status','#semantic-status'])status(id,`${error.message} Start the site with npm run dev, not file://.`,'error');window.__LAB_INIT_ERROR__=error.message;});
