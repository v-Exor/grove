"""Reproduce the browser model, annotated dataset subset, and reference evidence."""
from pathlib import Path
import hashlib
import io
import json
import os
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
# Optional environment path for local development only; never needed by the website.
if os.environ.get('LAB_EXPORT_DEPS'):
    sys.path.insert(0, os.environ['LAB_EXPORT_DEPS'])
import cv2
import numpy as np
from PIL import Image
import torch
import torch.nn as nn
from torchvision.models.segmentation import (
    deeplabv3_mobilenet_v3_large, DeepLabV3_MobileNet_V3_Large_Weights
)

SAMPLES = ROOT / 'assets/samples'
RESULTS = ROOT / 'assets/results'
DATA = ROOT / 'assets/data'
MODELS = ROOT / 'assets/models'
for path in [SAMPLES, RESULTS, DATA, MODELS]:
    path.mkdir(parents=True, exist_ok=True)
torch.hub.set_dir(str(ROOT / '.model-cache'))
torch.set_num_threads(4)

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'CSST106-Lab7/1.0'}), timeout=120)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def pet_samples():
    manifest = DATA / 'samples.json'
    if manifest.exists():
        return json.loads(manifest.read_text())
    selected = []
    # Stream the archive and stop after three photos; do not download 800 MB.
    with get('https://thor.robots.ox.ac.uk/~vgg/data/pets/images.tar.gz') as response:
        with tarfile.open(fileobj=response, mode='r|gz') as archive:
            for member in archive:
                if member.isfile() and member.name.lower().endswith('.jpg'):
                    name = Path(member.name).stem
                    content = archive.extractfile(member).read()
                    image = Image.open(io.BytesIO(content)).convert('RGB')
                    if min(image.size) < 50:
                        continue
                    image.save(SAMPLES / f'{name}.jpg', quality=95)
                    selected.append({'id': name, 'title': name.replace('_', ' '),
                                     'url': f'./assets/samples/{name}.jpg',
                                     'mask': f'./assets/samples/{name}-trimap.png',
                                     'source': 'Oxford-IIIT Pet', 'width': image.width, 'height': image.height})
                    if len(selected) == 3:
                        break
    with get('https://thor.robots.ox.ac.uk/~vgg/data/pets/annotations.tar.gz') as response:
        content = response.read()
    with tarfile.open(fileobj=io.BytesIO(content), mode='r:gz') as archive:
        label_text = archive.extractfile('annotations/list.txt').read().decode()
        species = {row.split()[0]: int(row.split()[2]) for row in label_text.splitlines() if row and not row.startswith('#')}
        for item in selected:
            mask = archive.extractfile(f"annotations/trimaps/{item['id']}.png").read()
            (SAMPLES / f"{item['id']}-trimap.png").write_bytes(mask)
            item['classId'] = 8 if species[item['id']] == 1 else 12
            item['species'] = 'cat' if item['classId'] == 8 else 'dog'
            item['sha256'] = sha(SAMPLES / f"{item['id']}.jpg")
    manifest.write_text(json.dumps(selected, indent=2))
    print('Prepared three genuine annotated Oxford-IIIT Pet samples.', flush=True)
    return selected

class OutputOnly(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, image):
        return self.model(image)['out']

