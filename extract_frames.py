"""
MooMoo 动画帧批量提取工具
========================
从 videos/ 下的 MP4 提取帧到 assets/animations/
每帧缩放到固定画布，不裁剪，保证同一动画内所有帧尺寸完全一致。
"""

import cv2
import numpy as np
import os
import re
import sys
from pathlib import Path

# ============ 配置 ============
VIDEOS_DIR = "videos"
OUTPUT_DIR = "assets/animations"
FRAMES_PER_ANIM = 12
SKIP_START_SEC = 1.0
SKIP_END_SEC = 0.3

# 固定画布尺寸（所有帧统一，不再裁剪到猫咪边界）
CANVAS_W = 320
CANVAS_H = 180

REMOVE_BG = True
BG_THRESHOLD = 248
REMOVE_WATERMARK = True
WATERMARK_HEIGHT = 50
REMOVE_SHADOW = True
SHADOW_SCAN_RATIO = 0.40
# ==============================


def remove_background(frame, threshold=230):
    rgba = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    white_mask = gray > threshold

    fade_range = 10
    for t in range(threshold - fade_range, threshold):
        edge = (gray > t) & (gray <= t + 1)
        alpha_val = int(255 * (threshold - t) / fade_range)
        rgba[edge, 3] = alpha_val

    rgba[white_mask, 3] = 0

    if REMOVE_SHADOW:
        shadow_zone_start = int(h * (1 - SHADOW_SCAN_RATIO))
        zone = rgba[shadow_zone_start:, :, :].copy()
        zone_rgb = zone[:, :, :3].astype(np.float32)
        zone_a = zone[:, :, 3].astype(np.float32)
        brightness = zone_rgb.mean(axis=2)
        color_spread = zone_rgb.max(axis=2) - zone_rgb.min(axis=2)
        is_candidate = (brightness > 120) & (brightness < 235) & (color_spread < 45) & (zone_a > 0)
        zone_h = h - shadow_zone_start
        depth_weights = np.linspace(0, 1, zone_h).reshape(-1, 1)
        shadow_thresh = 180 - depth_weights * 60
        is_shadow = is_candidate & (brightness > shadow_thresh)
        fade = np.clip((brightness - shadow_thresh) / 15, 0, 1)
        new_alpha = zone_a * (1 - fade * is_shadow)
        zone[:, :, 3] = np.clip(new_alpha, 0, 255).astype(np.uint8)
        rgba[shadow_zone_start:, :, :] = zone

    return rgba


def scale_to_canvas(frame):
    """Scale frame to fit CANVAS_W x CANVAS_H, maintaining aspect ratio, centered."""
    h, w = frame.shape[:2]
    scale = min(CANVAS_W / w, CANVAS_H / h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)

    channels = resized.shape[2] if len(resized.shape) == 3 else 1
    canvas = np.zeros((CANVAS_H, CANVAS_W, channels), dtype=np.uint8)
    x = (CANVAS_W - new_w) // 2
    y = (CANVAS_H - new_h) // 2
    canvas[y:y + new_h, x:x + new_w] = resized
    return canvas


