// MooMoo 动画配置
// fps      — 播放帧率（按动作节奏分级）
// catScale — 猫咪显示高度归一化系数（目标显示高度 = frameHeight × SCALE × catScale ≈ 120px）
//            基于实测像素高度计算：catScale = 120 / (180 × 0.75) = 0.89
const MOOMOO_ANIMATIONS = {
  // ── 静止 / 极慢（3 fps） ──────────────────────────────────────
  idle:             { frames: 12, frameWidth:  320, frameHeight: 180, fps: 3, catScale: 0.89, src: "assets/animations/idle/idle_spritesheet.png" },
  sleep:            { frames: 12, frameWidth:  320, frameHeight: 180, fps: 3, catScale: 0.89, src: "assets/animations/sleep/sleep_spritesheet.png" },
  slouch:           { frames: 12, frameWidth:  320, frameHeight: 180, fps: 3, catScale: 0.89, src: "assets/animations/slouch/slouch_spritesheet.png" },
  spread_out:       { frames: 12, frameWidth:  320, frameHeight: 180, fps: 3, catScale: 0.89, src: "assets/animations/spread_out/spread_out_spritesheet.png" },

  // ── 缓慢动作（4 fps） ─────────────────────────────────────────
  grooming:         { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/grooming/grooming_spritesheet.png" },
  yawn:             { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/yawn/yawn_spritesheet.png" },
  look:             { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/look/look_spritesheet.png" },
  licking:          { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/licking/licking_spritesheet.png" },
  stretch:          { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/stretch/stretch_spritesheet.png" },
  meow:             { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/meow/meow_spritesheet.png" },
  swipe:            { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/swipe/swipe_spritesheet.png" },
  eating:           { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/eating/eating_spritesheet.png" },
  drinking:         { frames: 12, frameWidth:  320, frameHeight: 180, fps: 4, catScale: 0.89, src: "assets/animations/drinking/drinking_spritesheet.png" },

  // ── 行走类（6 fps） ───────────────────────────────────────────
  walk:             { frames: 12, frameWidth:  320, frameHeight: 180, fps: 6, catScale: 0.89, src: "assets/animations/walk/walk_spritesheet.png" },
  carry_envelope:   { frames: 12, frameWidth:  320, frameHeight: 180, fps: 6, catScale: 0.89, src: "assets/animations/carry_envelope/carry_envelope_spritesheet.png" },
  cat_teaser_wand_: { frames: 12, frameWidth:  320, frameHeight: 180, fps: 6, catScale: 0.89, src: "assets/animations/cat_teaser_wand_/cat_teaser_wand__spritesheet.png" },
  belly_up:         { frames: 12, frameWidth:  320, frameHeight: 180, fps: 6, catScale: 0.89, src: "assets/animations/belly_up/belly_up_spritesheet.png" },
  roll:             { frames: 12, frameWidth:  320, frameHeight: 180, fps: 6, catScale: 0.89, src: "assets/animations/roll/roll_spritesheet.png" },
  drop_in:          { frames: 12, frameWidth:  320, frameHeight: 180, fps: 6, catScale: 0.89, src: "assets/animations/drop_in/drop_in_spritesheet.png" },

  // ── 快速动作（8 fps） ─────────────────────────────────────────
  startled:         { frames: 12, frameWidth:  320, frameHeight: 180, fps: 8, catScale: 0.89, src: "assets/animations/startled/startled_spritesheet.png" },
  jump:             { frames: 12, frameWidth:  320, frameHeight: 180, fps: 8, catScale: 0.89, src: "assets/animations/jump/jump_spritesheet.png" },
  play_ball:        { frames: 12, frameWidth:  320, frameHeight: 180, fps: 8, catScale: 0.89, src: "assets/animations/play_ball/play_ball_spritesheet.png" },
};
