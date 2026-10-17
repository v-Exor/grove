from pathlib import Path
from collections import deque
import cv2
import numpy as np
import matplotlib.pyplot as plt

out = Path(__file__).resolve().parent / "outputs"
out.mkdir(exist_ok=True)
image = np.full((280, 400), 30, np.uint8)
seeds = [(140, 140), (235, 140)]  # (x, y), one inside each circle
for center in seeds:
    cv2.circle(image, center, 60, 200, -1)
truth = image == 200

def region_grow(gray, seed, tolerance=15):
    x, y = seed
    reference = int(gray[y, x])
    seen = np.zeros(gray.shape, bool)
    mask = np.zeros_like(gray)
    queue = deque([(y, x)])
    seen[y, x] = True
    while queue:
        y, x = queue.popleft()
        if abs(int(gray[y, x]) - reference) > tolerance:
            continue
        mask[y, x] = 255
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y + dy, x + dx
            if 0 <= ny < gray.shape[0] and 0 <= nx < gray.shape[1]:
                if not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
    return mask

grown = region_grow(image, seeds[0])
grown_second = region_grow(image, seeds[1])

# Background is label 1; object seeds are labels 2 and 3.
markers = np.zeros(image.shape, np.int32)
_, foreground = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
markers[foreground == 0] = 1
for label, center in enumerate(seeds, start=2):
    cv2.circle(markers, center, 8, label, -1)
labels = cv2.watershed(cv2.cvtColor(image, cv2.COLOR_GRAY2BGR), markers)
colors = np.zeros((*image.shape, 3), np.uint8)
colors[labels == 2] = (255, 120, 60)
colors[labels == 3] = (60, 180, 255)
colors[labels == -1] = (255, 255, 255)
watershed_mask = labels > 1

def iou(prediction):
    return np.count_nonzero(prediction & truth) / np.count_nonzero(prediction | truth)

print(f"Region-growing foreground IoU: {iou(grown > 0):.4f}")
print(f"Watershed foreground IoU: {iou(watershed_mask):.4f}")
print("Same region from either seed:", np.array_equal(grown, grown_second))
print("Watershed object labels:", np.unique(labels[labels > 1]).tolist())
np.savez(out / "part2_data.npz", image=image, truth=truth,
         grown=grown, watershed=labels)

fig, axes = plt.subplots(1, 3, figsize=(12, 4))
for ax, title, result in zip(axes, ["Input and seeds", "Region growing", "Watershed"],
                             [image, grown, colors]):
    ax.imshow(result, cmap="gray", vmin=0, vmax=255)
    ax.set_title(title)
    ax.axis("off")
for x, y in seeds:
    axes[0].plot(x, y, "r+")
fig.tight_layout()
fig.savefig(out / "part2_regions.png", dpi=160)
plt.show()