def process_video(video_path, output_dir, anim_name):
    print(f"\n{'=' * 50}")
    print(f"  {anim_name}")
    print(f"{'=' * 50}")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"  ERROR: cannot open {video_path}")
        return None

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps

    print(f"  source: {width}x{height} {fps:.0f}fps {duration:.1f}s")

    start_frame = int(SKIP_START_SEC * fps)
    end_frame = total_frames - int(SKIP_END_SEC * fps)
    usable_frames = end_frame - start_frame

    if usable_frames < FRAMES_PER_ANIM:
        start_frame = 0
        end_frame = total_frames
        usable_frames = total_frames

    interval = max(1, usable_frames // FRAMES_PER_ANIM)

    anim_dir = Path(output_dir) / anim_name
    anim_dir.mkdir(parents=True, exist_ok=True)

    frame_idx = 0
    saved = 0
    frames_for_sheet = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx >= start_frame and (frame_idx - start_frame) % interval == 0 and saved < FRAMES_PER_ANIM:
            if REMOVE_WATERMARK:
                frame = frame[:height - WATERMARK_HEIGHT, :, :]

            if REMOVE_BG:
                processed = remove_background(frame, BG_THRESHOLD)
            else:
                processed = cv2.cvtColor(frame, cv2.COLOR_BGR2BGRA)

            processed = scale_to_canvas(processed)

            frame_path = anim_dir / f"{anim_name}_{saved:02d}.png"
            cv2.imwrite(str(frame_path), processed)
            frames_for_sheet.append(processed)
            saved += 1

        frame_idx += 1

    cap.release()

    if frames_for_sheet:
        sprite_w = CANVAS_W * len(frames_for_sheet)
        sprite = np.zeros((CANVAS_H, sprite_w, 4), dtype=np.uint8)
        for i, f in enumerate(frames_for_sheet):
            sprite[:, i * CANVAS_W:(i + 1) * CANVAS_W] = f

        sprite_path = anim_dir / f"{anim_name}_spritesheet.png"
        cv2.imwrite(str(sprite_path), sprite)
        print(f"  -> {saved} frames @ {CANVAS_W}x{CANVAS_H} + spritesheet")

    return {
        "name": anim_name,
        "frames": saved,
        "frame_width": CANVAS_W,
        "frame_height": CANVAS_H,
    }


# ── FPS lookup (matches animations_config.js) ───────────────────
FPS_TABLE = {
    "idle": 3, "sleep": 3, "slouch": 3, "spread_out": 3,
    "grooming": 4, "yawn": 4, "look": 4, "licking": 4,
    "stretch": 4, "meow": 4, "swipe": 4, "eating": 4, "drinking": 4,
    "walk": 6, "carry_envelope": 6, "cat_teaser_wand_": 6,
    "belly_up": 6, "roll": 6, "drop_in": 6,
    "startled": 8, "jump": 8, "play_ball": 8,
}

CAT_SCALE = round(120 / (CANVAS_H * 0.75), 2)


def generate_config(animations_meta, output_dir):
    """Generate animations_config.js preserving fps/catScale/comments."""
    config_path = Path(output_dir) / "animations_config.js"

    # Try to preserve existing config structure if it exists
    if config_path.exists():
        text = config_path.read_text(encoding="utf-8")
        for meta in animations_meta:
            name = meta["name"]
            fw = meta["frame_width"]
            fh = meta["frame_height"]
            lines = text.split("\n")
            for i, line in enumerate(lines):
                if re.match(rf"\s*{re.escape(name)}\s*:", line):
                    lines[i] = re.sub(r"(frames:\s*)\d+", rf"\g<1>{meta['frames']}", line)
                    lines[i] = re.sub(r"(frameWidth:\s*)\d+", rf"\g<1>{fw}", lines[i])
                    lines[i] = re.sub(r"(frameHeight:\s*)\d+", rf"\g<1>{fh}", lines[i])
                    lines[i] = re.sub(r"(catScale:\s*)[\d.]+", rf"\g<1>{CAT_SCALE:.2f}", lines[i])
                    break
            text = "\n".join(lines)
        config_path.write_text(text, encoding="utf-8")
        print(f"  Updated existing config ({len(animations_meta)} entries)")
    else:
        # Generate fresh config
        js = "const MOOMOO_ANIMATIONS = {\n"
        for meta in animations_meta:
            name = meta["name"]
            fps = FPS_TABLE.get(name, 6)
            js += f'  {name}: {{ frames: {meta["frames"]}, frameWidth: {meta["frame_width"]}, '
            js += f'frameHeight: {meta["frame_height"]}, fps: {fps}, catScale: {CAT_SCALE:.2f}, '
            js += f'src: "assets/animations/{name}/{name}_spritesheet.png" }},\n'
        js += "};\n"
        config_path.write_text(js, encoding="utf-8")
        print(f"  Generated new config ({len(animations_meta)} entries)")


def main():
    print(f"MooMoo Frame Extractor (canvas {CANVAS_W}x{CANVAS_H}, no crop)")
    print("=" * 60)

    videos_dir = Path(VIDEOS_DIR)
    output_dir = Path(OUTPUT_DIR)

    if not videos_dir.exists():
        print(f"ERROR: {videos_dir.absolute()} not found")
        sys.exit(1)

    video_files = sorted(list(videos_dir.glob("*.mp4")) + list(videos_dir.glob("*.MP4")))
    if not video_files:
        print(f"ERROR: no MP4 files in {VIDEOS_DIR}/")
        sys.exit(1)

    print(f"Found {len(video_files)} videos")

    output_dir.mkdir(parents=True, exist_ok=True)
    animations_meta = []

    for vf in video_files:
        anim_name = vf.stem.lower().replace(" ", "_").replace("-", "_")
        meta = process_video(vf, output_dir, anim_name)
        if meta:
            animations_meta.append(meta)

    if animations_meta:
        print(f"\n{'=' * 60}")
        print(f"catScale = {CAT_SCALE:.2f} (display ~120px @ SCALE=0.75)")
        generate_config(animations_meta, output_dir)

    print(f"\nDone - {len(animations_meta)} animations, {sum(m['frames'] for m in animations_meta)} frames")


if __name__ == "__main__":
    main()
