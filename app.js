(function () {
'use strict';
const BANK = window.BANK;

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const words = s => (s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9'\s-]/g, ' ').replace(/(^|\s)-+|-+(\s|$)/g, ' ').split(/\s+/).filter(Boolean);
const wc = s => (s || '').trim().split(/\s+/).filter(Boolean).length;
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = s => { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const pteScore = p => Math.round(10 + 80 * clamp(p, 0, 1));
const r1 = v => Math.round(v * 10) / 10;

function lcsMask(ref, hyp) {
  const m = ref.length, n = hyp.length, dp = Array.from({ length: m + 1 }, () => new Int16Array(n + 1));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = ref[i - 1] === hyp[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const mask = new Array(m).fill(false); let i = m, j = n;
  while (i > 0 && j > 0) { if (ref[i - 1] === hyp[j - 1]) { mask[i - 1] = true; i--; j--; } else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--; }
  return { mask, matched: dp[m][n] };
}
function coverage(text, kps) {
  const t = ' ' + (text || '').toLowerCase() + ' ', hit = [], miss = [];
  (kps || []).forEach(g => (g.some(k => t.includes(String(k).toLowerCase())) ? hit : miss).push(g[0]));
  return { cov: kps && kps.length ? hit.length / kps.length : 0, hit, miss };
}

/* ---------------- task catalogue ---------------- */
const TASKS = {
  RA: { name: 'Read Aloud', part: 'Speaking', skills: ['Speaking', 'Reading'], w: 4, prep: 35, rec: 40 },
  RS: { name: 'Repeat Sentence', part: 'Speaking', skills: ['Speaking', 'Listening'], w: 5, prep: 0, rec: 15 },
  DI: { name: 'Describe Image', part: 'Speaking', skills: ['Speaking'], w: 3, prep: 25, rec: 40 },
  RL: { name: 'Retell Lecture', part: 'Speaking', skills: ['Speaking', 'Listening'], w: 3, prep: 10, rec: 40 },
  ASQ: { name: 'Answer Short Question', part: 'Speaking', skills: ['Speaking', 'Listening'], w: 1, prep: 0, rec: 10 },
  SGD: { name: 'Summarize Group Discussion', part: 'Speaking', skills: ['Speaking', 'Listening'], w: 3, prep: 10, rec: 120, isNew: true },
  RTS: { name: 'Respond to a Situation', part: 'Speaking', skills: ['Speaking'], w: 2, prep: 20, rec: 40, isNew: true },
  SWT: { name: 'Summarize Written Text', part: 'Writing', skills: ['Writing', 'Reading'], w: 3, time: 600 },
  WE: { name: 'Write Essay', part: 'Writing', skills: ['Writing'], w: 3, time: 1200 },
  RWFIB: { name: 'Reading & Writing: Fill in the Blanks', part: 'Reading', skills: ['Reading', 'Writing'], w: 4 },
  RMCM: { name: 'Multiple Choice, Multiple Answers', part: 'Reading', skills: ['Reading'], w: 1 },
  RO: { name: 'Re-order Paragraphs', part: 'Reading', skills: ['Reading'], w: 2 },
  RFIB: { name: 'Reading: Fill in the Blanks', part: 'Reading', skills: ['Reading'], w: 4 },
  RMCS: { name: 'Multiple Choice, Single Answer', part: 'Reading', skills: ['Reading'], w: 1 },
  SST: { name: 'Summarize Spoken Text', part: 'Listening', skills: ['Listening', 'Writing'], w: 3, time: 600 },
  LMCM: { name: 'Multiple Choice, Multiple Answers', part: 'Listening', skills: ['Listening'], w: 1 },
  LFIB: { name: 'Fill in the Blanks', part: 'Listening', skills: ['Listening', 'Writing'], w: 3 },
  HCS: { name: 'Highlight Correct Summary', part: 'Listening', skills: ['Listening', 'Reading'], w: 1 },
  LMCS: { name: 'Multiple Choice, Single Answer', part: 'Listening', skills: ['Listening'], w: 1 },
  SMW: { name: 'Select Missing Word', part: 'Listening', skills: ['Listening'], w: 1 },
  HIW: { name: 'Highlight Incorrect Words', part: 'Listening', skills: ['Listening', 'Reading'], w: 4 },
  WFD: { name: 'Write from Dictation', part: 'Listening', skills: ['Listening', 'Writing'], w: 5 }
};
const ORDER = Object.keys(TASKS);
const PARTS = ['Speaking', 'Writing', 'Reading', 'Listening'];
const SKILLS = ['Speaking', 'Writing', 'Reading', 'Listening'];

const INSTR = {
  RA: 'Look at the text below. In 35 seconds, you must read this text aloud as naturally and clearly as possible. You have 40 seconds to read aloud.',
  RS: 'You will hear a sentence. Please repeat the sentence exactly as you hear it. You will hear the sentence only once.',
  DI: 'Look at the image below. In 25 seconds, please speak into the microphone and describe in detail what the image is showing. You will have 40 seconds to give your response.',
  RL: 'You will hear a lecture. After listening, you have 10 seconds to prepare, then 40 seconds to retell the lecture in your own words.',
  ASQ: 'You will hear a question. Please give a simple and short answer. Often just one or a few words is enough.',
  SGD: 'You will hear a group discussion. After the discussion, you have 10 seconds to prepare, then 2 minutes to summarize the discussion, including the main points each speaker made.',
  RTS: 'Read the situation. You have 20 seconds to prepare. Then speak your response directly to the person, as you would in real life. You have 40 seconds.',
  SWT: 'Read the passage below and summarize it using one sentence. You have 10 minutes. Your response must be between 5 and 75 words.',
  WE: 'You will have 20 minutes to plan, write and revise an essay about the topic below. Your response will be judged on how well you develop a position, organize ideas, present supporting details, and control the elements of standard written English. You should write 200-300 words.',
  RWFIB: 'Below is a text with blanks. Select the appropriate answer choice for each blank.',
  RMCM: 'Read the text and answer the question by selecting all the correct responses. More than one response is correct.',
  RO: 'The text boxes below have been placed in a random order. Restore the original order.',
  RFIB: 'In the text below some words are missing. Move words from the box to the appropriate place in the text. There are more words than you need.',
  RMCS: 'Read the text and answer the multiple-choice question by selecting the correct response. Only one response is correct.',
  SST: 'You will hear a short lecture. Write a summary for a fellow student who was not present. You should write 50-70 words. You have 10 minutes.',
  LMCM: 'Listen to the recording and answer the question by selecting all the correct responses. More than one response is correct.',
  LFIB: 'You will hear a recording. Type the missing words in each blank.',
  HCS: 'You will hear a recording. Select the paragraph that best summarizes the recording.',
  LMCS: 'Listen to the recording and answer the multiple-choice question by selecting the correct response. Only one response is correct.',
  SMW: 'You will hear a recording. At the end of the recording the last word or group of words has been replaced by a beep. Select the correct option to complete the recording.',
  HIW: 'You will hear a recording. Below is a transcription of the recording. Some words in the transcription differ from what the speaker said. Click on the words that are different.',
  WFD: 'You will hear a sentence. Type the sentence in the box below exactly as you hear it. Write as much of the sentence as you can. You will hear the sentence only once.'
};

const TIPS = {
  RA: 'استغل الـ35 ثانية تقسّم النص لـ chunks وتحدد الكلمات الصعبة. اقرا بسرعة كلام طبيعي (حوالي 2.5 كلمة في الثانية). لو غلطت في كلمة كمّل ومترجعش: الطلاقة بتجيب نقط أكتر من التصحيح.',
  RS: 'أهم سؤال في الـ Speaking والـ Listening مع بعض. ابدأ فوراً بعد البيب بنفس الإيقاع اللي سمعته. لو نسيت كلمة كمّل الباقي بثقة، وأوعى تسكت 3 ثواني لأن المايك بيقفل.',
  DI: 'Template ثابت: النوع والعنوان، أعلى قيمة بالرقم، تاني قيمة، أقل قيمة، مقارنة أو ترند، وجملة خاتمة. اتكلم 35 ثانية من غير وقفات، والرقم الصح أهم من الوصف الطويل.',
  RL: 'اكتب الكلمات المفتاحية (أسماء وأرقام) وانت بتسمع. قول: The lecture was about… The speaker mentioned… He also explained… In conclusion… وحط فيها أكبر عدد من الـ keywords.',
  ASQ: 'كلمة أو كلمتين بس، ومن غير ما تعيد السؤال. لو مش عارف قول أقرب إجابة على طول.',
  SGD: 'نوع جديد من 2025. اكتب مين قال إيه (A / B / C). لخّص الموضوع، ورأي كل متحدث بسببه، وبعدين اللي اتفقوا عليه في الآخر. عندك دقيقتين، فاتكلم حوالي 90 ثانية متواصلة.',
  RTS: 'نوع جديد من 2025. كلّم الشخص مباشرة وبأدب: تحية، وبعدين المشكلة، وبعدين طلبك أو اقتراحك، وشكر في الآخر. استخدم could you / would it be possible وخليك في الموقف بالظبط.',
  SWT: 'جملة واحدة بس، من 25 لـ 50 كلمة، فيها نقطة واحدة في الآخر. الفكرة الرئيسية وأهم نقطتين، واربطهم بـ which أو while أو although أو ; and. لو كتبت جملتين بتاخد صفر في كل حاجة.',
  WE: 'بين 200 و 300 كلمة، و 4 فقرات: مقدمة فيها رأيك، وفقرتين بمثال في كل واحدة، وخاتمة. كرر الكلمات المفتاحية من السؤال، وسيب آخر دقيقتين للمراجعة الإملائية.',
  RWFIB: 'حدد نوع الكلمة المطلوبة (noun / verb / adjective / adverb) والـ collocation الصح. اقرا الجملة كلها قبل ما تختار، مش الكلمتين اللي جنب الفراغ بس.',
  RMCM: 'كل إجابة غلط بتشيل نقطة. اختار بس اللي متأكد منه مية في المية، وغالباً الإجابات الصح اتنين.',
  RO: 'دوّر على الجملة اللي تبدأ بيها: فكرة عامة ومفيهاش he / this / however. بعدين اربط الباقي بالضمائر والـ connectors وترتيب الأحداث. التصحيح بيتحسب على كل زوج متجاور صح.',
  RFIB: 'نوع الكلمة، وبعدين المعنى، وبعدين الـ collocation. الكلمات الزيادة متحطوطة مخصوص عشان تلخبطك.',
  RMCS: 'اقرا السؤال الأول وبعدين دوّر في النص. وزنه قليل، فمتضيعش فيه أكتر من دقيقتين.',
  SST: 'من 50 لـ 70 كلمة بالظبط. اكتب notes. Template: The speaker discussed… He explained that… Moreover… Finally… واعمل مراجعة إملائية في الآخر.',
  LMCM: 'فيه سالب على الإجابة الغلط زي الريدنج. وزنه قليل، فمتخاطرش.',
  LFIB: 'اكتب أول حرفين من كل كلمة وانت بتسمع وكملها بعدين. الإملاء لازم يبقى صح 100% عشان تاخد النقطة.',
  HCS: 'اختار الملخص اللي بيغطي الفكرة كلها، مش اللي فيه تفصيلة صح بس.',
  LMCS: 'ركّز على الغرض الرئيسي من الكلام والجملة الأخيرة.',
  SMW: 'ركّز في آخر 10 ثواني وفي اتجاه الكلام المنطقي.',
  HIW: 'امشي بالماوس على الكلمات مع الصوت. اضغط بس على الكلمة اللي متأكد إنها اتغيرت، لأن فيه سالب على الغلط. سؤال وزنه عالي.',
  WFD: 'أهم سؤال في الـ Listening والـ Writing. اكتب كل كلمة سمعتها حتى لو مش متأكد من الترتيب، وراجع الـ s والجمع والإملاء. كل كلمة صح بنقطة.'
};

/* ---------------- state + storage ---------------- */
const ST = { attempts: [], gen: {}, settings: { replay: true } };
const LS_KEY = 'band80.v1';
let DB = null, UID = null, saveTimer = null, genDirty = false, SAMPLE = null;
function loadLocal() { try { const o = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (o) { ST.attempts = o.attempts || []; ST.gen = o.gen || {}; ST.settings = Object.assign(ST.settings, o.settings || {}); } } catch (e) { } }
function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(ST)); } catch (e) { } }
function save() {
  saveLocal();
  if (!DB) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await DB.doc('data/users/' + UID + '/state').set({ attempts: ST.attempts.slice(-1500), settings: ST.settings });
      if (genDirty) { genDirty = false; await DB.doc('data/users/' + UID + '/gen').set({ gen: ST.gen }); }
    } catch (e) { }
  }, 1200);
}
function mergeAttempts(a, b) {
  const seen = new Set(), out = [];
  a.concat(b).forEach(x => { const k = x.t + '|' + x.id; if (!seen.has(k)) { seen.add(k); out.push(x); } });
  return out.sort((x, y) => x.t - y.t);
}
async function initCloud() {
  if (!window.claude || !window.claude.use) return;
  claude.use('sample').then(s => { SAMPLE = s; ENV.ai = !!s; renderEnv(); refreshView(); }).catch(() => { });
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!db || !user) return;
    const id = await user.id();
    if (!id) return;
    DB = db; UID = id;
    const [s, g] = await Promise.all([db.doc('data/users/' + id + '/state').get(), db.doc('data/users/' + id + '/gen').get()]);
    if (s.exists) { const d = s.data(); ST.attempts = mergeAttempts(ST.attempts, d.attempts || []); ST.settings = Object.assign({}, ST.settings, d.settings || {}); }
    if (g.exists) { const d = g.data().gen || {}; Object.keys(d).forEach(k => { const have = new Set((ST.gen[k] || []).map(x => x.id)); ST.gen[k] = (ST.gen[k] || []).concat((d[k] || []).filter(x => !have.has(x.id))); }); }
    ENV.sync = true; saveLocal(); renderEnv(); refreshView();
  } catch (e) { }
}
function items(code) { return (BANK[code] || []).concat(ST.gen[code] || []); }
function attemptsFor(code) { return ST.attempts.filter(a => a.c === code); }
function addAttempt(code, item, res, mode) {
  const a = { t: Date.now(), c: code, id: item.id, s: r1(res.s), m: res.m, p: Math.round(clamp(res.pct, 0, 1) * 1000) / 1000, mode, self: !!res.self, ai: !!res.ai };
  ST.attempts.push(a); save(); return a;
}

