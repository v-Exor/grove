import * as ort from './assets/vendor/ort.wasm.min.mjs';
ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;
ort.env.wasm.wasmPaths=new URL('./assets/vendor/',import.meta.url).href;
let session;let queue=Promise.resolve();
async function execute(data){
  const {id,model,input,width,height}=data;
  try{
    if(!session){
      postMessage({type:'status',id,message:'Loading the 44 MB DeepLabV3 model on this device…'});
      const response=await fetch(model.url);if(!response.ok)throw Error(`Model download failed (${response.status}). Check assets/models on your host.`);
      session=await ort.InferenceSession.create(await response.arrayBuffer(),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    }
    postMessage({type:'status',id,message:'Running the pretrained model on your image…'});
    const tensor=new ort.Tensor('float32',input,[1,3,height,width]);const start=performance.now();
    const outputs=await session.run({[session.inputNames[0]]:tensor});const output=outputs[session.outputNames[0]];
    const n=width*height,labels=new Uint8Array(n);
    for(let i=0;i<n;i++){let best=-Infinity,category=0;for(let c=0;c<21;c++){const score=output.data[c*n+i];if(score>best){best=score;category=c;}}labels[i]=category;}
    const milliseconds=performance.now()-start;tensor.dispose();Object.values(outputs).forEach(x=>x.dispose());
    postMessage({type:'result',id,labels,width,height,milliseconds},[labels.buffer]);
  }catch(error){postMessage({type:'error',id,message:`${error.message||error}`});}
}
self.onmessage=({data})=>{queue=queue.then(()=>execute(data));};
