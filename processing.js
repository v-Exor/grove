/* Pure utilities and real OpenCV.js algorithms. Also usable in Node tests. */
(() => {
  const api = {};
  api.validate = (rgba, width, height) => {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 || width * height > 1048576 || rgba.length !== width * height * 4) throw Error('Use an image between 3 pixels and 1 megapixel.');
  };
  api.grayRGBA = array => {
    const result = new Uint8ClampedArray(array.length * 4);
    for (let i=0;i<array.length;i++) { result[4*i]=result[4*i+1]=result[4*i+2]=array[i]; result[4*i+3]=255; }
    return result;
  };
  api.regionGrow = (gray, width, height, seed, tolerance) => {
    if (!seed || seed.x<0 || seed.y<0 || seed.x>=width || seed.y>=height || !Number.isInteger(seed.x) || !Number.isInteger(seed.y)) throw Error('Choose a seed inside the image.');
    if (!Number.isFinite(tolerance) || tolerance<0 || tolerance>255) throw Error('Tolerance must be between 0 and 255.');
    const visited = new Uint8Array(width*height), output = new Uint8Array(width*height), queue = new Int32Array(width*height);
    let head=0, tail=0; const start=seed.y*width+seed.x, reference=gray[start]; queue[tail++]=start; visited[start]=1;
    while(head<tail) {
      const i=queue[head++]; if(Math.abs(gray[i]-reference)>tolerance)continue; output[i]=255;
      const x=i%width,y=Math.floor(i/width);
      const neighbors=[x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1];
      for(const n of neighbors)if(n>=0&&!visited[n]) {visited[n]=1;queue[tail++]=n;}
    }
    return output;
  };
  api.binaryIoU = (prediction, truth, valid=null) => {
    if(prediction.length!==truth.length || (valid&&valid.length!==truth.length))throw Error('Masks must have matching dimensions.');
    let intersection=0,union=0;
    for(let i=0;i<truth.length;i++)if(!valid||valid[i]) {const p=prediction[i]>0,t=truth[i]>0;intersection+=p&&t?1:0;union+=p||t?1:0;}
    return union?intersection/union:1;
  };
  api.semanticIoU = (labels, trimap, classId) => {
    const prediction=Uint8Array.from(labels,x=>x===classId?1:0),truth=Uint8Array.from(trimap,x=>x===1?1:0),valid=Uint8Array.from(trimap,x=>x!==3?1:0);
    return api.binaryIoU(prediction,truth,valid);
  };
  api.histogram = gray => {const hist=new Uint32Array(256);for(const v of gray)hist[v]++;return hist;};
  api.colorLabels = (labels,palette,original=null,alpha=.45) => {
    const result=new Uint8ClampedArray(labels.length*4);
    for(let i=0;i<labels.length;i++) {const color=palette[labels[i]]||[255,255,255];for(let c=0;c<3;c++)result[i*4+c]=original?(labels[i]?Math.round(original[i*4+c]*(1-alpha)+color[c]*alpha):original[i*4+c]):color[c];result[i*4+3]=255;}
    return result;
  };
  api.resizeLabels = (source,sw,sh,width,height) => {
    const out=new Uint8Array(width*height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)out[y*width+x]=source[Math.min(sh-1,Math.floor(y*sh/height))*sw+Math.min(sw-1,Math.floor(x*sw/width))];
    return out;
  };
  api.normalize = rgba => {
    const n=rgba.length/4,out=new Float32Array(n*3),mean=[.485,.456,.406],std=[.229,.224,.225];
    for(let i=0;i<n;i++)for(let c=0;c<3;c++)out[c*n+i]=(rgba[4*i+c]/255-mean[c])/std[c];
    return out;
  };
  api.processCV = (cv,rgba,width,height,p) => {
    api.validate(rgba,width,height);
    const allocations=[]; const mat=(...args)=>{const m=new cv.Mat(...args);allocations.push(m);return m;};
    const own=m=>{allocations.push(m);return m;};
    try {
      const src=own(cv.matFromArray(height,width,cv.CV_8UC4,rgba)),gray=mat(); cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
      const result={width,height,gray:new Uint8Array(gray.data),histogram:api.histogram(gray.data),images:{}};
      const save=(name,m)=>{result.images[name]=new Uint8Array(m.data);};
      if(p.part===1) {
        const block=Number(p.block),offset=Number(p.offset); if(block<3||block>255||block%2!==1||!Number.isInteger(block)||!Number.isFinite(offset)||offset < -50||offset>50)throw Error('Block size must be odd (3–255), with C between −50 and 50.');
        const otsu=mat(),adaptive=mat(); const mode=p.dark?cv.THRESH_BINARY_INV:cv.THRESH_BINARY;
        result.threshold=cv.threshold(gray,otsu,0,255,mode+cv.THRESH_OTSU);
        cv.adaptiveThreshold(gray,adaptive,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,mode,block,offset);
        save('otsu',otsu);save('adaptive',adaptive);return result;
      }
      const seeds=p.seeds; if(!Array.isArray(seeds)||!seeds.length||seeds.length>12)throw Error('Choose between 1 and 12 seeds.');
      for(const seed of seeds)if(!Number.isInteger(seed.x)||!Number.isInteger(seed.y)||seed.x<0||seed.y<0||seed.x>=width||seed.y>=height)throw Error('All seeds must be inside the image.');
      const grown=api.regionGrow(gray.data,width,height,seeds[0],Number(p.tolerance));
      result.images.grown=grown;
      const binary=mat();cv.threshold(gray,binary,0,255,(p.dark?cv.THRESH_BINARY_INV:cv.THRESH_BINARY)+cv.THRESH_OTSU);
      const markers=mat(height,width,cv.CV_32SC1,new cv.Scalar(0));
      for(let i=0;i<binary.data.length;i++)if(!binary.data[i])markers.data32S[i]=1;
      for(let j=0;j<seeds.length;j++)cv.circle(markers,new cv.Point(seeds[j].x,seeds[j].y),Math.max(2,Math.round(width/50)),new cv.Scalar(j+2),-1);
      const rgb=mat();cv.cvtColor(src,rgb,cv.COLOR_RGBA2RGB);cv.watershed(rgb,markers);
      result.labels=new Int32Array(markers.data32S);
      result.images.watershed=new Uint8Array(width*height);
      result.images.watershedBorder=new Uint8Array(width*height);
      result.images.regionBorder=new Uint8Array(width*height);
      result.objectLabels=[...new Set(result.labels)].filter(x=>x>1).sort((a,b)=>a-b);
      for(let i=0;i<result.labels.length;i++) {result.images.watershed[i]=result.labels[i]>1?255:0;result.images.watershedBorder[i]=result.labels[i]===-1?255:0;}
      const grownMat=own(cv.matFromArray(height,width,cv.CV_8UC1,grown)),eroded=mat(),kernel=own(cv.Mat.ones(3,3,cv.CV_8U));cv.erode(grownMat,eroded,kernel);
      for(let i=0;i<grown.length;i++)result.images.regionBorder[i]=grown[i]-eroded.data[i];
      if(p.part===2)return result;
      const low=Number(p.low),high=Number(p.high);if(!Number.isFinite(low)||!Number.isFinite(high)||low<0||high>255||low>=high)throw Error('Canny low threshold must be lower than the high threshold (0–255).');
      const blurred=mat(),edges=mat(),closed=mat(),mask=mat(height,width,cv.CV_8UC1,new cv.Scalar(0));
      cv.GaussianBlur(gray,blurred,new cv.Size(5,5),0);cv.Canny(blurred,edges,low,high);
      cv.morphologyEx(edges,closed,cv.MORPH_CLOSE,kernel);
      const contours=new cv.MatVector(),hierarchy=mat();allocations.push(contours);
      cv.findContours(closed,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
      const overlay=src.clone();allocations.push(overlay);let count=0;
      for(let i=0;i<contours.size();i++){const contour=contours.get(i);const area=cv.contourArea(contour);contour.delete();if(area>100){cv.drawContours(mask,contours,i,new cv.Scalar(255),-1);cv.drawContours(overlay,contours,i,new cv.Scalar(255,86,0,255),2);count++;}}
      save('edges',edges);save('contours',mask);result.overlay=new Uint8ClampedArray(overlay.data);result.contourCount=count;return result;
    } finally {for(const m of allocations.reverse())m.delete();}
  };
  globalThis.Lab7=api;
})();