/* ---------------- environment ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const ENV = { mic: (SR && navigator.mediaDevices && window.MediaRecorder) ? 'unknown' : false, ai: false, sync: false, tts: 'speechSynthesis' in window };
function renderEnv() {
  const m = $('#env-mic'), a = $('#env-ai'), s = $('#env-sync');
  if (m) { m.dataset.state = ENV.mic === true ? 'on' : ENV.mic === false ? 'off' : 'wait'; m.querySelector('b').textContent = ENV.mic === true ? 'Mic scoring on' : ENV.mic === false ? 'Mic off: self-rated speaking' : 'Mic: asks on first speaking task'; }
  if (a) { a.dataset.state = ENV.ai ? 'on' : 'off'; a.querySelector('b').textContent = ENV.ai ? 'AI examiner on' : 'AI examiner off'; }
  if (s) { s.dataset.state = ENV.sync ? 'on' : 'off'; s.querySelector('b').textContent = ENV.sync ? 'Progress synced' : 'Saved in this browser'; }
  [m, a, s].forEach(el => { if (el) { el.title = el.textContent; el.setAttribute('aria-label', el.textContent); } });
}

/* ---------------- audio: TTS, beep, mic ---------------- */
let AC = null;
const getAC = () => { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; };
function beep(freq = 880, ms = 220) {
  return new Promise(res => {
    try {
      const ac = getAC(), o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = freq; o.type = 'sine'; g.gain.value = 0.0001;
      o.connect(g); g.connect(ac.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000);
      o.stop(ac.currentTime + ms / 1000 + 0.05);
      setTimeout(res, ms + 80);
    } catch (e) { res(); }
  });
}
const TTS = {
  voices: [], aborted: false,
  load() { try { const v = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang)); const pref = v.filter(x => /en[-_](GB|AU)/i.test(x.lang)); const us = v.filter(x => /en[-_]US/i.test(x.lang)); this.voices = pref.concat(us, v.filter(x => !pref.includes(x) && !us.includes(x))); } catch (e) { } },
  pick(i) { return this.voices.length ? this.voices[i % this.voices.length] : null; },
  speak(text, vi = 0, rate = 0.95) {
    return new Promise(res => {
      if (!ENV.tts) { res(false); return; }
      this.aborted = false;
      const parts = String(text).match(/[^.!?;]+[.!?;]*/g) || [String(text)];
      let k = 0, guard;
      const next = () => {
        clearTimeout(guard);
        if (this.aborted || k >= parts.length) { res(true); return; }
        const chunk = parts[k++].trim(); if (!chunk) { next(); return; }
        const u = new SpeechSynthesisUtterance(chunk), v = this.pick(vi);
        if (v) u.voice = v; u.lang = v ? v.lang : 'en-GB'; u.rate = rate; u.pitch = vi % 2 ? 0.92 : 1.04;
        u.onend = next; u.onerror = next;
        guard = setTimeout(next, 1500 + wc(chunk) * 700);
        speechSynthesis.speak(u);
      };
      try { speechSynthesis.cancel(); } catch (e) { }
      next();
    });
  },
  stop() { this.aborted = true; try { speechSynthesis.cancel(); } catch (e) { } }
};
if (ENV.tts) { TTS.load(); try { speechSynthesis.onvoiceschanged = () => TTS.load(); } catch (e) { } }

let MIC = null;
async function getMic() {
  if (MIC && MIC.active) return MIC;
  if (!SR || !navigator.mediaDevices) throw new Error('nosupport');
  MIC = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  ENV.mic = true; renderEnv(); return MIC;
}

/* cleanup registry for leaving a task mid-way */
let CLEAN = [];
const FLOW = { skip: null };
function cleanup() { const c = CLEAN; CLEAN = []; c.forEach(f => { try { f(); } catch (e) { } }); TTS.stop(); FLOW.skip = null; }

function waitClock(sec, onTick, skippable = true) {
  return new Promise(res => {
    const t0 = performance.now(); let done = false;
    const fin = why => { if (done) return; done = true; clearInterval(iv); if (FLOW.skip === skip) FLOW.skip = null; res(why); };
    const skip = () => fin('skip');
    const iv = setInterval(() => { const left = sec - (performance.now() - t0) / 1000; onTick && onTick(left, sec); if (left <= 0) fin('time'); }, 100);
    onTick && onTick(sec, sec);
    if (skippable) FLOW.skip = skip;
    CLEAN.push(() => fin('abort'));
  });
}

function record(maxSec, ui) {
  return new Promise(async resolve => {
    const stream = await getMic();
    const ac = getAC(), src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
    an.fftSize = 1024; src.connect(an); const buf = new Float32Array(an.fftSize);
    const chunks = []; let mr = null;
    try { mr = new MediaRecorder(stream); mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; mr.start(); } catch (e) { mr = null; }
    const finals = []; let interim = '', active = true, endRes = null;
    const rec = new SR(); rec.lang = 'en-GB'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = e => { interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finals.push({ t: r[0].transcript, c: r[0].confidence }); else interim += r[0].transcript; } };
    rec.onend = () => { if (active) { try { rec.start(); } catch (e) { } } else if (endRes) endRes(); };
    rec.onerror = () => { };
    try { rec.start(); } catch (e) { }
    const t0 = performance.now(); let lastT = t0, firstV = null, lastV = null, pauses = 0, inSil = false, silStart = 0, floor = [], thr = 0.012, stopped = false;
    const iv = setInterval(() => {
      const now = performance.now(); an.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length); lastT = now;
      if (floor.length < 5) { floor.push(rms); if (floor.length === 5) thr = Math.max(0.012, Math.min(0.06, (floor.reduce((a, b) => a + b) / 5) * 2.5)); }
      ui.level(Math.min(1, rms * 10));
      const el = (now - t0) / 1000; ui.time(maxSec - el, maxSec);
      if (rms > thr) { if (firstV === null) firstV = now; if (inSil && lastV !== null && now - silStart > 600) pauses++; inSil = false; lastV = now; }
      else if (!inSil) { inSil = true; silStart = now; }
      const silentFor = lastV === null ? now - t0 : now - lastV;
      if (el >= maxSec) stop('time'); else if (silentFor > 3000) stop('silence');
    }, 50);
    function stop(reason) {
      if (stopped) return; stopped = true; clearInterval(iv); active = false; FLOW.skip = null;
      try { src.disconnect(); } catch (e) { }
      const fin = new Promise(r => { endRes = r; setTimeout(r, 1300); });
      try { rec.stop(); } catch (e) { endRes && endRes(); }
      const mrDone = new Promise(r => { if (mr && mr.state !== 'inactive') { mr.onstop = r; mr.stop(); } else r(); });
      Promise.all([fin, mrDone]).then(() => {
        let text = finals.map(f => f.t).join(' ').replace(/\s+/g, ' ').trim();
        if (interim.trim()) text = (text + ' ' + interim).trim();
        const confs = finals.map(f => f.c).filter(c => c > 0);
        const conf = confs.length ? confs.reduce((a, b) => a + b) / confs.length : 0;
        const url = chunks.length ? URL.createObjectURL(new Blob(chunks, { type: chunks[0].type || 'audio/webm' })) : null;
        resolve({ text, conf, pauses, spanMs: firstV !== null && lastV !== null ? lastV - firstV : 0, reason, url, dur: (performance.now() - t0) / 1000 });
      });
    }
    FLOW.skip = () => stop('manual');
    CLEAN.push(() => stop('abort'));
  });
}

/* ---------------- shared UI pieces ---------------- */
function audioPanel(host, src, mode) {
  const box = document.createElement('div'); box.className = 'aud';
  box.innerHTML = '<div class="aud-row"><span class="aud-ic" aria-hidden="true"></span><span class="lbl">Beginning in 3 seconds</span><button type="button" class="ghost sm replay" hidden>Play again</button></div><div class="prog"><i></i></div><p class="aud-fallback" hidden></p>';
  host.appendChild(box);
  const lbl = box.querySelector('.lbl'), bar = box.querySelector('.prog i'), rp = box.querySelector('.replay');
  const allText = src.turns ? src.turns.map(t => t.text).join(' ') : src.text;
  const est = Math.max(2, wc(allText) / 2.4);
  const run = async () => {
    if (!ENV.tts) { lbl.textContent = 'Audio is not available in this browser'; const fb = box.querySelector('.aud-fallback'); fb.hidden = false; fb.textContent = 'Transcript: ' + allText; bar.style.width = '100%'; return; }
    const t0 = performance.now(); let alive = true;
    const iv = setInterval(() => { if (!alive) return; bar.style.width = Math.min(98, (performance.now() - t0) / 10 / est) + '%'; }, 200);
    if (src.turns) {
      const spk = {}; let n = 0;
      for (const t of src.turns) { if (TTS.aborted && n) break; if (!(t.sp in spk)) spk[t.sp] = Object.keys(spk).length; lbl.textContent = 'Playing: Speaker ' + t.sp; await TTS.speak(t.text, spk[t.sp]); n++; if (TTS.aborted) break; }
    } else { lbl.textContent = 'Playing'; await TTS.speak(src.text, src.voice || 0); }
    if (src.beep) await beep(1000, 600);
    alive = false; clearInterval(iv); bar.style.width = '100%'; lbl.textContent = 'Completed';
  };
  const p = (async () => {
    const r = await waitClock(3, left => { lbl.textContent = 'Beginning in ' + Math.max(1, Math.ceil(left)) + ' seconds'; });
    if (r === 'abort') return;
    await run();
    if (mode === 'practice' && ST.settings.replay) { rp.hidden = false; rp.onclick = async () => { rp.disabled = true; await run(); rp.disabled = false; }; }
  })();
  return p;
}

function spkPanel(host) {
  const box = document.createElement('div'); box.className = 'spk';
  box.innerHTML = '<div class="spk-row"><span class="spk-dot"></span><span class="spk-lbl">Waiting</span><span class="mono spk-t"></span></div><div class="meter" aria-hidden="true"><i></i></div><div class="prog"><i></i></div>';
  host.appendChild(box);
  const lbl = box.querySelector('.spk-lbl'), t = box.querySelector('.spk-t'), bar = box.querySelector('.prog i'), lv = box.querySelector('.meter i');
  return {
    state(s, text) { box.dataset.state = s; lbl.textContent = text; },
    time(left, total) { t.textContent = fmt(left); bar.style.width = (100 - clamp(left / total, 0, 1) * 100) + '%'; },
    level(v) { lv.style.width = (v * 100) + '%'; }
  };
}

