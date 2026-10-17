# Laboratory Activity 7 coverage

Primary source: the corrected `CSST106_Lab_Experiment_07_Segmetation.docx` provided by the user. Both the exercise and activity headings identify 7. The source document is not redistributed with the website and no school logo is used.

| Handout item | Website evidence |
| --- | --- |
| Understand/apply thresholding, region-based, edge-based, semantic methods and compare effectiveness | Overview, objectives, all four interactive modules, results and conclusion |
| Load grayscale input; apply Otsu and adaptive thresholds | Part 1 sample selector/upload, real OpenCV grayscale conversion, two mask canvases and histogram |
| Record results; discuss thresholding advantages/limits | Live threshold values/IoU, preserved original figures, observations and question answer |
| Implement region growing from selected seeds | Part 2 pure JavaScript breadth-first region growing with first-seed intensity tolerance, canvas clicks and keyboard coordinate entry |
| Watershed for touching objects | Real OpenCV.js marker-based watershed, distinct seed labels and white boundaries |
| Discuss seed selection and over-segmentation | Part 2 expandable explanation, editable markers, Q&A and analysis |
| Canny boundaries and contour-guided segmentation | Part 3 Gaussian blur, Canny, closing, external contour area filtering, filled masks |
| Compare borders with region-based methods | Same input and seeds used for Canny, region-growing border and watershed border canvases |
| Discuss sensitivity to noise/edge clarity | Part 3 explanation and analysis |
| Pretrained semantic model on complex image dataset | Actual DeepLabV3 MobileNetV3 ONNX inference on three annotated Oxford-IIIT Pet dataset photographs; supplemental Pinterest natural scene and uploads |
| Per-pixel labels and visualization | Class-map/overlay canvases, color legend, class-ID PNG download |
| Benefits of scene understanding | Part 4 explanation, overview, comparison answer and conclusion |
| Qualitative and quantitative comparison when annotations available | Controlled-shape IoU; real pet-class trimap IoU, ignored boundary pixels, three-image evaluation and JSON export |
| Use cases, limitations, computation and implementation challenges | Results analysis cards, module explanations, README model limitations |
| Written differences plus one advantage/limitation each on A4 | Questions section, A4 print button, downloadable answers text |
| Conclusion | Conclusion section and written answers |

## Preserved and extended behavior

The original four Python files and their genuine screenshots are preserved. The browser uses the same classical algorithms with a JavaScript region-growing implementation. Browser seed radii scale with image width; reference values apply to the default 400-pixel sample. The browser semantic model is a smaller MobileNetV3 backbone with resized input, rather than the original ResNet50/520-pixel transform. Its results are explicitly separate. The three annotated dog samples address the original single-photo dataset-scope gap. Their IoU values are a small demonstration, not a full-dataset score or proof of training/test independence.

All interactive processing is real. Recorded output galleries are marked as recorded. GitHub Pages executes no Python, server inference, or training. Uploads are processed locally and are not added to the repository.
