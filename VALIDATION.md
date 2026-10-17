# Verification record — Laboratory Activity 7

Validated locally on 17 October 2026 (Asia/Manila), before the user authorized GitHub publication. The authorized repository is https://github.com/v-Exor/grove . This record describes the completed local verification; publication status is checked separately.

## Requirement audit

The corrected Word document identifies Laboratory Exercise No. 7 and Laboratory Activity 7, Segmentation Technique. `SOURCE_MAP.md` maps every procedure, analysis item, written question, and conclusion to the website. The website covers only this activity. Other laboratory projects were inspected for visual continuity and existing runtime assets but were not modified.

## Actual processing

- Five Node algorithm tests pass: connected intensity region growing, ignored-boundary semantic IoU, nearest-neighbor label geometry, normalized RGB channel ordering, and invalid inputs.
- Six Chrome browser tests pass: startup/console, Otsu/adaptive illumination behavior, invalid parameters, image uploads/downloads, seed changes and over-segmentation, shared region/edge input, real semantic inference, annotated evaluation, local URL settings, corrupt-image handling, responsive navigation, accessibility, and root/project-prefix resource loading.
- Parts 1–3 automatically compute the default examples using the actual bundled OpenCV engine and JavaScript region-growing function. Original measurements are reproduced on the controlled samples; the uneven Otsu sample yields foreground IoU 0.1003 while adaptive yields 1.0000.
- Region growing produces one connected foreground. With two seeds, real OpenCV watershed produces two object regions. Adding a third seed produces three regions. Canny and external-contour filling produce one shared outer region on the touching-circle image.
- Real browser DeepLabV3 inference was tested on an annotated dog sample and a user-file upload of the garden cat. No saved output was substituted for inference. Downloaded class IDs, overlays, adaptive masks and evaluation JSON are generated from the real computed results.

## Semantic numerical evidence

The browser model is the official pretrained DeepLabV3 MobileNetV3 Large exported to dynamic-shape FP32 ONNX opset 17. Its file is 44,097,396 bytes; its SHA-256 hash is in `assets/models/manifest.json`.

- PyTorch versus native ONNX maximum logit error: 0.000027657 on 192 × 320 input and 0.000021935 on 320 × 192 input.
- The **exact browser-generated RGB tensor** was replayed in native ONNX Runtime. Browser and native output class IDs agree on **100% of 178,500 compared pixels** for the tested image. This validates conversion and runtime consistency for that sample, not model accuracy in general.
- The actual three-image browser evaluation produced foreground IoU of approximately 0.9845 (boxer_16), 0.9730 (chihuahua_165), and 0.9877 (pug_183); mean per-image foreground IoU approximately **0.9817**. Oxford trimap boundary label 3 was excluded. This small subset is not a full benchmark or a verified pretraining-disjoint test set.
- Saved Python MobileNetV3 reference scores differ slightly from browser scores because image resizing uses native OpenCV versus browser Canvas interpolation. Exact-input model parity is checked separately.

The original DeepLabV3 ResNet50 code and genuine recorded output remain intact. Its garden-cat pixel coverage of 9.46% is reported as coverage, not accuracy, and is not assigned to the browser model.

## Interface and accessibility

- Screenshots inspected for the desktop hero, thresholding, regions and live semantic output, plus phone hero and semantic layout.
- No horizontal document overflow at viewport widths 320, 390, 768, 1024 and 1440 pixels.
- Automated axe WCAG 2 A/AA and WCAG 2.1 AA checks report zero violations on the tested desktop and phone states. These automated checks do not replace a full manual assistive-technology audit.
- Main navigation, native controls, keyboard seed coordinates, details, configurable URL dialog and focus indicators are present. Wide tables have labeled keyboard-focusable scroll regions. Reduced-motion settings disable reveal transitions.
- The A4 answer button opens all four written answers and prints the question/answers plus conclusion with A4 page CSS. No print job is submitted automatically.

## Deployment preparation

All runtime, model, sample, stylesheet, script, Python, archive and manifest paths are relative. Root and `/lab-07/` previews load. The ONNX file is below the ordinary 100 MB GitHub individual-file limit. The site is below the 1 GB Pages site limit. A buildless branch deployment and an optional static GitHub Actions workflow are documented.

The build and ZIP exclude environments, caches, temporary browser traces and private local material. The repository URL is configured to the authorized v-Exor/grove repository. The compilation URL remains blank and configurable; no compilation address has been invented. All processing stays in the browser, with no server inference API, CDN dependency, analytics, or school logo.
