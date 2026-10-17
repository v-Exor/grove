# CSST106 Laboratory Activity 7 — Image Segmentation

Repository: https://github.com/v-Exor/grove

GitHub Pages: https://v-exor.github.io/grove/

An independent, buildless GitHub Pages website matching the existing VisionLab orange-and-white laboratory projects. This project contains **only Laboratory Activity 7**. Other laboratory directories are not required and have not been modified.

## Run locally

Use Node.js 22 or newer. Open this `lab-07` folder in VS Code and run:

```powershell
npm run dev
```

Open **http://127.0.0.1:4179/lab-07/**. A dependency install is not required to serve the website. Use HTTP rather than double-clicking `index.html`: workers, local fetches and model loading do not work reliably with `file://`.

Python can alternatively serve the files:

```powershell
python -m http.server 8000
```

Then open http://localhost:8000/ . The site uses relative URLs and works at the site root or under a repository path.

## Working experiments

1. **Thresholding:** grayscale conversion, real Otsu and Gaussian adaptive thresholds, sample/own-image input, editable block size/C/polarity, actual intensity histogram and controlled-shape IoU.
2. **Regions:** first-seed breadth-first region growing, editable intensity tolerance, canvas or keyboard seed entry, real OpenCV marker-based watershed, marker removal/reset, and foreground overlap on the touching-circle sample.
3. **Edges:** Gaussian blur, real Canny, morphological closing, contour area filtering/filling, and side-by-side borders from the same image and seeds as Part 2.
4. **Semantic:** actual local DeepLabV3 MobileNetV3 ONNX inference with 21 VOC categories, sample/own-image input, adjustable overlay opacity, class coverage legend, class-ID PNG export, and a real three-image annotated dataset evaluation with JSON export.

Original input/result comparisons, model provenance, source previews, all four original Python files, genuine recorded figures, analysis, the handout question/answers, A4 answer printing and conclusion are included. Model and runtime files are served from this repository, not a paid API or CDN. Uploaded images stay in memory on the visitor's device.

## Model and evaluation limits

- The original desktop Part 4 uses DeepLabV3 **ResNet50** with its official 520-pixel transform. The browser uses official DeepLabV3 **MobileNetV3 Large** weights exported to FP32 ONNX, approximately 42 MiB. Browser inputs have an approximate longest side of 384 pixels and dimensions rounded to multiples of 32. These outputs are measured and labeled separately.
- First inference loads the model and approximately 12 MB WASM runtime. It may take longer on a phone. WASM runs in a worker with one thread, so GitHub Pages does not need COOP/COEP headers. Model execution is real, including for uploads; no static mask is substituted.
- The model supports only the 20 VOC object classes plus background. Background does not mean that no other real object exists. Fine boundaries, small objects, and unfamiliar scenes can be inaccurate.
- Three real Oxford-IIIT Pet dog images and their pixel trimaps form a small annotated demonstration. Foreground is label 1; background is 2; ambiguous boundary label 3 is excluded. IoU compares predicted VOC dog ID 12 with pet foreground. Evaluation reports the mean of per-image foreground IoU, not full-dataset mean class IoU. This small subset is not a representative benchmark and is not claimed to be verified disjoint from all pretraining data.
- On arbitrary photographs, Part 2's Otsu-derived background markers can be imperfect. Region growing compares intensity with the first seed, not a continuously changing region mean.
- Classical scores evaluate foreground overlap, not instance separation. A merged region can have perfect foreground IoU. Pinterest images and uploads have no ground-truth mask, so semantic accuracy is not invented.
- No college logo, analytics, backend, webcam capture or training service is included. For an exact Python reproduction, use the downloadable kit. See [sources and licenses](assets/NOTICE.md).

## Connect your compilation website

Edit `site-config.js`:

```javascript
window.LAB_CONFIG = {
  compilationUrl: 'YOUR_ACTUAL_COMPILATION_HTTPS_URL',
  repositoryUrl: 'YOUR_ACTUAL_GITHUB_REPOSITORY_HTTPS_URL'
};
```

Replace both values with actual `https://` URLs. Do not leave these descriptive tokens in a deployed configuration. The compilation URL is initially blank and the repository URL points to this repository; clicking an unconfigured destination opens a functional settings dialog. The dialog stores overrides **only in that browser**. Edit the file to set published defaults for all visitors. No username, repository address, or compilation URL has been invented.

After GitHub Pages publishes, add its actual URL to the Activity 7 button in your separate compilation site:

```html
<a href="https://v-exor.github.io/grove/">
  Open Laboratory Activity 7
</a>
```

## Publish to your own GitHub repository

The authorized repository is https://github.com/v-Exor/grove . The deployment instructions below also apply to future updates or independent forks.

### Simple option: deploy directly from a branch

