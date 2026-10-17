"""Verify delivery ZIP integrity, safe paths, required assets, and production parity."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]
archive_path=ROOT.parent/'CSST106-Lab07-Website.zip'
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None, 'ZIP CRC verification failed'
    names=archive.namelist()
    for name in names:
        path=PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts, name
        assert not any(part in {'node_modules','.model-cache','.npm-cache','artifacts','test-results','.venv','dist'} for part in path.parts),name
    required=['index.html','package.json','README.md','site-config.js','.nojekyll','.github/workflows/pages.yml',
              'assets/models/deeplabv3-mobilenetv3.onnx','assets/vendor/opencv.js',
              'assets/vendor/ort-wasm-simd-threaded.wasm','downloads/lab7-python-kit.zip',
              'downloads/lab7-original-results.zip','tests/site.spec.js','scripts/build.mjs']
    for name in required:
        assert name in names,name
        assert archive.read(name)==(ROOT/name).read_bytes(),f'Stale package file: {name}'
    model=json.loads(archive.read('assets/models/manifest.json'))
    assert hashlib.sha256(archive.read('assets/models/deeplabv3-mobilenetv3.onnx')).hexdigest()==model['sha256']
dist=ROOT/'dist'
for file in dist.rglob('*'):
    if file.is_file():
        relative=file.relative_to(dist)
        assert file.read_bytes()==(ROOT/relative).read_bytes(),f'Production copy mismatch: {relative}'
with zipfile.ZipFile(ROOT/'downloads/lab7-python-kit.zip') as kit:
    assert kit.testzip() is None
    for name in ['part1_thresholding.py','part2_regions.py','part3_edges.py','part4_semantic.py','cat_scene.jpg']:
        assert name in kit.namelist(),name
print(f'Verified {len(names)} delivery entries, ZIP CRCs, safe paths, no environments/caches, exact model hash, Python kit, and production byte parity.')