async function speakFlow(body, o, ctx) {
  const notesHost = o.notes ? notepad(body) : null;
  if (ENV.mic !== false) { try { await getMic(); } catch (e) { ENV.mic = false; renderEnv(); } }
  if (o.audio) { await audioPanel(body, o.audio, ctx.mode); if (ctx.dead()) return null; }
  const ui = spkPanel(body);
  if (o.prep) { ui.state('prep', 'Preparing'); ctx.setNext('Start speaking now'); const r = await waitClock(o.prep, (l, tot) => ui.time(l, tot)); if (r === 'abort') return null; }
  await beep(); if (ctx.dead()) return null;
  if (ENV.mic !== true) {
    ui.state('self', 'Speak now (no microphone here, rate yourself after)'); ctx.setNext('I finished speaking');
    const r = await waitClock(o.rec, (l, tot) => ui.time(l, tot)); if (r === 'abort') return null;
    ui.state('done', 'Completed'); return { self: true };
  }
  ui.state('rec', 'Recording'); ctx.setNext('Stop recording');
  const r = await record(o.rec, ui);
  ui.state('done', r.reason === 'silence' ? 'Recording stopped after 3 seconds of silence' : 'Completed');
  return r.reason === 'abort' ? null : r;
}

function notepad(host) {
  const d = document.createElement('details'); d.className = 'notes'; d.open = true;
  d.innerHTML = '<summary>Erasable noteboard</summary><textarea id="np-' + Date.now() + '" rows="3" spellcheck="false" placeholder="Key words, names, numbers…"></textarea>';
  host.appendChild(d); return d;
}

/* ---------------- speaking scoring ---------------- */
function spkMetrics(r, targetWps = 2.4) {
  const w = words(r.text), n = w.length, span = Math.max(r.spanMs, 500) / 1000, wps = n / span;
  let flu = 5 - Math.max(0, Math.abs(wps - targetWps) - 0.6) * 2.2 - r.pauses * 0.45;
  if (n < 4) flu = 0;
  flu = clamp(flu, 0, 5);
  const pron = r.conf ? clamp((r.conf - 0.55) / 0.4 * 5, 0, 5) : null;
  return { w, n, wps, flu, pron };
}
function selfRate(body, ctx, model) {
  return new Promise(res => {
    const box = document.createElement('div'); box.className = 'selfrate';
    box.innerHTML = (model ? '<div class="model"><h4>What a strong answer covers</h4>' + model + '</div>' : '') +
      '<p class="ar" dir="rtl">مفيش مايك في النسخة دي. قيّم نفسك بأمانة: اتكلمت من غير وقفات؟ غطيت النقط اللي فوق؟ نطقك واضح؟</p>' +
      '<div class="rate-row">' + [0, 1, 2, 3, 4, 5].map(v => '<button type="button" class="rate" data-v="' + v + '">' + v + '</button>').join('') + '</div><p class="muted sm">0 = سكت أو اتلخبطت · 3 = كويس بس فيه وقفات · 5 = طلاقة كاملة وغطيت كل النقط</p>';
    body.appendChild(box);
    ctx.setNext('Skip rating', true);
    $$('.rate', box).forEach(b => b.onclick = () => { const v = +b.dataset.v; res({ pct: v / 5, s: v, m: 5, self: true, traits: [{ n: 'Self-rating', v, max: 5 }], html: '' }); });
    FLOW.skip = () => res({ pct: 0, s: 0, m: 5, self: true, skipped: true, traits: [], html: '' });
  });
}
function diffHtml(refText, hypText) {
  const refTok = refText.split(/\s+/).filter(Boolean), ref = refTok.map(t => words(t).join(' ')), hyp = words(hypText);
  const { mask } = lcsMask(ref, hyp);
  return refTok.map((t, i) => '<span class="' + (mask[i] ? 'hit' : 'miss') + '">' + esc(t) + '</span>').join(' ');
}
function spkResultHtml(r, m, extra) {
  return (r.url ? '<audio controls src="' + r.url + '"></audio>' : '') +
    '<div class="stats mono"><span>' + m.n + ' words</span><span>' + r1(m.wps) + ' words/sec</span><span>' + r.pauses + ' long pauses</span><span>' + (r.reason === 'silence' ? 'stopped by 3s silence' : r1(r.dur) + 's recorded') + '</span></div>' +
    '<h4>What the recogniser heard</h4><p class="heard">' + (esc(r.text) || '<em>Nothing was recognised. Check your microphone and speak a little louder.</em>') + '</p>' + (extra || '');
}
function finishSpeaking(kind, item, r, ctx, opts) {
  const m = spkMetrics(r, opts.wps || 2.4);
  let content, cMax, html, pct;
  if (kind === 'match') {
    const ref = words(opts.ref), { matched } = lcsMask(ref, m.w), ratio = ref.length ? matched / ref.length : 0;
    if (opts.rs) { content = ratio >= 0.95 ? 3 : ratio >= 0.5 ? 2 : ratio > 0 ? 1 : 0; cMax = 3; }
    else { content = r1(ratio * 5); cMax = 5; }
    const pron = m.pron === null ? ratio * 5 : (m.pron * 0.5 + ratio * 2.5);
    pct = 0.4 * (content / cMax) + 0.3 * (pron / 5) + 0.3 * (m.flu / 5);
    html = spkResultHtml(r, m, '<h4>Words you matched (red = missed or changed)</h4><p class="diff">' + diffHtml(opts.ref, r.text) + '</p>');
    return { pct, s: r1(pct * 90), m: 90, traits: [{ n: 'Content', v: content, max: cMax }, { n: 'Pronunciation (est.)', v: r1(pron), max: 5 }, { n: 'Oral fluency (est.)', v: r1(m.flu), max: 5 }], html };
  }
  if (kind === 'asq') {
    const t = ' ' + words(r.text).join(' ') + ' ', ok = item.a.some(a => t.includes(' ' + words(a).join(' ') + ' '));
    return { pct: ok ? 1 : 0, s: ok ? 1 : 0, m: 1, traits: [{ n: 'Vocabulary', v: ok ? 1 : 0, max: 1 }], html: spkResultHtml(r, m, '<p>Accepted answers: <b>' + esc(item.a.join(', ')) + '</b></p>') };
  }
  const cv = coverage(r.text, item.keypoints);
  const len = clamp(m.n / (opts.target || 60), 0, 1);
  content = r1((cv.cov * 0.75 + len * 0.25) * 5); cMax = 5;
  if (kind === 'rts') { const polite = /(could you|would you|would it be possible|please|thank|sorry|appreciate|i was wondering)/i.test(r.text); content = r1(Math.min(5, content + (polite ? 0.5 : 0))); }
  const pron = m.pron === null ? clamp(m.n / 20, 0, 1) * 3.5 : m.pron;
  pct = 0.4 * (content / cMax) + 0.3 * (pron / 5) + 0.3 * (m.flu / 5);
  html = spkResultHtml(r, m, '<h4>Key points</h4><p class="kp">' + cv.hit.map(k => '<span class="hit">' + esc(k) + '</span>').join(' ') + ' ' + cv.miss.map(k => '<span class="miss">' + esc(k) + '</span>').join(' ') + '</p>' + (opts.model ? '<div class="model"><h4>Model answer</h4>' + opts.model + '</div>' : ''));
  return { pct, s: r1(pct * 90), m: 90, traits: [{ n: 'Content (est.)', v: content, max: cMax }, { n: 'Pronunciation (est.)', v: r1(pron), max: 5 }, { n: 'Oral fluency (est.)', v: r1(m.flu), max: 5 }], html };
}