def main():
    samples = pet_samples()
    weights = DeepLabV3_MobileNet_V3_Large_Weights.DEFAULT
    model = OutputOnly(deeplabv3_mobilenet_v3_large(weights=weights, progress=False).eval()).eval()
    model_file = MODELS / 'deeplabv3-mobilenetv3.onnx'
    if not model_file.exists():
        torch.onnx.export(model, torch.zeros(1, 3, 256, 384), str(model_file),
                          input_names=['image'], output_names=['logits'], opset_version=17,
                          dynamic_axes={'image': {2: 'height', 3: 'width'}, 'logits': {2: 'height', 3: 'width'}},
                          dynamo=False)
    import onnx
    import onnxruntime as ort
    onnx.checker.check_model(str(model_file))
    session = ort.InferenceSession(str(model_file), providers=['CPUExecutionProvider'])
    rng = np.random.default_rng(7)
    errors = []
    for h, w in [(192, 320), (320, 192)]:
        tensor = rng.normal(0, 1, (1, 3, h, w)).astype(np.float32)
        with torch.inference_mode():
            expected = model(torch.from_numpy(tensor)).numpy()
        actual = session.run(None, {'image': tensor})[0]
        error = float(np.abs(actual - expected).max())
        assert np.allclose(actual, expected, atol=.002, rtol=.001), error
        errors.append({'height': h, 'width': w, 'maxAbsoluteError': error})
    colors = np.array([[0,0,0],[128,0,0],[0,128,0],[128,128,0],[0,0,128],[128,0,128],
        [0,128,128],[128,128,128],[64,0,0],[192,0,0],[64,128,0],[192,128,0],[64,0,128],
        [192,0,128],[64,128,128],[192,128,128],[0,64,0],[128,64,0],[0,192,0],[128,192,0],[0,64,128]],np.uint8)
    colors[8] = [168,92,215]
    colors[12] = [30,155,200]
    reference = []
    for item in samples + [{'id':'cat-garden','title':'Pinterest garden cat','url':'./assets/samples/cat-garden.jpg','source':'Pinterest'}]:
        image = np.asarray(Image.open(ROOT / item['url'][2:]).convert('RGB'))
        h, w = image.shape[:2]
        ratio = 384 / max(h, w)
        ih, iw = max(32, round(h * ratio / 32) * 32), max(32, round(w * ratio / 32) * 32)
        resized = cv2.resize(image, (iw, ih), interpolation=cv2.INTER_LINEAR)
        tensor = resized.astype(np.float32) / 255
        tensor = ((tensor - np.array([.485,.456,.406],np.float32)) / np.array([.229,.224,.225],np.float32)).transpose(2,0,1)[None]
        logits = session.run(None, {'image': tensor})[0]
        small_labels = logits.argmax(1)[0].astype(np.uint8)
        labels = cv2.resize(small_labels, (w,h), interpolation=cv2.INTER_NEAREST)
        colored = colors[labels]
        overlay = image.copy()
        fg = labels > 0
        overlay[fg] = (.55 * image[fg] + .45 * colored[fg]).astype(np.uint8)
        Image.fromarray(overlay).save(RESULTS / f"{item['id']}-mobile-overlay.webp", quality=90)
        Image.fromarray(colored).save(RESULTS / f"{item['id']}-mobile-classes.png")
        Image.fromarray(labels).save(RESULTS / f"{item['id']}-mobile-ids.png")
        record = {'id':item['id'], 'title':item['title'], 'url':item['url'], 'source':item['source'],
                  'overlay':f"./assets/results/{item['id']}-mobile-overlay.webp",
                  'classes':f"./assets/results/{item['id']}-mobile-classes.png",
                  'inputShape':[1,3,ih,iw],
                  'coverage':{weights.meta['categories'][int(c)]:float(np.mean(labels==c)) for c in np.unique(labels)}}
        if item.get('mask'):
            gt = np.asarray(Image.open(ROOT/item['mask'][2:]))
            valid = gt != 3
            target, prediction = gt == 1, labels == item['classId']
            intersection = np.count_nonzero(valid & target & prediction)
            union = np.count_nonzero(valid & (target | prediction))
            record.update(mask=item['mask'], species=item['species'], classId=item['classId'],
                          foregroundIoU=float(intersection/union), ignoredBoundaryPixels=int(np.count_nonzero(~valid)))
            preview = np.zeros((*gt.shape,3),np.uint8)
            preview[gt==1]=colors[item['classId']]
            preview[gt==3]=[220,220,220]
            Image.fromarray(preview).save(RESULTS / f"{item['id']}-truth.png")
            record['truthPreview']=f"./assets/results/{item['id']}-truth.png"
        reference.append(record)
    manifest = {'title':'DeepLabV3 · MobileNetV3 Large', 'url':'./assets/models/deeplabv3-mobilenetv3.onnx',
                'bytes':model_file.stat().st_size,'sha256':sha(model_file), 'categories':weights.meta['categories'],
                'palette':colors.tolist(),'maxSide':384,'format':'FP32 ONNX opset 17 · dynamic spatial dimensions',
                'weights':'COCO_WITH_VOC_LABELS_V1','source':'https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.segmentation.deeplabv3_mobilenet_v3_large.html'}
    (MODELS/'manifest.json').write_text(json.dumps(manifest,indent=2))
    (DATA/'semantic-reference.json').write_text(json.dumps(reference,indent=2))
    (ROOT/'artifacts/model-parity.json').write_text(json.dumps(errors,indent=2))
    print(json.dumps({'modelBytes':model_file.stat().st_size,'samples':reference,'parity':errors},indent=2),flush=True)

if __name__ == '__main__':
    main()
