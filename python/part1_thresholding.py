from pathlib import Path
import cv2
import numpy as np
import matplotlib.pyplot as plt

out = Path(__file__).resolve().parent / "outputs"
out.mkdir(exist_ok=True)

# Custom sample images: no images are extracted from the Word file.
truth = np.zeros((220, 400), np.uint8)
cv2.circle(truth, (75, 105), 22, 255, -1)
cv2.rectangle(truth, (175, 83), (219, 127), 255, -1)
cv2.fillPoly(truth, [np.array([[295, 127], [320, 83], [345, 127]])], 255)
uniform = np.where(truth > 0, 45, 200).astype(np.uint8)
background = np.tile(np.linspace(70, 230, 400), (220, 1))
uneven = (background - 55 * (truth > 0)).astype(np.uint8)

def iou(prediction, target):
    p, t = prediction > 0, target > 0
    union = np.count_nonzero(p | t)
    return np.count_nonzero(p & t) / union if union else 1.0

fig, axes = plt.subplots(2, 3, figsize=(12, 6))
for row, (name, image) in enumerate([
    ("Uniform lighting", uniform), ("Uneven lighting", uneven)
]):
    input_file = out / f"part1_{row}_input.png"
    cv2.imwrite(str(input_file), image)
    image = cv2.imread(str(input_file), cv2.IMREAD_GRAYSCALE)
    threshold, otsu = cv2.threshold(
        image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    adaptive = cv2.adaptiveThreshold(
        image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 101, 5
    )
    print(f"{name}: Otsu threshold={threshold:.0f}, "
          f"Otsu IoU={iou(otsu, truth):.4f}, "
          f"Adaptive IoU={iou(adaptive, truth):.4f}")
    for col, (title, result) in enumerate([
        (name, image), ("Otsu", otsu), ("Adaptive", adaptive)
    ]):
        axes[row, col].imshow(result, cmap="gray", vmin=0, vmax=255)
        axes[row, col].set_title(title)
        axes[row, col].axis("off")
    cv2.imwrite(str(out / f"part1_{row}_otsu.png"), otsu)
    cv2.imwrite(str(out / f"part1_{row}_adaptive.png"), adaptive)

fig.tight_layout()
fig.savefig(out / "part1_thresholding.png", dpi=160)
plt.show()
