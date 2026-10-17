# Preserved Laboratory Activity 7 Python implementation

These four scripts are the original implementations from the completed laboratory conversation. Browser equivalents are in `processing.js` and the workers. The website uses DeepLabV3 MobileNetV3 for real browser inference; this original Python Part 4 uses DeepLabV3 ResNet50.

Create a virtual environment with Python 3.11 or another supported release:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install numpy opencv-python matplotlib pillow
.\.venv\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe part1_thresholding.py
.\.venv\Scripts\python.exe part2_regions.py
.\.venv\Scripts\python.exe part3_edges.py
.\.venv\Scripts\python.exe part4_semantic.py
```

Close each figure to continue. Run Part 2 before Part 3 because it saves `outputs/part2_data.npz`. Output paths are based on each script's own directory. Part 4 downloads the photo and the official pretrained model on first run. The downloadable Python kit includes the same `cat_scene.jpg` so only the pretrained weights require download. Do not upload the Python virtual environment or caches to GitHub Pages.

The four parts cover Otsu and adaptive thresholding, region growing and marker-based watershed, Canny and filled contours, and pretrained semantic segmentation. Additional annotated samples and their live evaluation belong to the browser extension described in the main README.
