import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../processing.js';
const P=globalThis.Lab7;
test('region growing crosses touching equal-intensity pixels but not disconnected or dissimilar pixels',()=>{
  const image=Uint8Array.from([0,0,0,0,0,0,100,102,140,0,0,101,0,0,100,0,0,0,0,0]);
  const mask=P.regionGrow(image,5,4,{x:1,y:1},3);
  assert.equal(mask.reduce((n,x)=>n+(x>0),0),3);assert.equal(mask[8],0);assert.equal(mask[14],0);
});
test('trimap evaluation ignores ambiguous borders and counts wrong-class foreground as missed',()=>{
  assert.equal(P.semanticIoU(Uint8Array.from([12,12,12,8]),Uint8Array.from([1,3,2,1]),12),1/3);
  assert.equal(P.binaryIoU([0,0],[0,0]),1);
});
test('class IDs retain nearest-neighbor geometry when resized',()=>{
  assert.deepEqual([...P.resizeLabels([0,8,12,20],2,2,4,2)],[0,0,8,8,12,12,20,20]);
});
test('tensor conversion uses RGB channel order, scaling and ImageNet normalization',()=>{
  const x=P.normalize(Uint8Array.from([255,0,128,255,0,255,64,255]));
  assert.ok(Math.abs(x[0]-(1-.485)/.229)<1e-6);assert.ok(Math.abs(x[3]-(1-.456)/.224)<1e-6);
  assert.equal(x.length,6);
});
test('bad dimensions and out-of-bounds seeds fail clearly',()=>{
  assert.throws(()=>P.validate([],0,2),/image/);
  assert.throws(()=>P.regionGrow(new Uint8Array(9),3,3,{x:3,y:0},15),/seed/);
  assert.throws(()=>P.binaryIoU([1],[0,1]),/matching/);
});