/* ---------------- Describe Image chart ---------------- */
function chartSvg(c) {
  const W = 640, H = 360, P = { l: 56, r: 20, t: 46, b: 64 };
  const title = '<text x="' + W / 2 + '" y="26" text-anchor="middle" class="ct">' + esc(c.title) + '</text>';
  let g = '';
  if (c.type === 'bar' || c.type === 'line') {
    const max = Math.max(...c.values) * 1.12, iw = W - P.l - P.r, ih = H - P.t - P.b, n = c.values.length;
    const y = v => P.t + ih - v / max * ih, step = Math.pow(10, Math.floor(Math.log10(max))) / (max / Math.pow(10, Math.floor(Math.log10(max))) < 3 ? 2 : 1);
    for (let v = 0; v <= max; v += step) g += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/><text x="' + (P.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="ax">' + Math.round(v) + '</text>';
    const bw = iw / n;
    if (c.type === 'bar') c.values.forEach((v, i) => { const x = P.l + i * bw + bw * 0.18; g += '<rect x="' + x + '" y="' + y(v) + '" width="' + bw * 0.64 + '" height="' + (P.t + ih - y(v)) + '" rx="3" class="bar"/><text x="' + (x + bw * 0.32) + '" y="' + (y(v) - 6) + '" text-anchor="middle" class="val">' + v + '</text>'; });
    else { const pts = c.values.map((v, i) => [P.l + i * bw + bw / 2, y(v)]); g += '<polyline points="' + pts.map(p => p.join(',')).join(' ') + '" class="ln"/>' + pts.map((p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" class="pt"/><text x="' + p[0] + '" y="' + (p[1] - 9) + '" text-anchor="middle" class="val">' + c.values[i] + '</text>').join(''); }
    c.labels.forEach((l, i) => g += '<text x="' + (P.l + i * bw + bw / 2) + '" y="' + (H - P.b + 20) + '" text-anchor="middle" class="ax">' + esc(l) + '</text>');
    g += '<text x="14" y="' + (P.t + ih / 2) + '" transform="rotate(-90 14 ' + (P.t + ih / 2) + ')" text-anchor="middle" class="ax">' + esc(c.unit) + '</text>';
  } else if (c.type === 'pie') {
    const tot = c.values.reduce((a, b) => a + b, 0), cx = 210, cy = 200, R = 130; let a0 = -Math.PI / 2;
    c.values.forEach((v, i) => {
      const a1 = a0 + v / tot * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
      g += '<path d="M' + cx + ',' + cy + ' L' + (cx + R * Math.cos(a0)) + ',' + (cy + R * Math.sin(a0)) + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + (cx + R * Math.cos(a1)) + ',' + (cy + R * Math.sin(a1)) + ' Z" class="s' + (i % 6) + '"/>';
      g += '<rect x="390" y="' + (100 + i * 34) + '" width="16" height="16" rx="3" class="s' + (i % 6) + '"/><text x="414" y="' + (113 + i * 34) + '" class="ax lg">' + esc(c.labels[i]) + ': ' + v + (c.unit === '%' ? '%' : ' ' + esc(c.unit)) + '</text>';
      a0 = a1;
    });
  } else {
    const n = c.labels.length, cols = 3, bw = 176, bh = 64, gx = 28, gy = 56, x0 = (W - (cols * bw + (cols - 1) * gx)) / 2;
    c.labels.forEach((l, i) => {
      const row = Math.floor(i / cols), col = row % 2 ? cols - 1 - (i % cols) : i % cols, x = x0 + col * (bw + gx), yy = 64 + row * (bh + gy);
      g += '<rect x="' + x + '" y="' + yy + '" width="' + bw + '" height="' + bh + '" rx="8" class="box"/><text x="' + (x + 12) + '" y="' + (yy + 22) + '" class="ax step">STEP ' + (i + 1) + '</text><text x="' + (x + 12) + '" y="' + (yy + 46) + '" class="val">' + esc(l) + '</text>';
      if (i < n - 1) {
        const nr = Math.floor((i + 1) / cols), ncol = nr % 2 ? cols - 1 - ((i + 1) % cols) : (i + 1) % cols, nx = x0 + ncol * (bw + gx), ny = 64 + nr * (bh + gy);
        if (nr === row) { const fromX = ncol > col ? x + bw : x, toX = ncol > col ? nx : nx + bw; g += '<line x1="' + fromX + '" y1="' + (yy + bh / 2) + '" x2="' + toX + '" y2="' + (ny + bh / 2) + '" class="arr" marker-end="url(#ah)"/>'; }
        else g += '<line x1="' + (x + bw / 2) + '" y1="' + (yy + bh) + '" x2="' + (nx + bw / 2) + '" y2="' + ny + '" class="arr" marker-end="url(#ah)"/>';
      }
    });
  }
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(c.title) + '"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="ahd"/></marker></defs>' + title + g + '</svg>';
}
function unitTxt(v, u) { return u === '%' ? v + '%' : u === 'thousand' ? v + ' thousand' : u === 'mm' ? v + ' millimetres' : v + (u ? ' ' + u : ''); }
function diModel(c) {
  const t = c.title.charAt(0).toLowerCase() + c.title.slice(1);
  if (c.type === 'process') {
    const s = c.labels.map(x => x.toLowerCase());
    return '<p>The diagram illustrates ' + esc(t) + '. The process begins with ' + esc(s[0]) + ', after which ' + esc(s[1]) + ' takes place. Next comes ' + esc(s[2]) + ', followed by ' + esc(s.slice(3, -1).join(' and ')) + '. Finally, the process ends with ' + esc(s[s.length - 1]) + '. In conclusion, the process consists of ' + s.length + ' clear stages from start to finish.</p>';
  }
  const kind = c.type === 'bar' ? 'bar chart' : c.type === 'line' ? 'line graph' : 'pie chart';
  const pairs = c.labels.map((l, i) => [l, c.values[i]]).sort((a, b) => b[1] - a[1]), mx = pairs[0], sc = pairs[1], mn = pairs[pairs.length - 1];
  return '<p>The ' + kind + ' illustrates ' + esc(t) + '. According to the ' + kind + ', ' + esc(mx[0]) + ' has the highest figure, at ' + unitTxt(mx[1], c.unit) + ', followed by ' + esc(sc[0]) + ' at ' + unitTxt(sc[1], c.unit) + '. In contrast, ' + esc(mn[0]) + ' has the lowest figure, at only ' + unitTxt(mn[1], c.unit) + '. ' + (c.type === 'line' ? 'Overall, the figures fluctuate considerably over the period. ' : 'The remaining categories fall somewhere in between. ') + 'In conclusion, there is a significant gap between ' + esc(mx[0]) + ' and ' + esc(mn[0]) + '.</p>';
}
const kpModel = item => '<p class="muted">A strong answer mentions: ' + esc((item.keypoints || []).map(g => g[0]).join(', ')) + '.</p>';

/* ---------------- writing scoring ---------------- */
const WSPEC = {
  SWT: { max: { content: 4, form: 1, grammar: 2, vocabulary: 2 }, rules: 'Content 0-4: the summary captures the main idea and key points of the WHOLE passage. Form 0-1: exactly one complete sentence of 5-75 words (if form is 0, every trait is 0). Grammar 0-2: correct grammatical structure. Vocabulary 0-2: appropriate word choice.' },
  SST: { max: { content: 4, form: 2, grammar: 2, vocabulary: 2, spelling: 2 }, rules: 'Content 0-4: main points of the lecture. Form 0-2: 50-70 words = 2, 40-49 or 71-100 = 1, otherwise 0 (if form is 0, every trait is 0). Grammar 0-2. Vocabulary 0-2. Spelling 0-2: no errors = 2, one error = 1, more = 0.' },
  WE: { max: { content: 6, form: 2, development: 6, grammar: 2, linguistic_range: 6, vocabulary: 2, spelling: 2 }, rules: 'Content 0-6: fully addresses the prompt with relevant, convincing support. Form 0-2: 200-300 words = 2, 120-199 or 301-380 = 1, otherwise 0. Development, structure and coherence 0-6. Grammar 0-2. General linguistic range 0-6. Vocabulary range 0-2. Spelling 0-2: no errors = 2, one error = 1, more = 0. Off-topic or form 0 means every trait is 0.' }
};
function formOf(code, text) {
  const n = wc(text);
  if (code === 'SWT') { const sents = text.trim().split(/[.!?]+(?:\s+|$)/).filter(x => x.trim()).length; return n >= 5 && n <= 75 && sents === 1 && /[.!?]\s*$/.test(text.trim()) ? 1 : 0; }
  if (code === 'SST') return n >= 50 && n <= 70 ? 2 : (n >= 40 && n < 50) || (n > 70 && n <= 100) ? 1 : 0;
  return n >= 200 && n <= 300 ? 2 : (n >= 120 && n < 200) || (n > 300 && n <= 380) ? 1 : 0;
}
function heurWriting(code, item, text) {
  const spec = WSPEC[code], w = words(text), ttr = w.length ? new Set(w).size / w.length : 0;
  const conn = (text.match(/\b(however|therefore|moreover|furthermore|whereas|although|consequently|in addition|for example|for instance|in conclusion|while|which|because|as a result)\b/gi) || []).length;
  const tidy = /^[A-Z]/.test(text.trim()) && /[.!?]$/.test(text.trim()) && !/\bi\b/.test(text);
  const form = formOf(code, text), tr = {};
  let cov;
  if (code === 'WE') { const kw = [...new Set(words(item.prompt).filter(x => x.length > 5))]; cov = kw.length ? kw.filter(k => w.includes(k)).length / kw.length : 0; }
  else cov = coverage(text, item.keypoints).cov;
  Object.keys(spec.max).forEach(k => tr[k] = 0);
  tr.form = form;
  if (form > 0) {
    if (code === 'WE') {
      const paras = text.split(/\n\s*\n/).filter(p => p.trim()).length;
      tr.content = Math.round(clamp(cov * 1.6, 0, 1) * 6);
      tr.development = clamp((paras >= 4 ? 4 : paras >= 3 ? 3 : 1) + (conn >= 5 ? 2 : conn >= 3 ? 1 : 0), 0, 6);
      tr.grammar = tidy ? 2 : 1; tr.linguistic_range = clamp(Math.round(ttr * 8), 1, 6); tr.vocabulary = ttr > 0.5 ? 2 : 1; tr.spelling = 1;
    } else {
      tr.content = Math.round(cov * 4); tr.grammar = (tidy ? 1 : 0) + (conn ? 1 : 0); tr.vocabulary = ttr > 0.55 ? 2 : 1; if ('spelling' in tr) tr.spelling = 1;
    }
  }
  return pack(code, tr, false);
}
function pack(code, tr, ai, extra) {
  const spec = WSPEC[code]; let s = 0, m = 0; const traits = [];
  Object.keys(spec.max).forEach(k => { const v = clamp(Math.round(Number(tr[k]) || 0), 0, spec.max[k]); s += v; m += spec.max[k]; traits.push({ n: k.replace('_', ' '), v, max: spec.max[k] }); });
  return Object.assign({ pct: m ? s / m : 0, s, m, traits, ai }, extra || {});
}
async function aiWriting(code, item, text) {
  const spec = WSPEC[code], name = TASKS[code].name;
  const src = code === 'WE' ? 'ESSAY PROMPT:\n' + item.prompt : code === 'SWT' ? 'PASSAGE:\n' + item.passage : 'LECTURE TRANSCRIPT:\n' + item.script;
  const keys = Object.keys(spec.max).map(k => '"' + k + '": 0').join(', ');
  const prompt = 'You are a strict, experienced PTE Academic examiner. Score the candidate response for the task "' + name + '" using the official PTE Academic trait scales.\n' + spec.rules + '\nBe as strict as the real automated scorer. Count spelling and grammar errors precisely.\n\n' + src + '\n\nCANDIDATE RESPONSE (' + wc(text) + ' words):\n"""' + text + '"""\n\nReply with ONLY one JSON object of this shape: {"traits": {' + keys + '}, "feedback_ar": "4-6 short lines in Egyptian Arabic, each starting with • , saying exactly what cost marks and what to change to reach 79+", "corrections": [{"wrong": "exact text", "right": "fix", "why": "short English reason"}], "model": "a band-90 model response in English that follows every task rule"}';
  const r = await SAMPLE.json(prompt, { modelTier: 'default' });
  if (!r || typeof r !== 'object' || !r.traits) throw { code: 'invalid_json' };
  const tr = Object.assign({}, r.traits); tr.form = formOf(code, text);
  if (tr.form === 0) Object.keys(tr).forEach(k => { if (k !== 'form') tr[k] = 0; });
  return pack(code, tr, true, { fb: r.feedback_ar || '', corr: Array.isArray(r.corrections) ? r.corrections.slice(0, 12) : [], model: r.model || '' });
}
function writingHtml(code, item, text, res) {
  const n = wc(text);
  let h = '<div class="stats mono"><span>' + n + ' words</span><span>' + (res.ai ? 'Scored by AI examiner' : 'Quick estimate (no AI here)') + '</span></div>';
  if (res.fb) h += '<div class="ar fb" dir="rtl">' + esc(res.fb).replace(/\n/g, '<br>') + '</div>';
  if (res.corr && res.corr.length) h += '<h4>Corrections</h4><ul class="corr">' + res.corr.map(c => '<li><s>' + esc(c.wrong) + '</s> → <b>' + esc(c.right) + '</b> <span class="muted">' + esc(c.why) + '</span></li>').join('') + '</ul>';
  if (res.model) h += '<div class="model"><h4>Band-90 model</h4><p>' + esc(res.model).replace(/\n/g, '<br>') + '</p></div>';
  else if (item.keypoints) h += kpModel(item);
  if (!res.ai) h += '<p class="muted sm">The quick estimate checks length, form, key points and variety only. Open this page on claude.ai to get full grammar, spelling and content marking.</p>';
  return h;
}

/* ---------------- task renderers ---------------- */
// each renderer: (body, item, ctx) ; ctx = {mode, done(result), setNext(label, keep), dead()}
const R = {};
function passage(text) { const p = document.createElement('div'); p.className = 'passage'; p.textContent = text; return p; }

R.RA = async (b, it, ctx) => { b.appendChild(passage(it.text)); const r = await speakFlow(b, { prep: 35, rec: 40 }, ctx); if (!r) return; ctx.done(r.self ? await selfRate(b, ctx) : finishSpeaking('match', it, r, ctx, { ref: it.text, wps: 2.5 })); };
R.RS = async (b, it, ctx) => { const r = await speakFlow(b, { audio: { text: it.text }, prep: 0, rec: 15 }, ctx); if (!r) return; ctx.done(r.self ? await selfRate(b, ctx, '<p>' + esc(it.text) + '</p>') : finishSpeaking('match', it, r, ctx, { ref: it.text, rs: true, wps: 2.6 })); };
R.DI = async (b, it, ctx) => { const d = document.createElement('div'); d.className = 'chart-wrap'; d.innerHTML = chartSvg(it.chart); b.appendChild(d); const r = await speakFlow(b, { prep: 25, rec: 40 }, ctx); if (!r) return; ctx.done(r.self ? await selfRate(b, ctx, diModel(it.chart)) : finishSpeaking('open', it, r, ctx, { target: 65, model: diModel(it.chart) })); };
R.RL = async (b, it, ctx) => { const h = document.createElement('div'); h.className = 'lecture'; h.innerHTML = '<span class="muted sm">Lecture</span><b>' + esc(it.title) + '</b>'; b.appendChild(h); const r = await speakFlow(b, { audio: { text: it.script }, prep: 10, rec: 40, notes: true }, ctx); if (!r) return; ctx.done(r.self ? await selfRate(b, ctx, kpModel(it)) : finishSpeaking('open', it, r, ctx, { target: 75, model: kpModel(it) + '<details><summary>Lecture transcript</summary><p>' + esc(it.script) + '</p></details>' })); };
R.ASQ = async (b, it, ctx) => { const r = await speakFlow(b, { audio: { text: it.q }, prep: 0, rec: 10 }, ctx); if (!r) return; ctx.done(r.self ? await selfRate(b, ctx, '<p>' + esc(it.q) + '<br><b>' + esc(it.a.join(' / ')) + '</b></p>') : finishSpeaking('asq', it, r, ctx, {})); };
R.SGD = async (b, it, ctx) => { const h = document.createElement('div'); h.className = 'lecture'; h.innerHTML = '<span class="muted sm">Group discussion</span><b>' + esc(it.topic) + '</b>'; b.appendChild(h); const r = await speakFlow(b, { audio: { turns: it.turns }, prep: 10, rec: 120, notes: true }, ctx); if (!r) return; const tr = '<details><summary>Discussion transcript</summary>' + it.turns.map(t => '<p><b>' + t.sp + ':</b> ' + esc(t.text) + '</p>').join('') + '</details>'; ctx.done(r.self ? await selfRate(b, ctx, kpModel(it) + tr) : finishSpeaking('open', it, r, ctx, { target: 150, model: kpModel(it) + tr })); };
R.RTS = async (b, it, ctx) => { b.appendChild(passage(it.situation)); const r = await speakFlow(b, { audio: { text: it.situation, voice: 1 }, prep: 20, rec: 40 }, ctx); if (!r) return; ctx.done(r.self ? await selfRate(b, ctx, kpModel(it)) : finishSpeaking('rts', it, r, ctx, { target: 70, model: kpModel(it) })); };

function writingBox(b, ctx, code, minW, maxW) {
  const w = document.createElement('div'); w.className = 'wbox';
  const id = 'w-' + code + '-' + Date.now();
  w.innerHTML = '<label for="' + id + '" class="sr">Your response</label><textarea id="' + id + '" rows="' + (code === 'WE' ? 14 : 6) + '" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea><div class="wfoot mono"><span class="wc">Word count: 0</span><span class="wt"></span></div>';
  b.appendChild(w);
  const ta = w.querySelector('textarea'), wcEl = w.querySelector('.wc'), wt = w.querySelector('.wt');
  ta.addEventListener('input', () => { const n = wc(ta.value); wcEl.textContent = 'Word count: ' + n; wcEl.classList.toggle('warn', n > 0 && (n < minW || n > maxW)); });
  const p = waitClock(TASKS[code].time, l => { wt.textContent = 'Time left ' + fmt(l); }, false);
  p.then(r => { if (r === 'time') ctx.forceSubmit && ctx.forceSubmit(); });
  return ta;
}
async function scoreWriting(code, it, text, ctx, b) {
  let res = heurWriting(code, it, text);
  if (ctx.mode === 'practice' && SAMPLE && wc(text) > 0) {
    const wait = document.createElement('p'); wait.className = 'thinking'; wait.textContent = 'The AI examiner is marking your response. This usually takes 20 to 60 seconds.'; b.appendChild(wait);
    try { res = await aiWriting(code, it, text); } catch (e) { wait.textContent = e && e.code === 'not_granted' ? 'AI marking was not allowed, so this is the quick estimate.' : 'AI marking failed this time, so this is the quick estimate.'; if (e && e.code === 'not_granted') { SAMPLE = null; ENV.ai = false; renderEnv(); } await new Promise(r => setTimeout(r, 900)); }
    wait.remove();
  } else if (ctx.mode === 'mock') res.pending = { code, it, text };
  res.html = writingHtml(code, it, text, res);
  return res;
}
R.SWT = (b, it, ctx) => { b.appendChild(passage(it.passage)); const ta = writingBox(b, ctx, 'SWT', 5, 75); ctx.onSubmit(async () => scoreWriting('SWT', it, ta.value.trim(), ctx, b)); };
R.WE = (b, it, ctx) => { const p = passage(it.prompt); p.classList.add('prompt'); b.appendChild(p); const ta = writingBox(b, ctx, 'WE', 200, 300); ctx.onSubmit(async () => scoreWriting('WE', it, ta.value.trim(), ctx, b)); };
R.SST = async (b, it, ctx) => { notepad(b); const ta = writingBox(b, ctx, 'SST', 50, 70); ctx.onSubmit(async () => scoreWriting('SST', it, ta.value.trim(), ctx, b)); b.insertBefore(document.createElement('div'), b.firstChild).className = 'aud-slot'; await audioPanel(b.querySelector('.aud-slot'), { text: it.script }, ctx.mode); };

function objResult(s, m, html) { return { pct: m ? clamp(s, 0, m) / m : 0, s: clamp(s, 0, m), m, traits: [{ n: 'Points', v: clamp(s, 0, m), max: m }], html }; }

R.RWFIB = (b, it, ctx) => {
  const blanks = []; let html = '';
  String(it.text).replace(/\[([^\]]+)\]|([^\[]+)/g, (all, br, txt) => {
    if (txt) { html += esc(txt); return ''; }
    const opts = br.split('|').map(o => o.trim()), i = blanks.length; blanks.push(opts[0]);
    html += '<select class="blank" data-i="' + i + '" id="rw-' + i + '" aria-label="Blank ' + (i + 1) + '"><option value=""></option>' + shuffle(opts).map(o => '<option>' + esc(o) + '</option>').join('') + '</select>';
    return '';
  });
  const p = document.createElement('div'); p.className = 'passage'; p.innerHTML = html; b.appendChild(p);
  ctx.onSubmit(() => {
    let s = 0; const fb = [];
    $$('select.blank', p).forEach(sel => { const i = +sel.dataset.i, ok = sel.value === blanks[i]; if (ok) s++; sel.classList.add(ok ? 'ok' : 'bad'); sel.disabled = true; fb.push((i + 1) + '. ' + (ok ? '✓ ' : '✗ ') + blanks[i]); });
    return objResult(s, blanks.length, '<p class="mono sm">' + esc(fb.join('   ')) + '</p>');
  });
};
function choiceBlock(b, opts, multi, name) {
  const f = document.createElement('fieldset'); f.className = 'choices';
  f.innerHTML = opts.map((o, i) => '<label class="choice"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="' + name + '" id="' + name + '-' + i + '" value="' + i + '"><span>' + esc(o) + '</span></label>').join('');
  b.appendChild(f); return f;
}
function scoreChoices(f, correct, multi) {
  const sel = $$('input', f).filter(x => x.checked).map(x => +x.value);
  $$('label.choice', f).forEach((l, i) => { if (correct.includes(i)) l.classList.add('ok'); else if (sel.includes(i)) l.classList.add('bad'); $('input', l).disabled = true; });
  if (!multi) return objResult(sel[0] === correct[0] ? 1 : 0, 1, '');
  const good = sel.filter(i => correct.includes(i)).length, bad = sel.length - good;
  return objResult(Math.max(0, good - bad), correct.length, '<p class="muted sm">+1 for each correct option, −1 for each wrong one.</p>');
}
R.RMCM = (b, it, ctx) => { b.appendChild(passage(it.passage)); const q = document.createElement('p'); q.className = 'q'; q.textContent = it.q; b.appendChild(q); const f = choiceBlock(b, it.options, true, 'rmcm' + Date.now()); ctx.onSubmit(() => scoreChoices(f, it.answers, true)); };
R.RMCS = (b, it, ctx) => { b.appendChild(passage(it.passage)); const q = document.createElement('p'); q.className = 'q'; q.textContent = it.q; b.appendChild(q); const f = choiceBlock(b, it.options, false, 'rmcs' + Date.now()); ctx.onSubmit(() => scoreChoices(f, [it.answer], false)); };
R.RO = (b, it, ctx) => {
  let order = it.paras.map((_, i) => i); let tries = 0; do { order = shuffle(order); tries++; } while (order.every((v, i) => v === i) && tries < 10);
  const list = document.createElement('ol'); list.className = 'ro';
  const draw = () => {
    list.innerHTML = order.map((pi, k) => '<li draggable="true" data-k="' + k + '"><span class="ro-tag mono">' + String.fromCharCode(65 + pi) + '</span><span class="ro-txt">' + esc(it.paras[pi]) + '</span><span class="ro-btns"><button type="button" class="ghost sm" data-up="' + k + '" aria-label="Move up">↑</button><button type="button" class="ghost sm" data-dn="' + k + '" aria-label="Move down">↓</button></span></li>').join('');
  };
  list.addEventListener('click', e => { const u = e.target.dataset.up, d = e.target.dataset.dn; if (u !== undefined && +u > 0) { [order[+u - 1], order[+u]] = [order[+u], order[+u - 1]]; draw(); } if (d !== undefined && +d < order.length - 1) { [order[+d + 1], order[+d]] = [order[+d], order[+d + 1]]; draw(); } });
  let drag = null;
  list.addEventListener('dragstart', e => { drag = +e.target.closest('li').dataset.k; });
  list.addEventListener('dragover', e => e.preventDefault());
  list.addEventListener('drop', e => { e.preventDefault(); const li = e.target.closest('li'); if (!li || drag === null) return; const to = +li.dataset.k; const [m] = order.splice(drag, 1); order.splice(to, 0, m); drag = null; draw(); });
  draw(); b.appendChild(list);
  ctx.onSubmit(() => {
    let s = 0; for (let k = 0; k < order.length - 1; k++) if (order[k + 1] === order[k] + 1) s++;
    list.classList.add('locked');
    return objResult(s, it.paras.length - 1, '<p>Correct order:</p><ol class="ro-key">' + it.paras.map(p => '<li>' + esc(p) + '</li>').join('') + '</ol><p class="muted sm">One point for each correct adjacent pair.</p>');
  });
};
R.RFIB = (b, it, ctx) => {
  const ans = []; let html = '';
  String(it.text).replace(/\[([^\]]+)\]|([^\[]+)/g, (all, br, txt) => { if (txt) { html += esc(txt); return ''; } const i = ans.length; ans.push(br.trim()); html += '<button type="button" class="drop" data-i="' + i + '" aria-label="Blank ' + (i + 1) + '"></button>'; return ''; });
  const p = document.createElement('div'); p.className = 'passage'; p.innerHTML = html; b.appendChild(p);
  const pool = document.createElement('div'); pool.className = 'pool';
  pool.innerHTML = shuffle(ans.concat(it.extra || [])).map(w => '<button type="button" class="chip-w">' + esc(w) + '</button>').join('');
  b.appendChild(pool);
  let active = null;
  const setActive = d => { $$('.drop', p).forEach(x => x.classList.remove('active')); active = d; if (d) d.classList.add('active'); };
  const firstEmpty = () => $$('.drop', p).find(d => !d.textContent);
  setActive(firstEmpty());
  pool.addEventListener('click', e => { const c = e.target.closest('.chip-w'); if (!c || c.disabled) return; const d = active && !active.textContent ? active : firstEmpty(); if (!d) return; d.textContent = c.textContent; c.disabled = true; c.hidden = true; setActive(firstEmpty()); });
  p.addEventListener('click', e => { const d = e.target.closest('.drop'); if (!d || d.disabled) return; if (d.textContent) { const w = d.textContent; d.textContent = ''; const c = $$('.chip-w', pool).find(x => x.hidden && x.textContent === w); if (c) { c.hidden = false; c.disabled = false; } } setActive(d); });
  ctx.onSubmit(() => {
    let s = 0; $$('.drop', p).forEach(d => { const i = +d.dataset.i, ok = d.textContent === ans[i]; if (ok) s++; d.classList.add(ok ? 'ok' : 'bad'); d.disabled = true; if (!ok) d.title = 'Answer: ' + ans[i]; });
    return objResult(s, ans.length, '<p class="mono sm">Answers: ' + esc(ans.join(' · ')) + '</p>');
  });
};

// listening
R.LMCM = (b, it, ctx) => { const a = document.createElement('div'); b.appendChild(a); const q = document.createElement('p'); q.className = 'q'; q.textContent = it.q; b.appendChild(q); const f = choiceBlock(b, it.options, true, 'lmcm' + Date.now()); ctx.onSubmit(() => { const r = scoreChoices(f, it.answers, true); r.html += '<details><summary>Transcript</summary><p>' + esc(it.script) + '</p></details>'; return r; }); audioPanel(a, { text: it.script }, ctx.mode); };
R.LMCS = (b, it, ctx) => { const a = document.createElement('div'); b.appendChild(a); const q = document.createElement('p'); q.className = 'q'; q.textContent = it.q; b.appendChild(q); const f = choiceBlock(b, it.options, false, 'lmcs' + Date.now()); ctx.onSubmit(() => { const r = scoreChoices(f, [it.answer], false); r.html += '<details><summary>Transcript</summary><p>' + esc(it.script) + '</p></details>'; return r; }); audioPanel(a, { text: it.script }, ctx.mode); };
R.HCS = (b, it, ctx) => { const a = document.createElement('div'); b.appendChild(a); const f = choiceBlock(b, it.options, false, 'hcs' + Date.now()); ctx.onSubmit(() => { const r = scoreChoices(f, [it.answer], false); r.html += '<details><summary>Transcript</summary><p>' + esc(it.script) + '</p></details>'; return r; }); audioPanel(a, { text: it.script }, ctx.mode); };
R.SMW = (b, it, ctx) => { const a = document.createElement('div'); b.appendChild(a); const f = choiceBlock(b, it.options, false, 'smw' + Date.now()); ctx.onSubmit(() => { const r = scoreChoices(f, [it.answer], false); r.html += '<details><summary>Transcript</summary><p>' + esc(it.script) + ' <b>' + esc(it.missing) + '</b></p></details>'; return r; }); audioPanel(a, { text: it.script, beep: true }, ctx.mode); };
R.LFIB = (b, it, ctx) => {
  const a = document.createElement('div'); b.appendChild(a);
  const ans = []; let html = '';
  String(it.script).replace(/\[([^\]]+)\]|([^\[]+)/g, (all, br, txt) => { if (txt) { html += esc(txt); return ''; } const i = ans.length; ans.push(br.trim()); html += '<input class="gap" data-i="' + i + '" id="lf-' + i + '" aria-label="Blank ' + (i + 1) + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">'; return ''; });
  const p = document.createElement('div'); p.className = 'passage'; p.innerHTML = html; b.appendChild(p);
  ctx.onSubmit(() => { let s = 0; $$('input.gap', p).forEach(x => { const i = +x.dataset.i, ok = x.value.trim().toLowerCase() === ans[i].toLowerCase(); if (ok) s++; x.classList.add(ok ? 'ok' : 'bad'); x.disabled = true; if (!ok) x.value = x.value + ' → ' + ans[i]; }); return objResult(s, ans.length, '<p class="muted sm">Spelling must be exact to score.</p>'); });
  audioPanel(a, { text: it.script.replace(/[\[\]]/g, '') }, ctx.mode);
};
R.HIW = (b, it, ctx) => {
  const a = document.createElement('div'); b.appendChild(a);
  const shown = it.shown.split(/\s+/), spoken = it.spoken.split(/\s+/);
  const wrong = shown.map((w, i) => words(w).join('') !== words(spoken[i] || '').join(''));
  const p = document.createElement('div'); p.className = 'passage hiw';
  p.innerHTML = shown.map((w, i) => '<span class="hw" data-i="' + i + '" tabindex="0" role="button">' + esc(w) + '</span>').join(' ');
  b.appendChild(p);
  const tog = e => { const s = e.target.closest('.hw'); if (s && !p.classList.contains('locked')) s.classList.toggle('sel'); };
  p.addEventListener('click', tog); p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(e); } });
  ctx.onSubmit(() => {
    p.classList.add('locked'); let good = 0, bad = 0;
    $$('.hw', p).forEach(s => { const i = +s.dataset.i, sel = s.classList.contains('sel'); if (wrong[i]) { s.classList.add(sel ? 'ok' : 'missed'); if (sel) good++; s.title = 'Said: ' + spoken[i]; } else if (sel) { s.classList.add('bad'); bad++; } });
    return objResult(Math.max(0, good - bad), wrong.filter(Boolean).length, '<p class="muted sm">Green = found, orange = missed, red = wrong click (−1). Hover a word to see what was said.</p>');
  });
  audioPanel(a, { text: it.spoken }, ctx.mode);
};
R.WFD = (b, it, ctx) => {
  const a = document.createElement('div'); b.appendChild(a);
  const id = 'wfd-' + Date.now();
  const w = document.createElement('div'); w.className = 'wbox'; w.innerHTML = '<label for="' + id + '" class="sr">Type the sentence</label><input id="' + id + '" class="wfd" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">';
  b.appendChild(w);
  ctx.onSubmit(() => {
    const ref = words(it.text), hyp = words($('input', w).value), pool = hyp.slice(); let s = 0;
    const marks = ref.map(t => { const k = pool.indexOf(t); if (k >= 0) { pool.splice(k, 1); s++; return '<span class="hit">' + esc(t) + '</span>'; } return '<span class="miss">' + esc(t) + '</span>'; });
    return objResult(s, ref.length, '<p class="diff">' + marks.join(' ') + '</p><p class="muted sm">One point per correct word. Red words were missing or misspelled.</p>');
  });
  audioPanel(a, { text: it.text, voice: Math.random() * 3 | 0 }, ctx.mode);
};

/* ---------------- runner ---------------- */
let RUN = 0;
function runItem(host, code, item, opts) {
  cleanup(); const my = ++RUN;
  const T = TASKS[code];
  host.innerHTML = '<section class="runner" aria-label="' + esc(T.name) + '"><div class="rbar"><div class="rhead"><span class="code mono">' + code + '</span><b>' + esc(T.name) + '</b>' + (T.isNew ? '<span class="new">New 2025</span>' : '') + '<span class="muted sm">' + esc(opts.counter || '') + '</span></div><div class="rclock mono" id="rclock">' + esc(opts.clock || '') + '</div></div><p class="instr">' + esc(INSTR[code]) + '</p><div class="rbody"></div><div class="rfoot"><button type="button" class="ghost" id="rquit">' + (opts.mode === 'mock' ? 'End test' : 'Back to tasks') + '</button><button type="button" class="primary" id="rnext">Submit</button></div></section><div class="result-slot"></div>';
  const body = $('.rbody', host), nextBtn = $('#rnext', host), slot = $('.result-slot', host);
  let submitFn = null, finished = false;
  const ctx = {
    mode: opts.mode,
    dead: () => my !== RUN,
    setNext(label) { if (!finished) nextBtn.textContent = label; },
    onSubmit(fn) { submitFn = fn; nextBtn.textContent = opts.mode === 'mock' ? 'Next' : 'Submit'; },
    async done(res) {
      if (finished || my !== RUN) return; finished = true; FLOW.skip = null;
      res.mode = opts.mode;
      const att = addAttempt(code, item, res, opts.mode);
      opts.onDone && opts.onDone(res, att, slot);
    },
    forceSubmit: () => nextBtn.click()
  };
  nextBtn.onclick = async () => {
    if (finished) return;
    if (submitFn) { nextBtn.disabled = true; const res = await submitFn(); nextBtn.disabled = false; ctx.done(res); }
    else if (FLOW.skip) FLOW.skip();
  };
  $('#rquit', host).onclick = () => { cleanup(); RUN++; opts.onQuit && opts.onQuit(); };
  R[code](body, item, ctx);
  return { nextBtn, ctx };
}

function resultCard(res, code) {
  const sc = res.self ? null : res.m === 90 ? Math.round(10 + res.pct * 80) : null;
  const band = res.pct >= 0.875 ? ['ok', 'On track for 80+'] : res.pct >= 0.7 ? ['mid', 'Close to 80'] : ['low', 'Needs work'];
  return '<section class="result"><div class="res-head"><div><span class="eyebrow">Your result</span><div class="res-big mono">' + (res.self ? res.s + '/5' : r1(res.s) + ' / ' + res.m) + '</div>' + (sc ? '<span class="muted sm">≈ ' + sc + ' on the 10-90 scale for this item</span>' : '') + '</div><span class="pill ' + band[0] + '">' + band[1] + '</span></div>' +
    (res.traits && res.traits.length ? '<div class="traits">' + res.traits.map(t => '<div class="trait"><span>' + esc(t.n) + '</span><div class="tbar"><i style="width:' + (t.max ? t.v / t.max * 100 : 0) + '%"></i></div><b class="mono">' + t.v + '/' + t.max + '</b></div>').join('') + '</div>' : '') +
    '<div class="res-body">' + (res.html || '') + '</div><div class="tip ar" dir="rtl"><b>نصيحة:</b> ' + esc(TIPS[code]) + '</div></section>';
}

/* ---------------- views ---------------- */
let VIEW = 'home', PARAM = null;
const main = () => $('#view');
function go(v, p) { cleanup(); RUN++; VIEW = v; PARAM = p || null; $$('.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.go === v ? 'page' : 'false')); render(); window.scrollTo(0, 0); }
function refreshView() { if (VIEW === 'home' || VIEW === 'practice') render(); }
function render() {
  $('#plan').hidden = VIEW !== 'plan'; main().hidden = VIEW === 'plan';
  if (VIEW === 'home') viewHome(); else if (VIEW === 'practice') viewPractice(); else if (VIEW === 'task') viewTask(PARAM); else if (VIEW === 'mock') viewMockMenu();
}

function taskStats(code, list) {
  const a = (list || ST.attempts).filter(x => x.c === code).slice(-8);
  if (!a.length) return null;
  let sw = 0, sp = 0; a.forEach(x => { const w = x.self ? 0.5 : 1; sw += w; sp += x.p * w; });
  return { n: (list || ST.attempts).filter(x => x.c === code).length, avg: sp / sw, last: a[a.length - 1].p };
}
function skillEst(list) {
  const out = {};
  SKILLS.forEach(sk => {
    let w = 0, s = 0, covered = 0, total = 0;
    ORDER.forEach(c => { if (!TASKS[c].skills.includes(sk)) return; total += TASKS[c].w; const st = taskStats(c, list); if (!st) return; covered += TASKS[c].w; w += TASKS[c].w; s += st.avg * TASKS[c].w; });
    out[sk] = w ? { pct: s / w, score: pteScore(s / w), cover: covered / total } : null;
  });
  return out;
}
function statusPill(st) { if (!st) return '<span class="pill none">Not tried</span>'; return st.avg >= 0.875 ? '<span class="pill ok">80+ ready</span>' : st.avg >= 0.7 ? '<span class="pill mid">Close</span>' : '<span class="pill low">Work on it</span>'; }
function skillBars(est) {
  return '<div class="skills">' + SKILLS.map(sk => { const e = est[sk]; const pos = e ? (e.score - 10) / 80 * 100 : 0; return '<div class="skill"><div class="sk-top"><span>' + sk + '</span><b class="mono">' + (e ? e.score : '—') + '</b></div><div class="scale" aria-hidden="true"><i style="width:' + pos + '%"></i><span class="target" style="left:' + (70 / 80 * 100) + '%"></span></div><div class="sk-sub muted sm">' + (e ? Math.round(e.cover * 100) + '% of task types tried' : 'No attempts yet') + '</div></div>'; }).join('') + '</div>';
}

function viewHome() {
  const est = skillEst(), have = SKILLS.filter(s => est[s]);
  const overall = have.length === 4 ? Math.round(have.reduce((a, s) => a + est[s].score, 0) / 4) : null;
  const weak = ORDER.map(c => ({ c, st: taskStats(c) })).map(x => ({ ...x, gap: (x.st ? 0.875 - x.st.avg : 0.6) * TASKS[x.c].w })).filter(x => x.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 3);
  const recent = ST.attempts.slice(-8).reverse();
  main().innerHTML =
    '<section class="hero"><div class="hero-l"><span class="eyebrow">Estimated PTE score</span><div class="overall mono">' + (overall ?? '—') + '<span>/90</span></div><p class="muted">' + (overall ? 'Average of your four skill estimates. Target: 79+ in every skill.' : ST.attempts.length ? 'Try every skill at least once to see an overall estimate.' : 'Start with the diagnostic: one item of every task type, about 45 minutes. It sets your starting point.') + '</p>' +
    '<div class="hero-cta">' + (ST.attempts.length ? '<button type="button" class="primary" data-act="mock">Take a mock test</button><button type="button" class="ghost" data-act="practice">Practise a task</button>' : '<button type="button" class="primary" data-act="diag">Start the diagnostic</button><button type="button" class="ghost" data-act="practice">Browse the 22 task types</button>') + '</div></div>' +
    '<div class="hero-r">' + skillBars(est) + '<p class="muted sm legend"><span class="tgt"></span> line = 80. Estimates use your last 8 attempts per task, weighted by how much each task feeds the skill.</p></div></section>' +
    '<section class="grid2"><div class="card"><h3>Train next</h3><p class="muted sm">Highest-impact gaps first: task weight × distance from 80.</p><ul class="next">' + weak.map(x => '<li><span class="code mono">' + x.c + '</span><span class="nx-name">' + esc(TASKS[x.c].name) + '<span class="muted sm">' + TASKS[x.c].part + ' · ' + (x.st ? Math.round(x.st.avg * 100) + '% avg' : 'not tried') + '</span></span><button type="button" class="ghost sm" data-task="' + x.c + '">Train</button></li>').join('') + '</ul></div>' +
    '<div class="card"><h3>Recent attempts</h3>' + (recent.length ? '<ul class="recent">' + recent.map(a => '<li><span class="code mono">' + a.c + '</span><span>' + esc(TASKS[a.c].name) + '</span><b class="mono">' + Math.round(a.p * 100) + '%</b><span class="muted sm">' + new Date(a.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + (a.mode === 'mock' ? ' · mock' : '') + (a.self ? ' · self' : '') + '</span></li>').join('') + '</ul>' : '<p class="muted">Your attempts will appear here.</p>') + '</div></section>' +
    '<section class="card"><h3>All 22 task types</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Task</th><th>Part</th><th>Feeds</th><th class="num">Tries</th><th class="num">Avg</th><th>Status</th></tr></thead><tbody>' +
    ORDER.map(c => { const st = taskStats(c); return '<tr data-task="' + c + '" tabindex="0"><td><span class="code mono">' + c + '</span> ' + esc(TASKS[c].name) + (TASKS[c].isNew ? ' <span class="new">New</span>' : '') + '</td><td>' + TASKS[c].part + '</td><td class="muted sm">' + TASKS[c].skills.join(', ') + '</td><td class="num mono">' + (st ? st.n : 0) + '</td><td class="num mono">' + (st ? Math.round(st.avg * 100) + '%' : '—') + '</td><td>' + statusPill(st) + '</td></tr>'; }).join('') + '</tbody></table></div></section>' +
    '<section class="grid2"><div class="card"><h3>Microphone check</h3><p class="muted sm">Say one sentence after the beep. You should see the level bar move and your words appear. Works in Chrome or Edge on the local version.</p><button type="button" class="ghost" id="micTest">Test my microphone</button><div id="micOut"></div></div>' +
    '<div class="card"><h3>Move progress between versions</h3><p class="muted sm">The claude.ai page and the local version keep separate records. Copy the code from one and paste it into the other to merge them.</p><div class="task-actions"><button type="button" class="ghost sm" id="expBtn">Copy my progress code</button><button type="button" class="ghost sm" id="impBtn">Paste a code to merge</button></div><label for="xfer" class="sr">Progress code</label><textarea id="xfer" rows="3" spellcheck="false" hidden></textarea><p class="muted sm" id="xferMsg"></p></div></section>';
  bindCommon();
  bindTools();
}
function bindTools() {
  const mt = $('#micTest');
  if (mt) mt.onclick = async () => {
    const out = $('#micOut'); out.innerHTML = ''; mt.disabled = true; cleanup();
    if (!SR) { out.innerHTML = '<p class="muted">This browser has no speech recognition. Open the local version in Chrome or Edge.</p>'; mt.disabled = false; return; }
    try { await getMic(); } catch (e) { ENV.mic = false; renderEnv(); out.innerHTML = '<p class="muted">The microphone is blocked here. On claude.ai this is expected. In the local version, allow the microphone in the address bar and try again.</p>'; mt.disabled = false; return; }
    const ui = spkPanel(out); ui.state('rec', 'Recording, speak now'); await beep();
    const r = await record(8, ui);
    ui.state('done', 'Done');
    out.insertAdjacentHTML('beforeend', '<p class="heard">' + (esc(r.text) || '<em>No words recognised. Speak louder or check the input device in Windows sound settings.</em>') + '</p>' + (r.url ? '<audio controls src="' + r.url + '"></audio>' : ''));
    mt.disabled = false;
  };
  const ta = $('#xfer'), msg = $('#xferMsg');
  const eb = $('#expBtn'), ib = $('#impBtn');
  if (eb) eb.onclick = async () => {
    const code = JSON.stringify({ v: 1, attempts: ST.attempts, gen: ST.gen });
    ta.hidden = false; ta.value = code; ta.select();
    try { await navigator.clipboard.writeText(code); msg.textContent = 'Copied ' + ST.attempts.length + ' attempts. Paste it in the other version.'; }
    catch (e) { msg.textContent = 'Copy the selected text with Ctrl+C.'; }
  };
  if (ib) ib.onclick = () => {
    if (ib.dataset.ready !== '1') { ta.hidden = false; ta.value = ''; ta.focus(); ib.textContent = 'Merge pasted code'; ib.dataset.ready = '1'; msg.textContent = 'Paste the code into the box, then press Merge.'; return; }
    try {
      const o = JSON.parse(ta.value.trim()); if (!o || !Array.isArray(o.attempts)) throw 0;
      const before = ST.attempts.length; ST.attempts = mergeAttempts(ST.attempts, o.attempts);
      Object.keys(o.gen || {}).forEach(k => { const have = new Set((ST.gen[k] || []).map(x => x.id)); const add = (o.gen[k] || []).filter(x => !have.has(x.id)); if (add.length) { ST.gen[k] = (ST.gen[k] || []).concat(add); genDirty = true; } });
      save(); msg.textContent = 'Merged. Added ' + (ST.attempts.length - before) + ' attempts.'; ib.dataset.ready = ''; setTimeout(() => go('home'), 900);
    } catch (e) { msg.textContent = 'That code could not be read. Copy it again from the other version.'; }
  };
}
function bindCommon() {
  $$('[data-task]', main()).forEach(el => { el.onclick = () => go('task', el.dataset.task); el.onkeydown = e => { if (e.key === 'Enter') go('task', el.dataset.task); }; });
  $$('[data-act]', main()).forEach(el => el.onclick = () => { const a = el.dataset.act; if (a === 'mock') go('mock'); if (a === 'practice') go('practice'); if (a === 'diag') startMock('diag'); });
}

function viewPractice() {
  main().innerHTML = '<section class="head"><h2>Practice by task</h2><p class="muted">The test runs in this order: Part 1 speaking and writing, Part 2 reading, Part 3 listening. Cards with a blue edge carry the most marks.</p></section>' +
    PARTS.map(part => '<section class="part"><h3>' + part + '</h3><div class="cards">' + ORDER.filter(c => TASKS[c].part === part).map(c => { const st = taskStats(c), T = TASKS[c]; return '<button type="button" class="tcard' + (T.w >= 4 ? ' heavy' : '') + '" data-task="' + c + '"><span class="tc-top"><span class="code mono">' + c + '</span>' + (T.isNew ? '<span class="new">New</span>' : '') + statusPill(st) + '</span><b>' + esc(T.name) + '</b><span class="muted sm">' + (T.rec ? (T.prep ? T.prep + 's prep · ' : '') + T.rec + 's speaking' : T.time ? T.time / 60 + ' min' : 'Untimed in practice') + ' · feeds ' + T.skills.join(', ') + '</span><span class="tc-meta mono sm">' + items(c).length + ' items · ' + (st ? Math.round(st.avg * 100) + '% avg' : 'no tries') + '</span></button>'; }).join('') + '</div></section>').join('');
  bindCommon();
}

function nextItem(code) {
  const list = items(code), cnt = {};
  ST.attempts.forEach(a => { if (a.c === code) cnt[a.id] = (cnt[a.id] || 0) + 1; });
  const min = Math.min(...list.map(i => cnt[i.id] || 0));
  const pool = list.filter(i => (cnt[i.id] || 0) === min);
  return pool[Math.random() * pool.length | 0];
}
function viewTask(code, item) {
  const T = TASKS[code], st = taskStats(code), list = items(code);
  main().innerHTML = '<section class="head"><button type="button" class="ghost sm back">← All tasks</button><h2><span class="code mono">' + code + '</span> ' + esc(T.name) + (T.isNew ? ' <span class="new">New 2025</span>' : '') + '</h2><p class="muted">' + T.part + ' · feeds ' + T.skills.join(' and ') + ' · ' + (st ? st.n + ' tries, ' + Math.round(st.avg * 100) + '% average' : 'not tried yet') + '</p><div class="tip ar" dir="rtl"><b>إزاي تجيب الدرجة:</b> ' + esc(TIPS[code]) + '</div>' +
    '<div class="task-actions"><button type="button" class="primary" id="start">' + (item ? 'Start this item' : 'Start next item') + '</button>' + (SAMPLE ? '<button type="button" class="ghost" id="gen">Write a new item with AI</button>' : '') + '<label class="toggle"><input type="checkbox" id="replay"' + (ST.settings.replay ? ' checked' : '') + '> Allow replaying audio in practice</label></div><p class="gen-msg muted sm" hidden></p></section>' +
    '<div id="stage"></div>' +
    '<details class="card items"><summary>Item bank (' + list.length + ')</summary><ul>' + list.map(i => { const a = ST.attempts.filter(x => x.id === i.id); const best = a.length ? Math.max(...a.map(x => x.p)) : null; return '<li><button type="button" class="link" data-item="' + esc(i.id) + '">' + esc(itemLabel(code, i)) + '</button><span class="muted sm mono">' + (i.gen ? 'AI · ' : '') + (best === null ? 'new' : 'best ' + Math.round(best * 100) + '%') + '</span></li>'; }).join('') + '</ul></details>';
  $('.back', main()).onclick = () => go('practice');
  $('#replay').onchange = e => { ST.settings.replay = e.target.checked; save(); };
  const startItem = it => {
    const stage = $('#stage'); $('.head', main()).classList.add('compact');
    runItem(stage, code, it, {
      mode: 'practice', counter: itemLabel(code, it).slice(0, 48),
      onQuit: () => viewTask(code),
      onDone: (res, att, slot) => {
        slot.innerHTML = resultCard(res, code) + '<div class="after"><button type="button" class="ghost" id="again">Try this item again</button><button type="button" class="primary" id="nextIt">Next item</button></div>';
        $('#rnext', stage).disabled = true; $('#rnext', stage).textContent = 'Submitted';
        $('#again', slot).onclick = () => startItem(it);
        $('#nextIt', slot).onclick = () => startItem(nextItem(code));
        slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#start').onclick = () => startItem(item || nextItem(code));
  $$('[data-item]', main()).forEach(b => b.onclick = () => startItem(list.find(i => i.id === b.dataset.item)));
  const g = $('#gen');
  if (g) g.onclick = async () => {
    const msg = $('.gen-msg'); g.disabled = true; msg.hidden = false; msg.textContent = 'Writing a new exam-style item. This takes about 20 to 60 seconds.';
    try { const it = await genItem(code); msg.textContent = 'New item added to your bank.'; startItem(it); }
    catch (e) { msg.textContent = e && e.code === 'not_granted' ? 'AI was not allowed for this page, so new items are off.' : e && e.code === 'rate_limited' ? 'Too many AI requests right now. Try again in a few minutes.' : 'The new item did not pass the format check. Press the button again for another one.'; }
    g.disabled = false;
  };
}
function itemLabel(code, i) {
  const t = i.title || i.topic || i.q || i.prompt || (i.chart && i.chart.title) || i.situation || i.text || i.passage || i.script || i.spoken || (i.paras && i.paras[0]) || i.id;
  return String(t).replace(/[\[\]]/g, '').replace(/\|[^\s]*/g, '').slice(0, 90) + (String(t).length > 90 ? '…' : '');
}

/* ---------------- AI item generation ---------------- */
const GEN_RULES = {
  RA: 'text: 50-65 words, one academic paragraph.', RS: 'text: one sentence of 9-15 words in a university context.',
  DI: 'chart.type is one of bar, line, pie, process. 4-8 labels. values are numbers matching labels (empty array for process). keypoints: 7-9 groups of lowercase words or numbers a strong answer would say.',
  RL: 'title: short. script: a 180-230 word university lecture. keypoints: 8-10 groups.', ASQ: 'q: one general-knowledge question answerable in 1-3 words. a: list of acceptable lowercase answers.',
  SGD: 'topic: a question. turns: 4-5 turns by speakers A, B and C, 35-60 words each, with different views and a final agreement. keypoints: 7-9 groups.',
  RTS: 'situation: 50-70 words in the second person describing an everyday or campus problem, ending with "What would you say?". keypoints: 7-8 groups.',
  SWT: 'passage: 230-300 words. keypoints: 6-7 groups.', WE: 'prompt: one debatable essay question in PTE style.',
  RWFIB: 'text: 70-110 words with 4-5 blanks written as [correct|distractor|distractor|distractor], correct option first, distractors wrong in word form or collocation.',
  RMCM: 'passage: 120-180 words. q: question. 5 options. answers: array of 2-3 zero-based indices of the correct options.',
  RO: 'paras: 4-5 sentences given in the CORRECT order, linked by pronouns and connectors so only one order works.',
  RFIB: 'text: 70-100 words with 4-5 single-word blanks written as [word]. extra: 3-4 distractor words.', RMCS: 'passage 100-150 words, q, 4 options, answer: zero-based index.',
  SST: 'script: a 200-260 word lecture. keypoints: 7-9 groups.', LMCM: 'script: 90-130 words, q, 5 options, answers: 2-3 zero-based indices.',
  LFIB: 'script: 60-90 words with 4-6 single-word blanks written as [word].', HCS: 'script: 90-130 words, 4 summary options of 30-45 words, answer: zero-based index.',
  LMCS: 'script: 60-100 words, q, 4 options, answer: zero-based index.', SMW: 'script: 60-90 words that stops mid-sentence. missing: the 3-7 words that complete it. options: 4 completions including the missing one. answer: its zero-based index.',
  HIW: 'spoken: 30-45 words. shown: the same text with exactly 2-4 single words replaced by plausible different words, keeping the same number of words.', WFD: 'text: one academic sentence of 8-14 words.'
};
function validGen(code, o) {
  const ex = BANK[code][0];
  for (const k of Object.keys(ex)) if (k !== 'id' && !(k in o)) return false;
  if (code === 'HIW') { const a = o.spoken.split(/\s+/), b = o.shown.split(/\s+/); if (a.length !== b.length || a.join() === b.join()) return false; }
  if (code === 'RWFIB' && !/\[[^\]]+\|[^\]]+\]/.test(o.text)) return false;
  if ((code === 'RFIB' || code === 'LFIB') && !/\[[^\]|]+\]/.test(o.text || o.script)) return false;
  if (['RMCM', 'LMCM'].includes(code) && !(Array.isArray(o.answers) && o.answers.every(i => i >= 0 && i < o.options.length))) return false;
  if (['RMCS', 'LMCS', 'HCS', 'SMW'].includes(code) && !(o.answer >= 0 && o.answer < o.options.length)) return false;
  if (code === 'DI' && !(o.chart && Array.isArray(o.chart.labels) && (o.chart.type === 'process' || o.chart.values.length === o.chart.labels.length))) return false;
  return true;
}
async function genItem(code) {
  if (!SAMPLE) throw { code: 'not_granted' };
  const ex = JSON.parse(JSON.stringify(BANK[code][0])); delete ex.id;
  const avoid = items(code).map(i => itemLabel(code, i).slice(0, 50)).join(' | ');
  const prompt = 'Write ONE new, original practice item for the PTE Academic task "' + TASKS[code].name + '". Match real exam difficulty for a candidate aiming at 79-90. Use an academic topic (science, society, business, history, environment, education or health) that differs from these: ' + avoid + '.\nRules: ' + GEN_RULES[code] + '\nReply with ONLY one JSON object with exactly the same keys and value types as this example. Do not reuse its content:\n' + JSON.stringify(ex);
  const o = await SAMPLE.json(prompt, { modelTier: 'default', cache: false });
  if (!o || typeof o !== 'object' || !validGen(code, o)) throw { code: 'invalid' };
  o.id = 'g' + Date.now().toString(36); o.gen = true;
  (ST.gen[code] = ST.gen[code] || []).push(o); genDirty = true; save();
  return o;
}

/* ---------------- mock test ---------------- */
const MOCK_COUNTS = { RA: 6, RS: 8, DI: 3, RL: 2, ASQ: 5, SGD: 2, RTS: 2, SWT: 2, WE: 2, RWFIB: 5, RMCM: 2, RO: 3, RFIB: 4, RMCS: 2, SST: 2, LMCM: 2, LFIB: 3, HCS: 2, LMCS: 2, SMW: 2, HIW: 3, WFD: 4 };
function viewMockMenu() {
  main().innerHTML = '<section class="head"><h2>Mock tests</h2><p class="muted">Exam rules apply: audio plays once, timers run, and speaking moves on by itself. Use headphones and a quiet room.</p></section>' +
    '<div class="grid2"><div class="card mockc"><span class="eyebrow">About 2 hours</span><h3>Full mock test</h3><p>All 22 task types in exam order with real item counts where your bank has them: ' + ORDER.reduce((a, c) => a + Math.min(MOCK_COUNTS[c], items(c).length), 0) + ' items. Reading and listening run on section clocks.</p><button type="button" class="primary" data-m="full">Start full mock</button></div>' +
    '<div class="card mockc"><span class="eyebrow">About 45 minutes</span><h3>Diagnostic</h3><p>One item of every task type. Use it at the start and every two weeks to see how far you have moved.</p><button type="button" class="ghost" data-m="diag">Start diagnostic</button></div>' +
    '<div class="card mockc"><span class="eyebrow">Pick a part</span><h3>Section mock</h3><p>One part at full length. Good for the last weeks before the exam.</p><div class="sec-btns">' + ['Speaking & Writing', 'Reading', 'Listening'].map(s => '<button type="button" class="ghost sm" data-m="' + s + '">' + s + '</button>').join('') + '</div></div></div>' +
    (SAMPLE ? '' : '<p class="muted sm note">Writing in mocks is marked with the quick estimate here. On claude.ai the AI examiner marks it at the end of the test.</p>');
  $$('[data-m]', main()).forEach(b => b.onclick = () => startMock(b.dataset.m));
}
function startMock(kind) {
  const steps = [];
  const want = c => kind === 'diag' ? 1 : MOCK_COUNTS[c];
  const inKind = c => kind === 'full' || kind === 'diag' || (kind === 'Speaking & Writing' && ['Speaking', 'Writing'].includes(TASKS[c].part)) || TASKS[c].part === kind;
  ORDER.filter(inKind).forEach(c => {
    const cnt = {}; ST.attempts.forEach(a => { if (a.c === c) cnt[a.id] = (cnt[a.id] || 0) + 1; });
    const pick = shuffle(items(c)).sort((a, b) => (cnt[a.id] || 0) - (cnt[b.id] || 0)).slice(0, want(c));
    pick.forEach(it => steps.push({ c, it, group: TASKS[c].part === 'Reading' ? 'Reading' : TASKS[c].part === 'Listening' && c !== 'SST' ? 'Listening' : null }));
  });
  const groupSecs = kind === 'diag' ? { Reading: 12 * 60, Listening: 12 * 60 } : { Reading: 30 * 60, Listening: 30 * 60 };
  const results = []; let i = 0, gClock = null, gName = null, gEnd = 0, ended = false;
  VIEW = 'running'; $('#plan').hidden = true; main().hidden = false;
  const stopGroup = () => { if (gClock) clearInterval(gClock); gClock = null; gName = null; };
  const finish = () => { if (ended) return; ended = true; stopGroup(); cleanup(); RUN++; mockReport(kind, steps, results); };
  const next = () => {
    if (ended) return;
    if (i >= steps.length) return finish();
    const st = steps[i];
    if (st.group !== gName) {
      stopGroup();
      if (st.group) {
        gName = st.group; gEnd = performance.now() + groupSecs[st.group] * 1000;
        gClock = setInterval(() => {
          const left = (gEnd - performance.now()) / 1000, el = $('#rclock'); if (el) el.textContent = gName + ' · ' + fmt(left);
          if (left <= 0) { const g = gName; stopGroup(); cleanup(); RUN++; while (i < steps.length && steps[i].group === g) { results.push({ st: steps[i], res: { pct: 0, s: 0, m: 1, timeout: true } }); i++; } next(); }
        }, 250);
      }
    }
    const k = i;
    runItem(main(), st.c, st.it, {
      mode: 'mock', counter: 'Item ' + (k + 1) + ' of ' + steps.length, clock: gName ? gName + ' · ' + fmt((gEnd - performance.now()) / 1000) : '',
      onQuit: () => { main().insertAdjacentHTML('afterbegin', ''); finish(); },
      onDone: (res, att) => { results.push({ st, res, att }); i = k + 1; setTimeout(next, TASKS[st.c].part === 'Speaking' ? 900 : 50); }
    });
    window.scrollTo(0, 0);
  };
  next();
}
async function mockReport(kind, steps, results) {
  VIEW = 'report';
  const pend = results.filter(r => r.res.pending);
  if (pend.length && SAMPLE) {
    main().innerHTML = '<section class="card"><h2>Marking your writing</h2><p class="thinking" id="mk">The AI examiner is marking ' + pend.length + ' written responses…</p></section>';
    let n = 0;
    for (const r of pend) {
      const { code, it, text } = r.res.pending;
      try { const ai = await aiWriting(code, it, text); Object.assign(r.res, ai); if (r.att) { r.att.p = Math.round(ai.pct * 1000) / 1000; r.att.s = ai.s; r.att.m = ai.m; r.att.ai = true; } } catch (e) { if (e && e.code === 'not_granted') break; }
      n++; const el = $('#mk'); if (el) el.textContent = 'Marked ' + n + ' of ' + pend.length + '…';
    }
    save();
  }
  const list = results.filter(r => r.att).map(r => r.att).concat(results.filter(r => r.res.timeout).map(r => ({ c: r.st.c, p: 0, t: 0, id: r.st.it.id })));
  const est = skillEst(list), have = SKILLS.filter(s => est[s]);
  const overall = have.length ? Math.round(have.reduce((a, s) => a + est[s].score, 0) / have.length) : null;
  const byTask = ORDER.map(c => { const rs = results.filter(r => r.st.c === c); if (!rs.length) return null; const avg = rs.reduce((a, r) => a + (r.res.pct || 0), 0) / rs.length; return { c, n: rs.length, avg, to: rs.filter(r => r.res.timeout).length }; }).filter(Boolean);
  const weakest = byTask.slice().sort((a, b) => (a.avg - b.avg) * 1 - 0.0001 * (TASKS[b.c].w - TASKS[a.c].w)).slice(0, 4);
  main().innerHTML = '<section class="hero"><div class="hero-l"><span class="eyebrow">' + (kind === 'diag' ? 'Diagnostic' : kind === 'full' ? 'Full mock' : kind + ' mock') + ' result</span><div class="overall mono">' + (overall ?? '—') + '<span>/90</span></div><p class="muted">' + results.length + ' of ' + steps.length + ' items answered. Scores are estimates of the PTE 10-90 scale.</p><div class="hero-cta"><button type="button" class="primary" data-act="practice">Practise weak tasks</button><button type="button" class="ghost" id="home">Back to dashboard</button></div></div><div class="hero-r">' + skillBars(est) + '</div></section>' +
    '<section class="card"><h3>Focus next</h3><ul class="next">' + weakest.map(x => '<li><span class="code mono">' + x.c + '</span><span class="nx-name">' + esc(TASKS[x.c].name) + '<span class="muted sm">' + Math.round(x.avg * 100) + '% in this test</span></span><button type="button" class="ghost sm" data-task="' + x.c + '">Train</button></li>').join('') + '</ul></section>' +
    '<section class="card"><h3>By task</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Task</th><th class="num">Items</th><th class="num">Score</th><th>Status</th></tr></thead><tbody>' + byTask.map(x => '<tr data-task="' + x.c + '" tabindex="0"><td><span class="code mono">' + x.c + '</span> ' + esc(TASKS[x.c].name) + (x.to ? ' <span class="muted sm">(' + x.to + ' timed out)</span>' : '') + '</td><td class="num mono">' + x.n + '</td><td class="num mono">' + Math.round(x.avg * 100) + '%</td><td>' + statusPill({ avg: x.avg }) + '</td></tr>').join('') + '</tbody></table></div></section>';
  $('#home').onclick = () => go('home');
  bindCommon();
}

/* ---------------- boot ---------------- */
function boot() {
  loadLocal();
  $$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.go));
  renderEnv();
  const tok = (location.hash || '').slice(1);
  if (['home', 'practice', 'mock', 'plan'].includes(tok)) VIEW = tok;
  go(VIEW);
  initCloud();
  // phones only allow audio after a tap: unlock speech and sound on the first one
  const unlock = () => {
    document.removeEventListener('pointerdown', unlock, true);
    try { getAC(); } catch (e) { }
    if (ENV.tts) { try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); TTS.load(); } catch (e) { } }
  };
  document.addEventListener('pointerdown', unlock, true);
  // installable app when hosted on its own (not inside claude.ai)
  if (!window.claude && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') && $('link[rel="manifest"]')) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
