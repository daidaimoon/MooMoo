(() => {
  if (document.getElementById('moomoo-container')) return;

  const R     = u => chrome.runtime.getURL(u);
  const SCALE = 0.75;
  const SIZE_TRANS = 'width 0.15s ease-out, height 0.15s ease-out';

  // ── 帧路径 ────────────────────────────────────────────────────
  function frameSrc(name, n) {
    return R(`assets/animations/${name}/${name}_${String(n).padStart(2, '0')}.png`);
  }

  // ── 预加载所有动画的全部帧 ────────────────────────────────────
  const FRAMES = {};
  for (const [name, cfg] of Object.entries(MOOMOO_ANIMATIONS)) {
    const imgs = [];
    for (let i = 0; i < cfg.frames; i++) {
      const img = new Image();
      img.src = frameSrc(name, i);
      imgs.push(img);
    }
    FRAMES[name] = imgs;
  }

  // ── 帧播放器（单帧 IMG 切换，无精灵图）────────────────────────
  class FramePlayer {
    constructor(imgEl) {
      this.img   = imgEl;
      this.rafId = null;
      this._cfg  = null;
      this._dw   = 0;
    }

    get frameWidth() { return this._dw; }

    play(name, { loop = true, onComplete = null } = {}) {
      this.stop();
      const cfg    = MOOMOO_ANIMATIONS[name];
      const frames = FRAMES[name];
      if (!cfg || !frames) return;

      this._cfg    = cfg;
      this._frames = frames;
      this._loop   = loop;
      this._onDone = onComplete;
      this._frame  = 0;
      this._ms     = 1000 / cfg.fps;
      this._lastTs = null;
      this._scale  = SCALE * (cfg.catScale || 1.0);

      const f0 = frames[0];
      const nw = f0.naturalWidth  || cfg.frameWidth  || 320;
      const nh = f0.naturalHeight || cfg.frameHeight || 180;
      this._dw = Math.round(nw * this._scale);
      this._dh = Math.round(nh * this._scale);

      this.img.style.setProperty('width',  this._dw + 'px', 'important');
      this.img.style.setProperty('height', this._dh + 'px', 'important');

      const c = this.img.parentElement;
      if (c) {
        c.style.setProperty('width',  this._dw + 'px', 'important');
        c.style.setProperty('height', this._dh + 'px', 'important');
      }

      this.img.src = frames[0].src;
      this.rafId = requestAnimationFrame(ts => this._tick(ts));
    }

    _tick(ts) {
      if (this._lastTs === null) this._lastTs = ts;
      if (ts - this._lastTs >= this._ms) {
        this._lastTs += this._ms;
        if (ts - this._lastTs > this._ms * 3) this._lastTs = ts;

        this._frame++;
        if (this._frame >= this._cfg.frames) {
          if (this._loop) {
            this._frame = 0;
          } else {
            this.img.src = this._frames[this._cfg.frames - 1].src;
            if (this._onDone) this._onDone();
            return;
          }
        }
        this.img.src = this._frames[this._frame].src;
      }
      this.rafId = requestAnimationFrame(ts => this._tick(ts));
    }

    stop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }
  }

  // ── DOM ────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'moomoo-container';
  document.body.appendChild(container);

  const sprite = document.createElement('img');
  sprite.id = 'mm-sprite';
  sprite.alt = '';
  sprite.draggable = false;
  container.appendChild(sprite);

  const player = new FramePlayer(sprite);

  // ── 气泡文字 UI ───────────────────────────────────────────────
  const bubble = document.createElement('div');
  bubble.id = 'mm-bubble';
  bubble.style.cssText = [
    'position:absolute!important',
    'bottom:100%!important',
    'right:0!important',
    'margin-bottom:4px!important',
    'padding:4px 10px!important',
    'background:rgba(255,255,255,0.92)!important',
    'color:#333!important',
    'font-size:12px!important',
    'line-height:1.4!important',
    'border-radius:10px!important',
    'white-space:nowrap!important',
    'pointer-events:none!important',
    'opacity:0!important',
    'transition:opacity 0.4s ease!important',
    'font-family:-apple-system,"Segoe UI",sans-serif!important',
    'box-shadow:0 1px 4px rgba(0,0,0,0.12)!important',
    'z-index:2147483647!important',
  ].join(';');
  container.appendChild(bubble);

  let bubbleTimer = null;
  function showBubble(text) {
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.style.setProperty('opacity', '1', 'important');
    bubbleTimer = setTimeout(() => {
      bubble.style.setProperty('opacity', '0', 'important');
    }, 3000);
  }

  function maybeShowBubble() {
    if (trustStage.bubbleChance > 0
        && Math.random() < trustStage.bubbleChance
        && trustStage.bubbleTexts.length > 0) {
      const texts = trustStage.bubbleTexts;
      showBubble(texts[Math.floor(Math.random() * texts.length)]);
    }
  }

  // ── 信封弹窗 UI ───────────────────────────────────────────────
  const envOverlay = document.createElement('div');
  envOverlay.id = 'mm-env-overlay';
  envOverlay.style.cssText = [
    'position:fixed!important', 'top:0!important', 'left:0!important',
    'width:100vw!important', 'height:100vh!important',
    'background:rgba(0,0,0,0.25)!important',
    'display:none!important',
    'align-items:center!important', 'justify-content:center!important',
    'z-index:2147483646!important',
    'font-family:"Comic Sans MS",cursive,sans-serif!important',
    'pointer-events:auto!important',
  ].join(';');
  document.body.appendChild(envOverlay);

  const envCard = document.createElement('div');
  envCard.id = 'mm-env-card';
  envCard.style.cssText = [
    'background:#f5e6d0!important',
    'border:2px dashed #c4a882!important',
    'border-radius:14px!important',
    'padding:24px 28px!important',
    'max-width:360px!important', 'width:90%!important',
    'box-shadow:0 8px 32px rgba(0,0,0,0.12)!important',
    'text-align:center!important',
    'color:#5a4a3a!important',
    'transform:scale(0.8)!important', 'opacity:0!important',
    'transition:transform 0.3s ease,opacity 0.3s ease!important',
    'pointer-events:auto!important',
  ].join(';');
  envOverlay.appendChild(envCard);

  envOverlay.addEventListener('click', e => {
    if (e.target === envOverlay) hideEnvelopePopup();
  });

  // ── 月度报告弹窗 UI ──────────────────────────────────────────
  const rptOverlay = document.createElement('div');
  rptOverlay.id = 'mm-rpt-overlay';
  rptOverlay.style.cssText = [
    'position:fixed!important', 'top:0!important', 'left:0!important',
    'width:100vw!important', 'height:100vh!important',
    'background:rgba(0,0,0,0.3)!important',
    'display:none!important',
    'align-items:center!important', 'justify-content:center!important',
    'z-index:2147483646!important',
    'font-family:-apple-system,"Segoe UI",sans-serif!important',
    'pointer-events:auto!important',
  ].join(';');
  document.body.appendChild(rptOverlay);

  const rptCard = document.createElement('div');
  rptCard.id = 'mm-rpt-card';
  rptCard.style.cssText = [
    'background:#faf5eb!important',
    'border-radius:16px!important',
    'padding:28px 32px!important',
    'max-width:420px!important', 'width:92%!important',
    'box-shadow:0 8px 40px rgba(0,0,0,0.15)!important',
    'text-align:center!important',
    'color:#333!important',
    'transform:scale(0.85)!important', 'opacity:0!important',
    'transition:transform 0.3s ease,opacity 0.3s ease!important',
    'pointer-events:auto!important',
    'max-height:80vh!important', 'overflow-y:auto!important',
  ].join(';');
  rptOverlay.appendChild(rptCard);
  rptOverlay.addEventListener('click', e => { if (e.target === rptOverlay) hideReport(); });

  // ── 收藏柜弹窗 UI ──────────────────────────────────────────────
  const colOverlay = document.createElement('div');
  colOverlay.id = 'mm-col-overlay';
  colOverlay.style.cssText = [
    'position:fixed!important', 'top:0!important', 'left:0!important',
    'width:100vw!important', 'height:100vh!important',
    'background:rgba(0,0,0,0.3)!important',
    'display:none!important',
    'align-items:center!important', 'justify-content:center!important',
    'z-index:2147483646!important',
    'font-family:-apple-system,"Segoe UI",sans-serif!important',
    'pointer-events:auto!important',
  ].join(';');
  document.body.appendChild(colOverlay);

  const colCard = document.createElement('div');
  colCard.id = 'mm-col-card';
  colCard.style.cssText = [
    'background:#f5e6d0!important',
    'border-radius:16px!important',
    'padding:24px 28px!important',
    'max-width:380px!important', 'width:92%!important',
    'box-shadow:0 8px 40px rgba(0,0,0,0.15),inset 0 0 0 3px #d4b896!important',
    'text-align:center!important',
    'color:#5a4a3a!important',
    'transform:scale(0.85)!important', 'opacity:0!important',
    'transition:transform 0.3s ease,opacity 0.3s ease!important',
    'pointer-events:auto!important',
    'max-height:80vh!important', 'overflow-y:auto!important',
  ].join(';');
  colOverlay.appendChild(colCard);
  colOverlay.addEventListener('click', e => { if (e.target === colOverlay) hideCollectionCabinet(); });

  // ── 设置面板 UI ───────────────────────────────────────────────
  const settingsOverlay = document.createElement('div');
  settingsOverlay.id = 'mm-settings-overlay';
  settingsOverlay.style.cssText = [
    'position:fixed!important', 'top:0!important', 'left:0!important',
    'width:100vw!important', 'height:100vh!important',
    'background:rgba(0,0,0,0.3)!important',
    'display:none!important',
    'align-items:center!important', 'justify-content:center!important',
    'z-index:2147483646!important',
    'font-family:-apple-system,"Segoe UI",sans-serif!important',
    'pointer-events:auto!important',
  ].join(';');
  document.body.appendChild(settingsOverlay);

  const settingsCard = document.createElement('div');
  settingsCard.id = 'mm-settings-card';
  settingsCard.style.cssText = [
    'background:#f5e6d0!important',
    'border-radius:16px!important',
    'padding:24px 28px!important',
    'max-width:380px!important', 'width:92%!important',
    'box-shadow:0 8px 40px rgba(0,0,0,0.15),inset 0 0 0 3px #d4b896!important',
    'text-align:center!important',
    'color:#5a4a3a!important',
    'transform:scale(0.85)!important', 'opacity:0!important',
    'transition:transform 0.3s ease,opacity 0.3s ease!important',
    'pointer-events:auto!important',
    'max-height:80vh!important', 'overflow-y:auto!important',
  ].join(';');
  settingsOverlay.appendChild(settingsCard);
  settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) hideSettingsPanel(); });

  // ── 右键菜单 ──────────────────────────────────────────────────
  const ctxMenu = document.createElement('div');
  ctxMenu.id = 'mm-ctx-menu';
  ctxMenu.style.cssText = [
    'position:fixed!important', 'display:none!important',
    'background:#fff!important', 'border:1px solid #e0e0e0!important',
    'border-radius:8px!important', 'box-shadow:0 4px 16px rgba(0,0,0,0.12)!important',
    'padding:4px 0!important', 'z-index:2147483647!important',
    'font-family:-apple-system,"Segoe UI",sans-serif!important',
    'font-size:13px!important', 'min-width:170px!important',
    'pointer-events:auto!important',
  ].join(';');
  document.body.appendChild(ctxMenu);

  function addCtxItem(text, fn) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'padding:8px 16px!important;cursor:pointer!important;color:#333!important;white-space:nowrap!important';
    el.addEventListener('mouseenter', () => el.style.setProperty('background', '#f5f5f5', 'important'));
    el.addEventListener('mouseleave', () => el.style.setProperty('background', 'transparent', 'important'));
    el.addEventListener('click', () => { hideCtxMenu(); fn(); });
    ctxMenu.appendChild(el);
  }

  addCtxItem('\u{1F5D1}️ 清除所有浏览记录', async () => {
    if (!confirm('确定要清除 MooMoo 记录的所有浏览活动数据吗？\n此操作不可恢复。')) return;
    try {
      await chrome.runtime.sendMessage({ type: 'moomoo-clear-activity' });
      pendingReportData = null;
      showBubble('记录已全部清除~');
    } catch (_) {}
  });

  addCtxItem('\u{1F5C4}️ 收藏柜', () => openCollectionCabinet());
  addCtxItem('\u{1F527} 设置', () => openSettingsPanel());

  function showCtxMenu(x, y) {
    ctxMenu.style.setProperty('display', 'block', 'important');
    const h = ctxMenu.offsetHeight || 120;
    ctxMenu.style.setProperty('left', Math.min(x, window.innerWidth - 180) + 'px', 'important');
    ctxMenu.style.setProperty('top', Math.min(y, window.innerHeight - h - 8) + 'px', 'important');
  }
  function hideCtxMenu() { ctxMenu.style.setProperty('display', 'none', 'important'); }
  document.addEventListener('click', hideCtxMenu, true);

  // ── 信封弹窗函数 ──────────────────────────────────────────────
  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  const BTN_PRIMARY   = 'background:#e8a44a;color:#fff;border:none;border-radius:20px;padding:8px 22px;font-size:14px;cursor:pointer;font-family:inherit;margin:4px';
  const BTN_SECONDARY = 'background:transparent;color:#8a7a6a;border:1px solid #c4a882;border-radius:20px;padding:8px 22px;font-size:13px;cursor:pointer;font-family:inherit;margin:4px';
  const BTN_GREEN     = 'background:#6ab04c;color:#fff;border:none;border-radius:20px;padding:8px 22px;font-size:14px;cursor:pointer;font-family:inherit;margin:4px';

  function renderEnvelope(mode) {
    if (!currentChallenge) return;
    const c = currentChallenge;
    const dateFmt = c.issued_date.replace(/-/g, '.');

    let html = `
      <div style="font-size:36px;margin-bottom:2px">\u{1F43E}</div>
      <div style="font-size:12px;color:#9a8a7a;margin-bottom:10px">
        MooMoo ${dateFmt} 发出
      </div>
      <div style="border-top:1px dashed #c4a882;margin:10px 0"></div>
      <div style="font-size:32px;margin:8px 0">${c.emoji}</div>
      <div style="font-size:15px;line-height:1.8;margin-bottom:10px;color:#4a3a2a">
        ${escapeHtml(c.content)}
      </div>
      <div style="border-top:1px dashed #c4a882;margin:10px 0"></div>
    `;

    if (mode === 'new') {
      html += `
        <div style="margin-top:14px">
          <button id="mm-env-accept" style="${BTN_PRIMARY}">接受挑战！</button>
          <button id="mm-env-skip" style="${BTN_SECONDARY}">下次再说</button>
        </div>`;
    } else if (mode === 'active') {
      html += `
        <div style="margin-top:14px">
          <button id="mm-env-done" style="${BTN_GREEN}">我完成了！</button>
          <button id="mm-env-close" style="${BTN_SECONDARY}">关闭</button>
        </div>`;
    } else if (mode === 'completing') {
      html += `
        <div style="font-size:12px;color:#9a8a7a;margin-bottom:8px">写一句完成感想吧（可选）</div>
        <textarea id="mm-env-note" maxlength="100" rows="3"
          style="width:100%;box-sizing:border-box;resize:none;border:1px solid #c4a882;border-radius:8px;padding:8px;font-size:13px;font-family:inherit;background:rgba(255,255,255,0.6);color:#5a4a3a;margin-bottom:10px;outline:none"
          placeholder="最多 100 字..."></textarea>
        <div>
          <button id="mm-env-confirm" style="${BTN_GREEN}">确认完成 \u{1F389}</button>
          <button id="mm-env-cancel" style="${BTN_SECONDARY}">取消</button>
        </div>`;
    } else if (mode === 'completed') {
      html += `
        <div style="font-size:36px;margin:8px 0">\u{1F590}</div>
        <div style="font-size:12px;color:#9a8a7a">完成于 ${c.completed_date}</div>
        ${c.note ? `<div style="font-size:13px;color:#5a4a3a;margin-top:8px;padding:8px 12px;background:rgba(255,255,255,0.5);border-radius:8px;text-align:left">${escapeHtml(c.note)}</div>` : ''}
        <div style="margin-top:14px">
          <button id="mm-env-close" style="${BTN_SECONDARY}">关闭</button>
        </div>`;
    }

    envCard.innerHTML = html;

    const q = s => envCard.querySelector(s);
    const on = (s, fn) => { const el = q(s); if (el) el.onclick = fn; };

    on('#mm-env-accept', onAcceptChallenge);
    on('#mm-env-skip',   onSkipChallenge);
    on('#mm-env-done',   () => renderEnvelope('completing'));
    on('#mm-env-close',  hideEnvelopePopup);
    on('#mm-env-cancel', () => renderEnvelope('active'));
    on('#mm-env-confirm', () => {
      const ta = q('#mm-env-note');
      onCompleteChallenge(ta ? ta.value : '');
    });
  }

  function openEnvelopePopup(mode) {
    renderEnvelope(mode);
    envOverlay.style.setProperty('display', 'flex', 'important');
    requestAnimationFrame(() => {
      envCard.style.setProperty('transform', 'scale(1)', 'important');
      envCard.style.setProperty('opacity', '1', 'important');
    });
  }

  function hideEnvelopePopup() {
    envCard.style.setProperty('transform', 'scale(0.8)', 'important');
    envCard.style.setProperty('opacity', '0', 'important');
    setTimeout(() => {
      envOverlay.style.setProperty('display', 'none', 'important');
    }, 300);
  }

  // ── 位置辅助 ───────────────────────────────────────────────────
  function anchorRight() {
    container.style.setProperty('transition', SIZE_TRANS, 'important');
    container.style.right  = '20px';
    container.style.left   = 'auto';
    sprite.style.transform = '';
  }

  // ── 动画规范配置 ──────────────────────────────────────────────

  // ── 时段权重倍数（概率倾向，不是严格时刻表）────────────────────
  const TIME_WEIGHTS = [
    { name: '起床期',  start: 6,  end: 8,
      weights: { sleep: 0.3, stretch: 3.0, yawn: 3.0, idle: 1.0, _default: 0.5 } },
    { name: '早餐期',  start: 8,  end: 9,
      weights: { eating: 4.0, drinking: 3.0, grooming: 2.0, _default: 0.5 } },
    { name: '上午',    start: 9,  end: 12,
      weights: { idle: 2.0, walk: 1.5, look: 1.5, meow: 0.3, _default: 1.0 } },
    { name: '午饭',    start: 12, end: 13,
      weights: { eating: 4.0, drinking: 3.0, licking: 2.0, _default: 0.5 } },
    { name: '午睡',    start: 13, end: 15,
      weights: { sleep: 4.0, slouch: 3.0, spread_out: 2.0, _default: 0.3 } },
    { name: '活跃期',  start: 15, end: 18,
      weights: { play_ball: 3.0, chase_butterfly: 3.0, cat_teaser_wand_: 3.0,
                 roll: 2.0, walk: 2.0, jump: 2.0, _default: 0.8 } },
    { name: '晚饭',    start: 18, end: 19,
      weights: { eating: 4.0, drinking: 3.0, _default: 0.5 } },
    { name: '晚间',    start: 19, end: 22,
      weights: { idle: 2.0, spread_out: 2.0, look: 1.5, walk: 1.0, _default: 0.8 } },
    { name: '深夜',    start: 22, end: 6,
      weights: { sleep: 5.0, walk: 0.3, _default: 0.1 } },
  ];

  function getTimePeriod() {
    const h = new Date().getHours();
    for (const p of TIME_WEIGHTS) {
      if (p.start < p.end) {
        if (h >= p.start && h < p.end) return p;
      } else {
        if (h >= p.start || h < p.end) return p;
      }
    }
    return null;
  }

  function applyTimeWeights(w) {
    const period = getTimePeriod();
    if (!period) return { weights: w, period: null };
    const result = {};
    for (const [k, v] of Object.entries(w)) {
      const mult = period.weights[k] !== undefined
        ? period.weights[k]
        : period.weights._default || 1.0;
      result[k] = v * mult;
    }
    return { weights: result, period };
  }

  // ── 信任度成长系统 ──────────────────────────────────────────────
  const TRUST_STAGES = [
    { name: '陌生期',     minDay: 1,   maxDay: 14,
      bubbleChance: 0, bubbleTexts: [],
      startledChance: 0.8, clickAction: 'startled',
      disabledActions: new Set(['meow', 'belly_up']) },
    { name: '好奇期',     minDay: 15,  maxDay: 28,
      bubbleChance: 0.10, bubbleTexts: ['?', '...'],
      startledChance: 0.5, clickAction: 'startled',
      disabledActions: new Set(['belly_up']) },
    { name: '熟悉期',     minDay: 29,  maxDay: 60,
      bubbleChance: 0.15, bubbleTexts: ['喵~', '哼哼'],
      startledChance: 0, clickAction: 'look',
      disabledActions: new Set() },
    { name: '亲密期',     minDay: 61,  maxDay: 120,
      bubbleChance: 0.20,
      bubbleTexts: ['在忙吗？', '我饿了...', '陪我玩嘛', '你今天好安静'],
      startledChance: 0, clickAction: 'look',
      disabledActions: new Set() },
    { name: '灵魂伴侣',   minDay: 121, maxDay: Infinity,
      bubbleChance: 0.25,
      bubbleTexts: ['今天辛苦了', '早点休息吧', '我一直在呢', '又加班啦？'],
      startledChance: 0, clickAction: 'look',
      disabledActions: new Set() },
  ];

  let daysSinceInstall = 1;
  let trustStage = TRUST_STAGES[0];
  let lastActivity = Date.now();

  function getTrustStage(days) {
    for (let i = TRUST_STAGES.length - 1; i >= 0; i--) {
      if (days >= TRUST_STAGES[i].minDay) return TRUST_STAGES[i];
    }
    return TRUST_STAGES[0];
  }

  // ── 基础权重 & 时长 ───────────────────────────────────────────

  const STATE_WEIGHTS = {
    idle: 25, sleep: 20, walk: 12, grooming: 8, licking: 8, look: 6,
    slouch: 5, spread_out: 5, eating: 3, drinking: 3, yawn: 2, stretch: 2,
    roll: 2, belly_up: 2, meow: 1, play_ball: 1, cat_teaser_wand_: 1, jump: 1,
  };

  const LOOP_DURATIONS = {
    idle:              [30000,  60000],
    sleep:             [90000, 180000],
    slouch:            [30000,  60000],
    spread_out:        [30000,  60000],
    grooming:          [15000,  25000],
    licking:           [15000,  25000],
    look:              [10000,  15000],
    eating:            [15000,  30000],
    drinking:          [10000,  15000],
    roll:              [6000,   10000],
    play_ball:         [8000,   12000],
    cat_teaser_wand_:  [6000,   10000],
  };

  const SINGLE_HOLD = {
    yawn: 2000, stretch: 3000, belly_up: 5000, jump: 1000,
  };

  const PLAY_ACTIONS = new Set(['play_ball', 'cat_teaser_wand_', 'jump']);

  // ── 收集品数据 ────────────────────────────────────────────────
  const COLLECTION_ITEMS = [
    { id: 'leaf',        emoji: '\u{1F342}', name: '落叶',     rarity: 'common' },
    { id: 'feather',     emoji: '\u{1FAB6}', name: '羽毛',     rarity: 'common' },
    { id: 'grass',       emoji: '\u{1F33F}', name: '小草',     rarity: 'common' },
    { id: 'stone',       emoji: '\u{1FAA8}', name: '小石头',   rarity: 'common' },
    { id: 'yarn',        emoji: '\u{1F9F6}', name: '毛线团',   rarity: 'common' },
    { id: 'fish',        emoji: '\u{1F41F}', name: '小鱼',     rarity: 'uncommon' },
    { id: 'lizard',      emoji: '\u{1F98E}', name: '小蜥蜴',   rarity: 'uncommon' },
    { id: 'caterpillar', emoji: '\u{1F41B}', name: '毛毛虫',   rarity: 'uncommon' },
    { id: 'flower',      emoji: '\u{1F338}', name: '花朵',     rarity: 'uncommon' },
    { id: 'clover',      emoji: '\u{1F340}', name: '三叶草',   rarity: 'uncommon' },
    { id: 'butterfly',   emoji: '\u{1F98B}', name: '蝴蝶',     rarity: 'rare' },
    { id: 'ladybug',     emoji: '\u{1F41E}', name: '瓢虫',     rarity: 'rare' },
    { id: 'rose',        emoji: '\u{1F33A}', name: '玫瑰',     rarity: 'rare' },
    { id: 'star',        emoji: '⭐',    name: '星星',     rarity: 'rare' },
    { id: 'ribbon',      emoji: '\u{1F380}', name: '蝴蝶结',   rarity: 'rare' },
    { id: 'tropical',    emoji: '\u{1F420}', name: '热带鱼',   rarity: 'legendary' },
    { id: 'diamond',     emoji: '\u{1F48E}', name: '钻石',     rarity: 'legendary' },
    { id: 'rainbow',     emoji: '\u{1F308}', name: '彩虹',     rarity: 'legendary' },
    { id: 'circus',      emoji: '\u{1F3AA}', name: '马戏团票', rarity: 'legendary' },
    { id: 'crown',       emoji: '\u{1F451}', name: '小皇冠',   rarity: 'legendary' },
  ];

  const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 12, legendary: 3 };

  const RARITY_BY_STAGE = {
    '好奇期':   ['common'],
    '熟悉期':   ['common', 'uncommon'],
    '亲密期':   ['common', 'uncommon', 'rare'],
    '灵魂伴侣': ['common', 'uncommon', 'rare', 'legendary'],
  };

  let collectionDropTimer = null;
  let droppedItemEl = null;
  let droppedItemTimeout = null;

  // ── 状态机 ────────────────────────────────────────────────────
  let state         = 'idle';
  let prevState     = null;
  let stateTimer    = null;
  let walkTimer     = null;
  let clickTimer    = null;
  let playStreak    = 0;
  let idleEnteredAt = 0;

  function clearTimers() {
    clearTimeout(stateTimer);
    clearTimeout(walkTimer);
    stateTimer = walkTimer = null;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function weightedPick(w) {
    const es = Object.entries(w);
    const t  = es.reduce((s, [, v]) => s + v, 0);
    let r = Math.random() * t;
    for (const [k, v] of es) { r -= v; if (r <= 0) return k; }
    return es[es.length - 1][0];
  }

  function pickNext() {
    if (prevState === 'sleep')
      return Math.random() < 0.5 ? 'stretch' : 'yawn';

    if ((prevState === 'eating' || prevState === 'drinking') && Math.random() < 0.5)
      return 'grooming';

    const w = { ...STATE_WEIGHTS };

    if (state === 'idle' && Date.now() - idleEnteredAt > 60000)
      w.sleep = 40;

    if (playStreak >= 2)
      for (const a of PLAY_ACTIONS) delete w[a];

    if (w[prevState] && Object.keys(w).length > 1)
      delete w[prevState];

    for (const a of trustStage.disabledActions) delete w[a];

    const { weights: tw, period } = applyTimeWeights(w);

    if (trustStage.minDay >= 121) {
      const h = new Date().getHours();
      const userActive = Date.now() - lastActivity < 300000;
      if ((h >= 22 || h < 6) && userActive) {
        tw.sleep = (tw.sleep || 0) * 0.2;
        tw.idle  = (tw.idle  || 0) * 2.5;
        tw.yawn  = (tw.yawn  || 0) * 1.5;
        tw.walk  = (tw.walk  || 0) * 0.3;
      }
    }

    const picked = weightedPick(tw);

    console.log(
      `[MooMoo] 时段:${period ? period.name : '未知'} ` +
      `阶段:${trustStage.name}(第${daysSinceInstall}天) ` +
      `选中:${picked} 最终权重:${tw[picked].toFixed(1)} ` +
      `(基础:${w[picked] || 0} ×${period ? (period.weights[picked] !== undefined ? period.weights[picked] : period.weights._default) : 1})`
    );

    return picked;
  }

  // ── 走路 ──────────────────────────────────────────────────────
  function startWalk() {
    const spriteW = player.frameWidth;
    const vw      = window.innerWidth;
    const margin  = 20;
    const startX  = vw - spriteW - margin;
    const endX    = margin;

    if (startX - endX < 100) { setState('idle'); return; }

    const dist  = startX - endX;
    const speed = 80 + Math.random() * 40;
    const dur   = Math.round(dist / speed * 1000);

    sprite.style.transform = '';
    container.style.setProperty('transition', 'none', 'important');
    container.style.left  = startX + 'px';
    container.style.right = 'auto';
    void container.offsetWidth;
    container.style.setProperty('transition', `left ${dur}ms linear`, 'important');
    container.style.left = endX + 'px';

    walkTimer = setTimeout(() => {
      container.style.setProperty('transition', 'none', 'important');
      sprite.style.transform = 'scaleX(-1)';
      void container.offsetWidth;
      container.style.setProperty('transition', `left ${dur}ms linear`, 'important');
      container.style.left = startX + 'px';

      walkTimer = setTimeout(() => {
        anchorRight();
        setState(pickNext());
      }, dur + 200);
    }, dur + 200);
  }

  // ── 状态切换 ──────────────────────────────────────────────────
  function setState(next) {
    clearTimers();
    player.stop();
    prevState = state;
    state     = next;

    PLAY_ACTIONS.has(next) ? playStreak++ : (playStreak = 0);

    if (next !== 'drop_in' && next !== 'startled')
      maybeShowBubble();

    if (next === 'walk') {
      container.style.setProperty('transition', 'none', 'important');
      player.play('walk', { loop: true });
      startWalk();
      return;
    }

    anchorRight();

    if (next === 'idle') {
      player.play('idle', { loop: true });
      idleEnteredAt = Date.now();
      stateTimer = setTimeout(() => setState(pickNext()), rand(30000, 60000));
      return;
    }

    if (next === 'startled' || next === 'drop_in') {
      player.play(next, { loop: false, onComplete: () => setState('idle') });
      return;
    }

    if (!MOOMOO_ANIMATIONS[next]) { setState('idle'); return; }

    if (SINGLE_HOLD[next] !== undefined) {
      player.play(next, {
        loop: false,
        onComplete: () => {
          stateTimer = setTimeout(() => setState(pickNext()), SINGLE_HOLD[next]);
        },
      });
      return;
    }

    if (LOOP_DURATIONS[next]) {
      const [lo, hi] = LOOP_DURATIONS[next];
      player.play(next, { loop: true });
      stateTimer = setTimeout(() => setState(pickNext()), rand(lo, hi));
      return;
    }

    player.play(next, {
      loop: false,
      onComplete: () => {
        stateTimer = setTimeout(() => setState('idle'), 2000);
      },
    });
  }

  // ── 用户活跃检测 ──────────────────────────────────────────────
  function onUserActivity() { lastActivity = Date.now(); }
  document.addEventListener('mousemove', onUserActivity, true);
  document.addEventListener('keydown', onUserActivity, true);

  setInterval(() => {
    if (trustStage.minDay < 61) return;
    if (state === 'walk' || state === 'meow' || state === 'startled'
        || state === 'drop_in') return;
    if (Date.now() - lastActivity > 300000) {
      lastActivity = Date.now();
      showBubble(trustStage.bubbleTexts[Math.floor(Math.random() * trustStage.bubbleTexts.length)]);
      setState('meow');
    }
  }, 30000);

  // ── 通知提醒系统（气泡 + meow，每 10 分钟）─────────────────────
  let notifyTimer = null;

  function notifyChallenge() {
    showBubble('\u{1F4E9} 有新挑战！');
    if (state !== 'walk' && state !== 'drop_in' && state !== 'startled')
      setState('meow');
  }

  function notifyReport() {
    showBubble('\u{1F4CA} 我观察了你一个月哦~');
    if (state !== 'walk' && state !== 'drop_in' && state !== 'startled')
      setState('meow');
  }

  function startNotifyReminder() {
    clearInterval(notifyTimer);
    notifyTimer = setInterval(() => {
      if (pendingReportData) {
        notifyReport();
      } else if (currentChallenge && currentChallenge.status === 'active' && !currentChallenge.delivered) {
        notifyChallenge();
      } else {
        clearInterval(notifyTimer);
        notifyTimer = null;
      }
    }, 600000);
  }

  // ── 交互（点击猫咪：报告 > 挑战 > 正常）──────────────────────
  sprite.addEventListener('click', e => {
    e.stopPropagation();
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickTimer = null;
      if (state === 'walk' || state === 'startled' || state === 'drop_in') return;

      // 优先级 1：月度报告
      if (pendingReportData) {
        openReport();
        return;
      }

      // 优先级 2：新挑战（未接受）
      if (currentChallenge && currentChallenge.status === 'active' && !currentChallenge.delivered) {
        openEnvelopePopup('new');
        return;
      }

      // 优先级 3：已接受的挑战（可查看）
      if (currentChallenge && currentChallenge.status === 'active' && currentChallenge.delivered) {
        openEnvelopePopup('active');
        return;
      }

      // 正常交互
      if (trustStage.startledChance > 0 && Math.random() < trustStage.startledChance) {
        setState('startled');
      } else {
        setState(trustStage.clickAction === 'look' ? 'look' : 'idle');
      }
    }, 220);
  });

  sprite.addEventListener('dblclick', e => {
    e.stopPropagation();
    clearTimeout(clickTimer);
    clickTimer = null;
    setState(trustStage.minDay >= 61 ? 'belly_up' : 'sleep');
  });

  sprite.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    showCtxMenu(e.clientX, e.clientY);
  });

  // ── 每周挑战系统 ──────────────────────────────────────────────
  let currentChallenge = null;

  function getMondayDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  async function loadChallenges() {
    const resp = await fetch(R('challenges.json'));
    return resp.json();
  }

  async function generateNewChallenge(completedIds) {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'moomoo-generate-challenge' });
      if (result && !result.fallback && result.content) {
        console.log('[MooMoo] API 生成挑战成功');
        return {
          id: `api_${Date.now()}`,
          content: result.content,
          emoji: '\u{1F431}',
          category: 'api',
        };
      }
      console.log(`[MooMoo] API 回退: ${result ? result.reason : 'unknown'}`);
    } catch (_) {}

    const challenges = await loadChallenges();
    const available = challenges.filter(c => !completedIds.includes(c.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  async function onAcceptChallenge() {
    currentChallenge.delivered = true;
    await chrome.storage.local.set({ current_challenge: currentChallenge });
    hideEnvelopePopup();
    clearInterval(notifyTimer);
    notifyTimer = null;
  }

  async function onSkipChallenge() {
    currentChallenge.delivered = true;
    await chrome.storage.local.set({ current_challenge: currentChallenge });
    hideEnvelopePopup();
    clearInterval(notifyTimer);
    notifyTimer = null;
  }

  async function onCompleteChallenge(note) {
    currentChallenge.status = 'completed';
    currentChallenge.completed_date = new Date().toISOString().slice(0, 10);
    currentChallenge.note = (note || '').slice(0, 100);

    const data = await chrome.storage.local.get(['completed_ids']);
    const ids = data.completed_ids || [];
    if (!ids.includes(currentChallenge.id)) ids.push(currentChallenge.id);

    await chrome.storage.local.set({
      current_challenge: currentChallenge,
      completed_ids: ids,
    });

    hideEnvelopePopup();
    showBubble('\u{1F389} 太棒了！');
  }

  async function forceNewChallenge() {
    const data = await chrome.storage.local.get([
      'current_challenge', 'completed_ids', 'challenge_history',
    ]);
    if (data.current_challenge) {
      const history = data.challenge_history || [];
      history.push(data.current_challenge);
      await chrome.storage.local.set({ challenge_history: history });
    }
    const completedIds = data.completed_ids || [];
    const picked = await generateNewChallenge(completedIds);
    if (!picked) {
      console.log('[MooMoo] 无可用挑战');
      return;
    }
    currentChallenge = {
      id: picked.id, content: picked.content, emoji: picked.emoji,
      category: picked.category,
      issued_date: new Date().toISOString().slice(0, 10),
      status: 'active', delivered: false, completed_date: null, note: '',
    };
    await chrome.storage.local.set({ current_challenge: currentChallenge });
    console.log(`[MooMoo] 新挑战 ${picked.emoji} ${picked.content}`);
    notifyChallenge();
    startNotifyReminder();
  }

  async function initChallengeSystem(isFirstInstall) {
    try {
      const data = await chrome.storage.local.get([
        'current_challenge', 'completed_ids', 'challenge_history',
      ]);
      const current = data.current_challenge;
      const now = new Date();
      const thisMonday = getMondayDate(now);

      const needNew = !current
        || getMondayDate(new Date(current.issued_date)) !== thisMonday;

      if (isFirstInstall && !current) {
        await forceNewChallenge();
        return;
      }

      if (needNew && now.getDay() === 1 && now.getHours() < 9) return;

      if (needNew) {
        if (current) {
          const history = data.challenge_history || [];
          history.push(current);
          await chrome.storage.local.set({ challenge_history: history });
        }

        const completedIds = data.completed_ids || [];
        const picked = await generateNewChallenge(completedIds);
        if (!picked) {
          console.log('[MooMoo] 无可用挑战');
          return;
        }

        currentChallenge = {
          id: picked.id,
          content: picked.content,
          emoji: picked.emoji,
          category: picked.category,
          issued_date: now.toISOString().slice(0, 10),
          status: 'active',
          delivered: false,
          completed_date: null,
          note: '',
        };
        await chrome.storage.local.set({ current_challenge: currentChallenge });
        console.log(`[MooMoo] 新挑战 ${picked.emoji} ${picked.content}`);
        notifyChallenge();
        startNotifyReminder();
      } else {
        currentChallenge = current;
        if (current.status === 'active' && !current.delivered) {
          notifyChallenge();
          startNotifyReminder();
        }
      }
    } catch (e) {
      console.log('[MooMoo] 挑战系统初始化失败:', e);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'moomoo-challenge-time') initChallengeSystem();
    if (msg.type === 'moomoo-report-time') initMonthlyReport();
  });

  // ── 月度活动报告 ──────────────────────────────────────────────
  let pendingReportData = null;
  let pendingReportMonth = null;
  let pendingReportKey = null;

  function fmtDur(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h > 0 && m > 0) return `${h}小时${m}分钟`;
    if (h > 0) return `${h}小时`;
    return `${m}分钟`;
  }

  function fmtMonth(d) { return `${d.getFullYear()}年${d.getMonth() + 1}月`; }

  function fmtDate(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function getCatComment(activity, topDomain) {
    const domainEntries = Object.entries(activity)
      .filter(([k]) => k !== 'daily_active_hours' && k !== 'daily_totals');
    const totalSec = domainEntries.reduce((s, [, v]) => s + v, 0);
    const dailyTotals = activity.daily_totals || {};
    const days = Math.max(Object.keys(dailyTotals).length, 1);
    const avgPerDay = totalSec / days;
    const topTime = activity[topDomain] || 0;
    const topPct = totalSec > 0 ? topTime / totalSec : 0;

    if (avgPerDay > 8 * 3600)
      return '你比我还能熬...注意休息啊 \u{1F63C}';
    if (topPct > 0.4 && topDomain)
      return `你是不是住在 ${topDomain} 上了 \u{1F43E}`;
    if (totalSec < 10 * 3600)
      return '这个月你都去哪了？我好无聊 \u{1F63F}';
    return '不错不错，劳逸结合的一个月 \u{1F638}';
  }

  function renderReport() {
    const a = pendingReportData;
    if (!a) return;
    const domainEntries = Object.entries(a)
      .filter(([k]) => k !== 'daily_active_hours' && k !== 'daily_totals')
      .sort((x, y) => y[1] - x[1]);
    const totalSec = domainEntries.reduce((s, [, v]) => s + v, 0);
    const top5 = domainEntries.slice(0, 5);
    const maxTime = top5.length > 0 ? top5[0][1] : 1;
    const dailyTotals = a.daily_totals || {};
    const days = Math.max(Object.keys(dailyTotals).length, 1);
    const avgSec = Math.round(totalSec / days);

    let maxDay = '', maxDayTime = 0;
    for (const [d, s] of Object.entries(dailyTotals)) {
      if (s > maxDayTime) { maxDay = d; maxDayTime = s; }
    }

    const topDomain = top5.length > 0 ? top5[0][0] : '';
    const barColors = ['#333', '#555', '#777', '#999', '#bbb'];

    let barsHtml = '';
    top5.forEach(([domain, sec], i) => {
      const pct = Math.round((sec / maxTime) * 100);
      barsHtml += `
        <div style="display:flex!important;align-items:center!important;margin:6px 0!important">
          <div style="width:110px!important;font-size:12px!important;text-align:right!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#555!important;flex-shrink:0!important">${escapeHtml(domain)}</div>
          <div style="flex:1!important;height:16px!important;background:#eee!important;border-radius:4px!important;margin:0 8px!important;overflow:hidden!important">
            <div style="height:100%!important;width:${pct}%!important;background:${barColors[i]}!important;border-radius:4px!important;transition:width 0.5s ease!important"></div>
          </div>
          <div style="width:70px!important;font-size:11px!important;color:#888!important;flex-shrink:0!important">${fmtDur(sec)}</div>
        </div>`;
    });

    rptCard.innerHTML = `
      <div style="font-size:16px!important;font-weight:bold!important;color:#333!important;margin-bottom:4px!important">
        MooMoo 的观察日记 — ${fmtMonth(pendingReportMonth)}
      </div>
      <div style="font-size:13px!important;color:#999!important;margin-bottom:14px!important">
        \u{1F43E} 我偷偷观察了你一个月哦~
      </div>
      <div style="border-top:1px solid #e8ddd0!important;margin:12px 0!important"></div>
      <div style="display:flex!important;justify-content:space-around!important;margin:12px 0!important;font-size:13px!important;color:#555!important">
        <div><div style="font-size:20px!important;font-weight:bold!important;color:#333!important">${fmtDur(totalSec)}</div>本月总在线</div>
        <div><div style="font-size:20px!important;font-weight:bold!important;color:#333!important">${fmtDur(avgSec)}</div>日均在线</div>
      </div>
      ${maxDay ? `<div style="font-size:12px!important;color:#999!important;margin-bottom:10px!important">最活跃的一天：${fmtDate(maxDay)}（${fmtDur(maxDayTime)}）</div>` : ''}
      <div style="border-top:1px solid #e8ddd0!important;margin:12px 0!important"></div>
      <div style="font-size:13px!important;font-weight:bold!important;color:#555!important;text-align:left!important;margin-bottom:8px!important">Top ${top5.length} 网站</div>
      ${barsHtml}
      <div style="border-top:1px solid #e8ddd0!important;margin:14px 0 10px!important"></div>
      <div style="font-size:14px!important;color:#666!important;margin-bottom:14px!important">${getCatComment(a, topDomain)}</div>
      <button id="mm-rpt-close" style="background:#e8a44a!important;color:#fff!important;border:none!important;border-radius:20px!important;padding:8px 28px!important;font-size:14px!important;cursor:pointer!important;font-family:inherit!important">知道了~</button>
    `;

    const closeBtn = rptCard.querySelector('#mm-rpt-close');
    if (closeBtn) closeBtn.onclick = closeReport;
  }

  function openReport() {
    renderReport();
    rptOverlay.style.setProperty('display', 'flex', 'important');
    requestAnimationFrame(() => {
      rptCard.style.setProperty('transform', 'scale(1)', 'important');
      rptCard.style.setProperty('opacity', '1', 'important');
    });
  }

  function hideReport() {
    rptCard.style.setProperty('transform', 'scale(0.85)', 'important');
    rptCard.style.setProperty('opacity', '0', 'important');
    setTimeout(() => rptOverlay.style.setProperty('display', 'none', 'important'), 300);
  }

  async function closeReport() {
    hideReport();
    if (pendingReportKey) {
      await chrome.storage.local.set({ report_last_shown: pendingReportKey });
    }
    pendingReportData = null;
    pendingReportMonth = null;
    pendingReportKey = null;
  }

  async function initMonthlyReport() {
    try {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevStr = `${prev.getFullYear()}_${String(prev.getMonth() + 1).padStart(2, '0')}`;
      const prevKey = `activity_${prevStr}`;

      const data = await chrome.storage.local.get(['report_last_shown', prevKey]);
      if (data.report_last_shown === prevStr) return;

      const activity = data[prevKey];
      if (!activity) return;

      const domains = Object.keys(activity)
        .filter(k => k !== 'daily_active_hours' && k !== 'daily_totals');
      if (domains.length === 0) return;

      pendingReportData = activity;
      pendingReportMonth = prev;
      pendingReportKey = prevStr;

      notifyReport();
      startNotifyReminder();
      console.log(`[MooMoo] 月度报告就绪: ${fmtMonth(prev)}`);
    } catch (e) {
      console.log('[MooMoo] 月度报告初始化失败:', e);
    }
  }

  // ── 收集品系统 ────────────────────────────────────────────────

  function pickCollectionItem() {
    const rarities = RARITY_BY_STAGE[trustStage.name];
    if (!rarities) return null;
    const totalW = rarities.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
    let roll = Math.random() * totalW;
    let picked = rarities[rarities.length - 1];
    for (const r of rarities) {
      roll -= RARITY_WEIGHTS[r];
      if (roll <= 0) { picked = r; break; }
    }
    const items = COLLECTION_ITEMS.filter(i => i.rarity === picked);
    return items[Math.floor(Math.random() * items.length)];
  }

  async function attemptDrop() {
    if (trustStage.name === '陌生期') return;
    if (droppedItemEl) { scheduleNextDrop(); return; }
    if (state === 'walk' || state === 'startled' || state === 'drop_in') {
      scheduleNextDrop();
      return;
    }
    if (Math.random() < 0.15) {
      const item = pickCollectionItem();
      if (item) {
        await chrome.storage.local.set({ last_drop_time: Date.now() });
        console.log(`[MooMoo] 收集品掉落: ${item.emoji} ${item.name} (${item.rarity})`);
        startCollectionWalk(item);
      }
    }
    scheduleNextDrop();
  }

  function scheduleNextDrop() {
    clearTimeout(collectionDropTimer);
    collectionDropTimer = setTimeout(() => attemptDrop(), rand(30 * 60000, 60 * 60000));
  }

  function startCollectionWalk(item) {
    clearTimers();
    player.stop();
    prevState = state;
    state = 'walk';

    const spriteW = player.frameWidth || 160;
    const vw = window.innerWidth;
    const margin = 20;
    const startX = vw - spriteW - margin;
    const dropX = margin + Math.random() * (vw * 0.3);

    if (startX - dropX < 100) { setState('idle'); return; }

    const dist = startX - dropX;
    const speed = 80 + Math.random() * 40;
    const dur = Math.round(dist / speed * 1000);

    player.play('walk', { loop: true });
    sprite.style.transform = '';
    container.style.setProperty('transition', 'none', 'important');
    container.style.left = startX + 'px';
    container.style.right = 'auto';
    void container.offsetWidth;
    container.style.setProperty('transition', `left ${dur}ms linear`, 'important');
    container.style.left = dropX + 'px';

    stateTimer = setTimeout(() => {
      player.stop();
      player.play('idle', { loop: true });
      showBubble(`${item.emoji} 送给你~`);

      stateTimer = setTimeout(() => {
        const catRect = container.getBoundingClientRect();
        createDroppedItem(item, catRect.left + spriteW / 2);

        setTimeout(() => {
          player.play('walk', { loop: true });
          sprite.style.transform = 'scaleX(-1)';
          container.style.setProperty('transition', 'none', 'important');
          void container.offsetWidth;
          container.style.setProperty('transition', `left ${dur}ms linear`, 'important');
          container.style.left = startX + 'px';

          walkTimer = setTimeout(() => {
            anchorRight();
            setState(pickNext());
          }, dur + 200);
        }, 500);
      }, 2000);
    }, dur + 200);
  }

  function createDroppedItem(item, posX) {
    if (droppedItemEl) { droppedItemEl.remove(); droppedItemEl = null; }
    clearTimeout(droppedItemTimeout);

    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed!important',
      `left:${posX}px!important`,
      'bottom:10px!important',
      'font-size:28px!important',
      'cursor:pointer!important',
      'pointer-events:auto!important',
      'z-index:2147483646!important',
      'transform:translateX(-50%) translateY(-20px)!important',
      'opacity:0!important',
      'transition:transform 0.4s ease,opacity 0.4s ease,filter 0.3s ease!important',
      'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2))!important',
      'user-select:none!important',
      'line-height:1!important',
    ].join(';');
    el.textContent = item.emoji;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.setProperty('transform', 'translateX(-50%) translateY(0)', 'important');
      el.style.setProperty('opacity', '1', 'important');
    });

    el.addEventListener('mouseenter', () => {
      el.style.setProperty('filter', 'drop-shadow(0 2px 10px rgba(255,200,50,0.6))', 'important');
      el.style.setProperty('transform', 'translateX(-50%) scale(1.2)', 'important');
    });
    el.addEventListener('mouseleave', () => {
      el.style.setProperty('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))', 'important');
      el.style.setProperty('transform', 'translateX(-50%) scale(1)', 'important');
    });

    el.addEventListener('click', e => {
      e.stopPropagation();
      collectItem(item, el);
    });

    droppedItemEl = el;

    droppedItemTimeout = setTimeout(() => {
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('transform', 'translateX(-50%) translateY(-10px)', 'important');
      setTimeout(() => { el.remove(); droppedItemEl = null; }, 400);
      showBubble('...叼走了');
    }, 60000);
  }

  async function collectItem(item, el) {
    clearTimeout(droppedItemTimeout);
    el.style.setProperty('pointer-events', 'none', 'important');

    const rect = el.getBoundingClientRect();
    const targetX = window.innerWidth - 40;

    el.style.setProperty('transition', 'all 0.6s cubic-bezier(0.25,0.46,0.45,0.94)', 'important');
    el.style.setProperty('left', targetX + 'px', 'important');
    el.style.setProperty('bottom', '40px', 'important');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('transform', 'translateX(-50%) scale(0.3)', 'important');

    const plus = document.createElement('div');
    plus.textContent = '+1';
    plus.style.cssText = [
      'position:fixed!important',
      `left:${Math.round(rect.left + rect.width / 2)}px!important`,
      `top:${Math.round(rect.top)}px!important`,
      'font-size:20px!important',
      'font-weight:bold!important',
      'color:#e8a44a!important',
      'pointer-events:none!important',
      'z-index:2147483647!important',
      'transition:all 0.8s ease-out!important',
      'font-family:-apple-system,"Segoe UI",sans-serif!important',
      'text-shadow:0 1px 3px rgba(0,0,0,0.15)!important',
      'transform:translateX(-50%)!important',
    ].join(';');
    document.body.appendChild(plus);

    requestAnimationFrame(() => {
      plus.style.setProperty('top', Math.round(rect.top - 50) + 'px', 'important');
      plus.style.setProperty('opacity', '0', 'important');
    });

    setTimeout(() => { el.remove(); droppedItemEl = null; plus.remove(); }, 800);

    const data = await chrome.storage.local.get('collection');
    const collection = data.collection || {};
    collection[item.id] = (collection[item.id] || 0) + 1;
    await chrome.storage.local.set({ collection });

    if (item.rarity === 'rare' || item.rarity === 'legendary') {
      showBubble('✨ 稀有发现！');
    } else {
      showBubble('喵~');
    }
  }

  // ── 收藏柜 ────────────────────────────────────────────────────

  const RARITY_COLORS = {
    common: '#8a7a6a', uncommon: '#4a8a4a', rare: '#4a6ab0', legendary: '#b04aa0',
  };

  async function renderCollectionCabinet() {
    const data = await chrome.storage.local.get('collection');
    const collection = data.collection || {};
    let collected = 0;

    let gridHtml = '';
    COLLECTION_ITEMS.forEach(item => {
      const count = collection[item.id] || 0;
      if (count > 0) collected++;

      if (count > 0) {
        const rc = RARITY_COLORS[item.rarity];
        gridHtml += `
          <div style="display:flex!important;flex-direction:column!important;align-items:center!important;
            padding:8px 4px!important;border-radius:8px!important;background:rgba(255,255,255,0.5)!important">
            <div style="font-size:26px!important;line-height:1.2!important">${item.emoji}</div>
            <div style="font-size:10px!important;color:${rc}!important;margin-top:2px!important;font-weight:bold!important">${item.name}</div>
            <div style="font-size:10px!important;color:#9a8a7a!important">×${count}</div>
          </div>`;
      } else {
        gridHtml += `
          <div style="display:flex!important;flex-direction:column!important;align-items:center!important;
            padding:8px 4px!important;border-radius:8px!important;background:rgba(0,0,0,0.04)!important">
            <div style="font-size:26px!important;line-height:1.2!important;opacity:0.2!important">?</div>
            <div style="font-size:10px!important;color:#ccc!important;margin-top:2px!important">???</div>
            <div style="font-size:10px!important;color:transparent!important">×0</div>
          </div>`;
      }
    });

    colCard.innerHTML = `
      <div style="font-size:18px!important;font-weight:bold!important;color:#5a4a3a!important;margin-bottom:4px!important">
        \u{1F5C4}️ 收藏柜
      </div>
      <div style="font-size:12px!important;color:#9a8a7a!important;margin-bottom:12px!important">
        MooMoo 帮你收集的宝贝~
      </div>
      <div style="border-top:1px dashed #c4a882!important;margin:8px 0 12px!important"></div>
      <div style="display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:6px!important;margin-bottom:12px!important">
        ${gridHtml}
      </div>
      <div style="border-top:1px dashed #c4a882!important;margin:8px 0!important"></div>
      <div style="font-size:13px!important;color:#8a7a6a!important;margin:10px 0!important">
        已收集 ${collected}/20 种
      </div>
      <div style="width:80%!important;height:6px!important;background:#e0d4c4!important;border-radius:3px!important;
        margin:0 auto 14px!important;overflow:hidden!important">
        <div style="height:100%!important;width:${collected / 20 * 100}%!important;background:#e8a44a!important;
          border-radius:3px!important;transition:width 0.5s ease!important"></div>
      </div>
      <button id="mm-col-close" style="${BTN_SECONDARY}">关闭</button>
    `;

    const closeBtn = colCard.querySelector('#mm-col-close');
    if (closeBtn) closeBtn.onclick = hideCollectionCabinet;
  }

  async function openCollectionCabinet() {
    await renderCollectionCabinet();
    colOverlay.style.setProperty('display', 'flex', 'important');
    requestAnimationFrame(() => {
      colCard.style.setProperty('transform', 'scale(1)', 'important');
      colCard.style.setProperty('opacity', '1', 'important');
    });
  }

  function hideCollectionCabinet() {
    colCard.style.setProperty('transform', 'scale(0.85)', 'important');
    colCard.style.setProperty('opacity', '0', 'important');
    setTimeout(() => colOverlay.style.setProperty('display', 'none', 'important'), 300);
  }

  // ── 设置面板 ──────────────────────────────────────────────────

  async function renderSettingsPanel() {
    let hasKey = false;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'moomoo-get-apikey-status' });
      hasKey = result && result.hasKey;
    } catch (_) {}

    const now = new Date();
    const callKey = `api_calls_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
    const callData = await chrome.storage.local.get(callKey);
    const callCount = callData[callKey] || 0;

    settingsCard.innerHTML = `
      <div style="font-size:18px!important;font-weight:bold!important;color:#5a4a3a!important;margin-bottom:4px!important">
        \u{1F527} 设置
      </div>
      <div style="border-top:1px dashed #c4a882!important;margin:10px 0!important"></div>
      <div style="font-size:14px!important;font-weight:bold!important;color:#5a4a3a!important;margin-bottom:8px!important;text-align:left!important">
        DeepSeek API
      </div>
      <div style="display:flex!important;align-items:center!important;margin-bottom:10px!important;font-size:13px!important;text-align:left!important">
        <span style="color:#8a7a6a!important">状态：</span>
        <span style="color:${hasKey ? '#6ab04c' : '#cc6666'}!important;font-weight:bold!important">
          ${hasKey ? '✅ 已设置' : '❌ 未设置'}
        </span>
      </div>
      <div style="margin-bottom:10px!important">
        <input id="mm-api-key-input" type="password" placeholder="输入 DeepSeek API Key..."
          style="width:100%!important;box-sizing:border-box!important;padding:8px 12px!important;
          border:1px solid #c4a882!important;border-radius:8px!important;font-size:13px!important;
          font-family:inherit!important;background:rgba(255,255,255,0.6)!important;color:#5a4a3a!important;
          outline:none!important" />
      </div>
      <div style="margin-bottom:12px!important">
        <button id="mm-api-save" style="${BTN_PRIMARY}">保存</button>
        <button id="mm-api-clear" style="${BTN_SECONDARY}">立即清除 API Key</button>
      </div>
      <div style="border-top:1px dashed #c4a882!important;margin:10px 0!important"></div>
      <div style="font-size:12px!important;color:#9a8a7a!important;margin-bottom:14px!important">
        本月调用次数：${callCount}
      </div>
      <button id="mm-settings-close" style="${BTN_SECONDARY}">关闭</button>
    `;

    const q = s => settingsCard.querySelector(s);
    q('#mm-api-save').onclick = async () => {
      const key = q('#mm-api-key-input').value.trim();
      if (!key) return;
      try {
        await chrome.runtime.sendMessage({ type: 'moomoo-save-apikey', key });
        q('#mm-api-key-input').value = '';
        showBubble('API Key 已保存~');
        await renderSettingsPanel();
      } catch (_) {}
    };
    q('#mm-api-clear').onclick = async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'moomoo-clear-apikey' });
        showBubble('API Key 已清除');
        await renderSettingsPanel();
      } catch (_) {}
    };
    q('#mm-settings-close').onclick = hideSettingsPanel;
  }

  async function openSettingsPanel() {
    await renderSettingsPanel();
    settingsOverlay.style.setProperty('display', 'flex', 'important');
    requestAnimationFrame(() => {
      settingsCard.style.setProperty('transform', 'scale(1)', 'important');
      settingsCard.style.setProperty('opacity', '1', 'important');
    });
  }

  function hideSettingsPanel() {
    settingsCard.style.setProperty('transform', 'scale(0.85)', 'important');
    settingsCard.style.setProperty('opacity', '0', 'important');
    setTimeout(() => settingsOverlay.style.setProperty('display', 'none', 'important'), 300);
  }

  async function initCollectionSystem() {
    if (trustStage.name === '陌生期') return;
    try {
      const data = await chrome.storage.local.get('last_drop_time');
      const lastDrop = data.last_drop_time || 0;
      const elapsed = Date.now() - lastDrop;
      const minInterval = 30 * 60000;
      let delay;
      if (elapsed >= minInterval) {
        delay = rand(60000, 180000);
      } else {
        delay = (minInterval - elapsed) + rand(0, 30 * 60000);
      }
      collectionDropTimer = setTimeout(() => attemptDrop(), delay);
      console.log(`[MooMoo] 收集品系统就绪，下次检查: ${Math.round(delay / 60000)}分钟后`);
    } catch (e) {
      console.log('[MooMoo] 收集品系统初始化失败:', e);
    }
  }

  // ── 初始化信任系统并入场 ──────────────────────────────────────
  (async () => {
    let isFirstInstall = false;
    try {
      const data = await chrome.storage.local.get('moomoo_install_date');
      if (!data.moomoo_install_date) {
        const today = new Date().toISOString().slice(0, 10);
        await chrome.storage.local.set({ moomoo_install_date: today });
        daysSinceInstall = 1;
        isFirstInstall = true;
      } else {
        const install = new Date(data.moomoo_install_date);
        const now = new Date();
        daysSinceInstall = Math.max(1, Math.floor((now - install) / 86400000) + 1);
      }
    } catch (e) {
      daysSinceInstall = 1;
    }
    trustStage = getTrustStage(daysSinceInstall);
    console.log(`[MooMoo] 安装天数: ${daysSinceInstall} | 阶段: ${trustStage.name}`);
    setState('drop_in');

    setTimeout(() => initChallengeSystem(isFirstInstall), 5000);
    setTimeout(() => initMonthlyReport(), 8000);
    setTimeout(() => initCollectionSystem(), 10000);
  })();

  // ── 调试工具 ───────────────────────────────────────────────────
  window.moomooSetDay = function(day) {
    daysSinceInstall = day;
    trustStage = getTrustStage(day);
    console.log(`[MooMoo] 手动设置 → 安装天数: ${day} | 阶段: ${trustStage.name}`);
  };

  window.moomooChallenge = function() {
    console.log('[MooMoo] 手动触发挑战...');
    forceNewChallenge();
  };

  window.moomooReport = async function(monthStr) {
    const now = new Date();
    const m = monthStr
      ? `activity_${monthStr}`
      : `activity_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
    const data = await chrome.storage.local.get(m);
    const activity = data[m];
    if (!activity) { console.log(`[MooMoo] 无数据: ${m}`); return; }
    const prev = monthStr
      ? new Date(parseInt(monthStr.split('_')[0]), parseInt(monthStr.split('_')[1]) - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    pendingReportData = activity;
    pendingReportMonth = prev;
    pendingReportKey = null;
    openReport();
  };

  window.momooDrop = function() {
    console.log('[MooMoo] 手动触发收集品掉落...');
    const item = pickCollectionItem();
    if (item) {
      console.log(`[MooMoo] 掉落: ${item.emoji} ${item.name} (${item.rarity})`);
      startCollectionWalk(item);
    } else {
      console.log('[MooMoo] 当前信任阶段无可掉落物品');
    }
  };

  window.moomooCollection = async function() {
    const data = await chrome.storage.local.get('collection');
    console.log('[MooMoo] 收藏品:', data.collection || {});
    openCollectionCabinet();
  };
})();
