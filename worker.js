importScripts('./processing.js');
let engine;
const ready=new Promise((resolve,reject)=>{
  try{
    importScripts('./assets/vendor/opencv.js');
    const module=self.cv;
    if(module&&module.Mat)resolve({cv:module});
    else if(module&&typeof module.then==='function')module.then(cv=>resolve({cv}),reject);
    else if(module)module.onRuntimeInitialized=()=>resolve({cv:module});
    else reject(Error('OpenCV could not load.'));
  }catch(error){reject(error);}
});
ready.then(({cv})=>{engine=cv;postMessage({type:'ready'});}).catch(error=>postMessage({type:'engine-error',message:String(error.message||error)}));
self.onmessage=async({data})=>{
  if(data.type!=='process')return;
  try{await ready;const start=performance.now();const result=Lab7.processCV(engine,new Uint8ClampedArray(data.rgba),data.width,data.height,data.parameters);result.milliseconds=performance.now()-start;postMessage({type:'result',id:data.id,result});}
  catch(error){postMessage({type:'error',id:data.id,message:typeof error==='number'?'OpenCV could not process this image. Try a smaller image.':String(error.message||error)});}
};
