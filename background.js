// ── 闹钟初始化 ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => setupAlarms());
chrome.runtime.onStartup.addListener(() => setupAlarms());

async function setupAlarms() {
  if (!(await chrome.alarms.get('moomoo-weekly'))) {
    chrome.alarms.create('moomoo-weekly', {
      when: nextMonday9AM(), periodInMinutes: 10080,
    });
  }
  if (!(await chrome.alarms.get('moomoo-monthly'))) {
    chrome.alarms.create('moomoo-monthly', { when: nextFirst9AM() });
  }
  if (!(await chrome.alarms.get('moomoo-tick'))) {
    chrome.alarms.create('moomoo-tick', { periodInMinutes: 0.5 });
  }
}

function nextMonday9AM() {
  const now = new Date(), t = new Date(now);
  t.setHours(9, 0, 0, 0);
  const day = now.getDay();
  let add;
  if (day === 1 && now.getTime() < t.getTime()) add = 0;
  else add = ((8 - day) % 7) || 7;
  t.setDate(t.getDate() + add);
  return t.getTime();
}

function nextFirst9AM() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0, 0).getTime();
}

// ── 活动记录系统 ──────────────────────────────────────────────
let lastTickTime = Date.now();

function getDomain(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'chrome:' || u.protocol === 'chrome-extension:'
        || u.protocol === 'about:' || u.protocol === 'edge:') return null;
    return u.hostname;
  } catch { return null; }
}

function monthKey(d) {
  d = d || new Date();
  return `activity_${d.getFullYear()}_${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function recordTime(domain, seconds) {
  if (!domain || seconds <= 0) return;
  const key = monthKey();
  const dateStr = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();

  const raw = await chrome.storage.local.get(key);
  const a = raw[key] || {};

  a[domain] = (a[domain] || 0) + seconds;

  if (!a.daily_active_hours) a.daily_active_hours = {};
  if (!a.daily_active_hours[dateStr]) a.daily_active_hours[dateStr] = [];
  if (!a.daily_active_hours[dateStr].includes(hour))
    a.daily_active_hours[dateStr].push(hour);

  if (!a.daily_totals) a.daily_totals = {};
  a.daily_totals[dateStr] = (a.daily_totals[dateStr] || 0) + seconds;

  await chrome.storage.local.set({ [key]: a });
}

async function tick() {
  try {
    const win = await chrome.windows.getLastFocused();
    if (!win || !win.focused) { lastTickTime = Date.now(); return; }

    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    if (!tab || !tab.url) { lastTickTime = Date.now(); return; }

    const domain = getDomain(tab.url);
    const now = Date.now();
    const elapsed = Math.min(Math.round((now - lastTickTime) / 1000), 120);
    lastTickTime = now;

    if (domain && elapsed > 0) await recordTime(domain, elapsed);
  } catch (_) {
    lastTickTime = Date.now();
  }
}

// ── 闹钟事件 ────────────────────────────────────────────────
async function broadcast(type) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try { await chrome.tabs.sendMessage(tab.id, { type }); }
    catch (_) {}
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'moomoo-tick') {
    await tick();
  } else if (alarm.name === 'moomoo-weekly') {
    await broadcast('moomoo-challenge-time');
  } else if (alarm.name === 'moomoo-monthly') {
    await broadcast('moomoo-report-time');
    chrome.alarms.create('moomoo-monthly', { when: nextFirst9AM() });
  }
});

// ── 标签切换时刷新计时 ──────────────────────────────────────
chrome.tabs.onActivated.addListener(() => tick());
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url) tick();
});

// ── DeepSeek API 挑战生成 ──────────────────────────────────────
const DEEPSEEK_SYSTEM_PROMPT = '你是一只叫 MooMoo 的奶牛猫，性格大条、神经兮兮、充满好奇心。你每周给主人出一个小挑战，风格随机不可捉摸。挑战可以是：生活探索（尝试新食物新路线）、知识拓展（看纪录片读报告）、思维锻炼（推理题辩论题写作）、创意挑战（画画做手工）中的任何一种。难度随机，有时超简单有时有点难，就像猫咪的心情一样不可预测。用猫咪的口吻描述挑战，简短有趣，一两句话就好，带一个合适的 emoji。只输出挑战内容本身，不要多余的解释。';

async function generateChallengeFromAPI() {
  try {
    const data = await chrome.storage.session.get('deepseek_api_key');
    const apiKey = data.deepseek_api_key;
    if (!apiKey) return { fallback: true, reason: 'no_key' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: 100,
        messages: [
          { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
          { role: 'user', content: '喵~ 给主人出这周的挑战吧！' },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!resp.ok) return { fallback: true, reason: `api_${resp.status}` };

    const json = await resp.json();
    const content = json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content.trim() : '';
    if (!content) return { fallback: true, reason: 'empty_response' };

    const now = new Date();
    const callKey = `api_calls_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
    const callData = await chrome.storage.local.get(callKey);
    await chrome.storage.local.set({ [callKey]: (callData[callKey] || 0) + 1 });

    return { fallback: false, content };
  } catch (e) {
    return { fallback: true, reason: e.name === 'AbortError' ? 'timeout' : 'error' };
  }
}

// ── 响应消息 ────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'moomoo-clear-activity') {
    chrome.storage.local.get(null).then(all => {
      const keys = Object.keys(all).filter(k => k.startsWith('activity_'));
      keys.push('report_last_shown');
      return chrome.storage.local.remove(keys);
    }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'moomoo-generate-challenge') {
    generateChallengeFromAPI().then(sendResponse);
    return true;
  }
  if (msg.type === 'moomoo-save-apikey') {
    chrome.storage.session.set({ deepseek_api_key: msg.key })
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'moomoo-get-apikey-status') {
    chrome.storage.session.get('deepseek_api_key')
      .then(data => sendResponse({ hasKey: !!data.deepseek_api_key }));
    return true;
  }
  if (msg.type === 'moomoo-clear-apikey') {
    chrome.storage.session.remove('deepseek_api_key')
      .then(() => sendResponse({ ok: true }));
    return true;
  }
});
