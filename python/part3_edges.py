from pathlib import Path
import cv2
import numpy as np
import matplotlib.pyplot as plt

out = Path(__file__).resolve().parent / "outputs"
data_file = out / "part2_data.npz"
if not data_file.exists():
    raise FileNotFoundError("Run part2_regions.py first.")
data = np.load(data_file)
image, truth = data["image"], data["truth"]
blurred = cv2.GaussianBlur(image, (5, 5), 0)
edges = cv2.Canny(blurred, 50, 150)
closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
contours = [c for c in contours if cv2.contourArea(c) > 100]
mask = np.zeros_like(image)
cv2.drawContours(mask, contours, -1, 255, cv2.FILLED)
overlay = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
cv2.drawContours(overlay, contours, -1, (255, 0, 0), 2)

prediction = mask > 0
iou = np.count_nonzero(prediction & truth) / np.count_nonzero(prediction | truth)
print("External contours:", len(contours))
print(f"Filled-contour foreground IoU: {iou:.4f}")

# Compare borders on exactly the same image used in Part 2.
grown = data["grown"]
region_border = cv2.subtract(grown, cv2.erode(grown, np.ones((3, 3), np.uint8)))
watershed_border = np.uint8(data["watershed"] == -1) * 255
fig, axes = plt.subplots(2, 3, figsize=(12, 7))
for ax, title, result in zip(axes.flat,
    ["Input", "Canny edges", "Filled contours", "Contour overlay",
     "Region-growing border", "Watershed borders"],
    [image, edges, mask, overlay, region_border, watershed_border]):
    ax.imshow(result, cmap="gray", vmin=0, vmax=255)
    ax.set_title(title)
    ax.axis("off")
fig.tight_layout()
fig.savefig(out / "part3_edges.png", dpi=160)
cv2.imwrite(str(out / "part3_mask.png"), mask)
plt.show()
