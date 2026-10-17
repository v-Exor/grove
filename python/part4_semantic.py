from pathlib import Path
from urllib.request import Request, urlopen
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from PIL import Image
import torch
import torch.nn.functional as F
from torchvision.models.segmentation import (
    deeplabv3_resnet50, DeepLabV3_ResNet50_Weights
)

root = Path(__file__).resolve().parent
out = root / "outputs"
out.mkdir(exist_ok=True)
image_file = root / "cat_scene.jpg"
# Pinterest source: https://www.pinterest.com/pin/767230486530724908/
url = "https://i.pinimg.com/736x/62/bf/8b/62bf8bc16f205d7e93353f900853ceeb.jpg"
if not image_file.exists():
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=60) as response:
        image_file.write_bytes(response.read())

image = Image.open(image_file).convert("RGB")
image.thumbnail((800, 800))
weights = DeepLabV3_ResNet50_Weights.DEFAULT
# Downloaded once, then cached in this project.
torch.hub.set_dir(str(root / "model_cache"))
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = deeplabv3_resnet50(weights=weights, progress=False).to(device).eval()
batch = weights.transforms()(image).unsqueeze(0).to(device)
with torch.inference_mode():
    scores = model(batch)["out"]
    scores = F.interpolate(scores, size=(image.height, image.width),
                           mode="bilinear", align_corners=False)
    labels = scores.argmax(dim=1)[0].cpu().numpy().astype(np.uint8)

categories = weights.meta["categories"]
palette = np.array(plt.get_cmap("tab20", len(categories))(
    np.arange(len(categories)))[:, :3] * 255, dtype=np.uint8)
palette[0] = (0, 0, 0)
colored = palette[labels]
original = np.asarray(image)
overlay = original.copy()
foreground = labels != 0
overlay[foreground] = (0.55 * original[foreground] +
                       0.45 * colored[foreground]).astype(np.uint8)
present = np.unique(labels)
for class_id in present:
    percentage = 100 * np.mean(labels == class_id)
    print(f"{categories[class_id]}: {percentage:.2f}% of pixels")

fig, axes = plt.subplots(1, 3, figsize=(12, 6))
for ax, title, result in zip(axes, ["Cat scene", "Class labels", "Overlay"],
                             [original, colored, overlay]):
    ax.imshow(result)
    ax.set_title(title)
    ax.axis("off")
fig.legend(handles=[Patch(color=palette[i] / 255, label=categories[i])
                    for i in present], loc="lower center", ncol=4)
fig.tight_layout(rect=(0, 0.08, 1, 1))
fig.savefig(out / "part4_semantic.png", dpi=160)
Image.fromarray(labels).save(out / "part4_class_ids.png")
Image.fromarray(overlay).save(out / "part4_overlay.png")
print("Semantic IoU: unavailable; this photo has no ground-truth labels.")
plt.show()
