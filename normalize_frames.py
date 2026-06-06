#!/usr/bin/env python3
"""normalize_frames.py

For each animation in assets/animations/:
1. Read all frame PNGs ({name}_00.png .. {name}_NN.png)
2. Find max width and max height across all frames
3. Create uniform canvas at (max_w, max_h), paste each frame bottom-aligned + horizontally centered
4. Overwrite original frame PNGs
5. Regenerate spritesheet (horizontal concat, uniform frame width)
6. Update animations_config.js: frameWidth, frameHeight, frames
"""

import re
import glob
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).parent
ANIM_DIR = BASE_DIR / "assets" / "animations"
CONFIG_FILE = ANIM_DIR / "animations_config.js"


def process_animation(folder, name):
    frame_paths = sorted(glob.glob(str(folder / f"{name}_[0-9][0-9].png")))
    if not frame_paths:
        print(f"  skip (no frames)")
        return None

    frames = [(p, Image.open(p).convert("RGBA")) for p in frame_paths]

    max_w = max(img.width for _, img in frames)
    max_h = max(img.height for _, img in frames)
    widths = sorted(set(img.width for _, img in frames))
    w_range = str(widths[0]) if len(widths) == 1 else f"{widths[0]}-{widths[-1]}"
    needs_fix = len(widths) > 1
    tag = "!! FIX" if needs_fix else "ok"
    print(f"  {len(frames)} frames | widths {w_range}px | target {max_w}x{max_h} | {tag}")

    normalized = []
    for path, img in frames:
        if img.width == max_w and img.height == max_h:
            normalized.append(img.copy())
        else:
            canvas = Image.new("RGBA", (max_w, max_h), (0, 0, 0, 0))
            x = (max_w - img.width) // 2
            y = max_h - img.height
            canvas.paste(img, (x, y))
            normalized.append(canvas)

    for i, (path, _) in enumerate(frames):
        normalized[i].save(path)

    sheet = Image.new("RGBA", (max_w * len(normalized), max_h), (0, 0, 0, 0))
    for i, frame in enumerate(normalized):
        sheet.paste(frame, (i * max_w, 0))
    sheet_path = folder / f"{name}_spritesheet.png"
    sheet.save(str(sheet_path), optimize=True)
    print(f"  -> spritesheet {sheet.width}x{sheet.height}")

    for _, img in frames:
        img.close()
    for f in normalized:
        f.close()
    sheet.close()

    return {"name": name, "frameWidth": max_w, "frameHeight": max_h, "frames": len(normalized)}


def update_config(results):
    text = CONFIG_FILE.read_text(encoding="utf-8")
    for r in results:
        lines = text.split("\n")
        for i, line in enumerate(lines):
            if re.match(rf"\s*{re.escape(r['name'])}\s*:", line):
                lines[i] = re.sub(r"(frames:\s*)\d+", rf"\g<1>{r['frames']}", line)
                lines[i] = re.sub(r"(frameWidth:\s*)\d+", rf"\g<1>{r['frameWidth']}", lines[i])
                lines[i] = re.sub(r"(frameHeight:\s*)\d+", rf"\g<1>{r['frameHeight']}", lines[i])
                print(f"  {r['name']}: {r['frameWidth']}x{r['frameHeight']} frames={r['frames']}")
                break
        text = "\n".join(lines)
    CONFIG_FILE.write_text(text, encoding="utf-8")


def main():
    print("MooMoo Frame Normalizer")
    print("=" * 60)
    results = []
    for folder in sorted(ANIM_DIR.iterdir()):
        if not folder.is_dir():
            continue
        print(f"[{folder.name}]")
        r = process_animation(folder, folder.name)
        if r:
            results.append(r)
    if results:
        print(f"\n{'=' * 60}")
        print("Updating animations_config.js ...")
        update_config(results)
    print(f"\nDone - {len(results)} animations processed.")


if __name__ == "__main__":
    main()
