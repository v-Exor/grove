"""Package source and the preserved Python evidence without caches or environments."""
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
excluded={'node_modules','.npm-cache','.model-cache','.export-deps','artifacts','test-results','playwright-report','dist','.git','__pycache__','model_cache','outputs','.venv'}

def write_zip(target,entries):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for source,name in entries:
            archive.write(source,name)

downloads=ROOT/'downloads';downloads.mkdir(exist_ok=True)
python_entries=[(file,file.name) for file in (ROOT/'python').iterdir() if file.is_file()]
python_entries.append((ROOT/'assets/samples/cat-garden.jpg','cat_scene.jpg'))
write_zip(downloads/'lab7-python-kit.zip',python_entries)
results=[(file,file.name) for file in (ROOT/'assets/results').glob('part*.png')]
write_zip(downloads/'lab7-original-results.zip',results)
entries=[]
for file in ROOT.rglob('*'):
    if not file.is_file() or any(part in excluded for part in file.relative_to(ROOT).parts):continue
    entries.append((file,str(file.relative_to(ROOT))))
target=ROOT.parent/'CSST106-Lab07-Website.zip'
write_zip(target,entries)
print(f'Complete source and website: {target} ({target.stat().st_size/1024/1024:.1f} MiB)')
