"""Compare the exact tensor and class IDs saved by the real browser test."""
from pathlib import Path
import json
import os
import sys

ROOT=Path(__file__).resolve().parents[1]
if os.environ.get('LAB_EXPORT_DEPS'):
    sys.path.insert(0,os.environ['LAB_EXPORT_DEPS'])
import numpy as np
import cv2
import onnxruntime as ort

geometry=json.loads((ROOT/'artifacts/browser-geometry.json').read_text())
tensor=np.fromfile(ROOT/'artifacts/browser-input.bin',dtype=np.float32).reshape(1,3,geometry['height'],geometry['width'])
browser=np.fromfile(ROOT/'artifacts/browser-labels.bin',dtype=np.uint8).reshape(geometry['outputHeight'],geometry['outputWidth'])
session=ort.InferenceSession(str(ROOT/'assets/models/deeplabv3-mobilenetv3.onnx'),providers=['CPUExecutionProvider'])
native=session.run(None,{'image':tensor})[0].argmax(1)[0].astype(np.uint8)
native=cv2.resize(native,(geometry['outputWidth'],geometry['outputHeight']),interpolation=cv2.INTER_NEAREST)
agreement=float(np.mean(native==browser))
assert agreement>.999,agreement
report={'source':'exact browser-generated RGB normalized tensor and browser class-ID output',
        'browserRuntime':'ONNX Runtime Web 1.23.2 · single-thread WASM',
        'nativeRuntime':ort.__version__,'pixelLabelAgreement':agreement,
        'inputShape':list(tensor.shape),'comparedPixels':int(browser.size)}
(ROOT/'artifacts/browser-native-parity.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