1. Create a new **public** repository for Activity 7 in your GitHub account (public repositories support Pages on GitHub Free).
2. Use **GitHub Desktop or Git** to commit and push this project's contents to the repository root. The 44 MB ONNX file exceeds GitHub's 25 MiB browser-upload limit, so uploading the entire project through the website's file picker will not work. `index.html`, `assets`, `downloads`, `python`, `scripts`, `site-config.js` and `styles.css` must be alongside each other. Do not nest everything inside a second `lab-07` directory.
3. Exclude `node_modules`, `.model-cache`, `.npm-cache`, `artifacts`, `test-results`, `dist`, virtual environments and the delivery ZIP. `.gitignore` handles these when using Git.
4. Open **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, select your default branch and **/(root)**, then save. For this option, omit `.github/workflows/pages.yml` from the upload; it is supplied for the Actions alternative below.
5. Open the URL GitHub reports. Its usual project-site format is `https://v-exor.github.io/grove/`. Add that actual URL to the main compilation website.

The `.nojekyll` file is included. All paths are relative; no SPA router or domain-specific base path is required. Every individual file is below GitHub's 100 MiB ordinary Git file limit, including the approximately 44 MB ONNX model. The browser file picker has a separate 25 MiB limit, which is why GitHub Desktop/Git is required for the complete project. Published static content is well below the 1 GB Pages site limit. Do not upload the original 160 MB ResNet50 checkpoint or Python environment. Do not use Git LFS pointers for the browser model. The downloadable ZIPs under `downloads/` must be committed as regular files; the supplied `.gitignore` permits them.

### Alternative: supplied GitHub Actions deployment

Keep `.github/workflows/pages.yml`, choose **GitHub Actions** in Settings → Pages, and push your source to the default branch. The workflow checks local assets, builds `dist` using Node's standard library, uploads only that static directory, and deploys it. It uses no paid service, npm build dependency, secret inference API, or backend. Manual **Run workflow** is also supported. Adjust the branch trigger if your default branch is neither `main` nor `master`.

## Tests and production packaging

Development dependencies are only for testing:

```powershell
npm install
npm run check
npm test
npm run test:e2e
```

Browser tests use installed Google Chrome. If unavailable, install a Playwright Chromium browser with `npx playwright install chromium` and remove `channel: 'chrome'` from `playwright.config.js`. Tests start/reuse a local server on port 4179. They cover actual algorithms, parameter validation, seed changes, uploads, downloads, real model inference, annotated evaluation, keyboard-accessible link settings, responsive navigation and WCAG checks.

Generate a deployable static directory and complete delivery ZIP:

```powershell
node scripts/build.mjs
python scripts/package-delivery.py
```

`dist/` is an optional ready-to-host copy; the root website is already production-ready and needs no compilation. The delivery ZIP includes the complete source and deployment configuration while excluding caches/development dependencies. The original Python kit and results ZIP are already bundled in `downloads/`.

## Recreate assets and validate model parity

Existing model and image files are included, so visitors and deployments do not run this step. For maintainers recreating the bundled ONNX model, install `torch`, `torchvision`, `onnx`, `onnxruntime`, `numpy`, `opencv-python` and `pillow` into a separate Python environment, then run:

```powershell
python scripts/prepare-content.py
```

This streams only enough of the official Oxford images archive for three samples, obtains corresponding official trimaps and species labels, downloads the official TorchVision weights, exports dynamic-shape ONNX opset 17, checks it, compares outputs with PyTorch on two image shapes, and generates genuine reference masks/IoU. Existing sample manifests are reused. Internet is needed for regeneration. `scripts/validate-browser.py` can compare the exact browser-generated tensor/labels saved by the browser test with native ONNX output.

## Troubleshooting

- **Blank outputs / fetch error:** use HTTP or GitHub Pages, not `file://`; verify that `assets/` was uploaded beside `index.html`.
- **Model download fails:** verify `assets/models/deeplabv3-mobilenetv3.onnx` is the actual 44 MB file, not a Git LFS pointer. Keep all three ONNX WASM files together in `assets/vendor`.
- **Slow semantic processing:** first inference includes model loading. Use smaller images and close heavy tabs. Browser speed is separate from the recorded desktop run.
- **Part 3 uses an earlier input:** select **Use Part 2 image & seeds** after changing Part 2. This snapshots the same image/markers for a meaningful comparison.
- **Unexpected region growing:** put the first seed inside the desired region, then adjust tolerance. Repeated intensity values can connect separate-looking areas.
- **Compilation button opens settings:** enter your real URL or update `site-config.js`. Local browser overrides can be cleared by saving empty values in the dialog.
- **Port 4179 is busy:** stop the previous preview or set `$env:PORT = '4180'` before `npm run dev`. Browser tests expect 4179 unless their configuration is updated.

See `SOURCE_MAP.md` for a requirement-by-requirement match and `VALIDATION.md` for the verification record.
