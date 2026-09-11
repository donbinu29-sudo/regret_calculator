// Presets
const presets = [
  "Texted my ex at 2am",
  "Quit without a plan",
  "Replied-all to the company"
];

// DOM Elements
const presetsEl = document.getElementById('presets');
const inputEl = document.getElementById('input');
const runBtn = document.getElementById('runBtn');
const emptyState = document.getElementById('emptyState');
const readout = document.getElementById('readout');
const gaugeSvg = document.getElementById('gaugeSvg');
const needle = document.getElementById('needle');
const gaugeFillArc = document.getElementById('gaugeFillArc');
const pivotDot = document.getElementById('pivotDot');
const scoreNum = document.getElementById('scoreNum');
const verdictText = document.getElementById('verdictText');
const reasonsList = document.getElementById('reasonsList');
const copeBtn = document.getElementById('copeBtn');
const copeBox = document.getElementById('copeBox');
const bgWrapper = document.getElementById('bgWrapper');

// Header Engine Elements
const engineDot = document.getElementById('engineDot');
const engineName = document.getElementById('engineName');

// API Modal Elements
const apiModalBtn = document.getElementById('apiModalBtn');
const apiModal = document.getElementById('apiModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const apiProviderEl = document.getElementById('apiProvider');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiBtn = document.getElementById('saveApiBtn');
const clearApiBtn = document.getElementById('clearApiBtn');
const envStatusText = document.getElementById('envStatusText');

let currentKey = "";
let currentProvider = "gemini";
let lastInput = "";
let lastAdvice = "";

const ARC_LENGTH = 314.16;

// ============================================================
// PARTICLE CANVAS ENGINE
// ============================================================
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let width = 0;
let height = 0;
let mouseX = -1000;
let mouseY = -1000;
let currentParticleTheme = 'default';

function resizeCanvas() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

class Particle {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 0.45;
    this.vy = (Math.random() - 0.5) * 0.45;
    this.radius = Math.random() * 1.8 + 1;
    this.baseAlpha = Math.random() * 0.45 + 0.15;
    this.alpha = this.baseAlpha;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;

    // Mouse gentle repulsion
    const dx = this.x - mouseX;
    const dy = this.y - mouseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 100 && dist > 0) {
      const force = (100 - dist) / 100 * 0.6;
      this.x += (dx / dist) * force;
      this.y += (dy / dist) * force;
    }

    // Wrap around screen
    if (this.x < -10) this.x = width + 10;
    if (this.x > width + 10) this.x = -10;
    if (this.y < -10) this.y = height + 10;
    if (this.y > height + 10) this.y = -10;
  }
  draw() {
    let rgb = Math.random() > 0.5 ? '14, 116, 255' : '168, 85, 247';
    if (currentParticleTheme === 'hot') {
      rgb = Math.random() > 0.4 ? '255, 69, 58' : '255, 107, 0';
    } else if (currentParticleTheme === 'moderate') {
      rgb = Math.random() > 0.5 ? '10, 132, 255' : '147, 51, 234';
    } else if (currentParticleTheme === 'mild') {
      rgb = Math.random() > 0.5 ? '16, 185, 129' : '6, 182, 212';
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb}, ${this.alpha})`;
    ctx.fill();
  }
}

// Spawn particles
const numParticles = Math.min(55, Math.floor(window.innerWidth / 28));
for (let i = 0; i < numParticles; i++) {
  particles.push(new Particle());
}

function animateParticles() {
  ctx.clearRect(0, 0, width, height);

  // Draw connecting lines between nearby particles
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 110) {
        const lineAlpha = (1 - dist / 110) * 0.12;
        let lineRgb = currentParticleTheme === 'hot' 
          ? '239, 68, 68' 
          : (currentParticleTheme === 'mild' ? '16, 185, 129' : '168, 85, 247');
        ctx.strokeStyle = `rgba(${lineRgb}, ${lineAlpha})`;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  // Update & draw particles
  for (let p of particles) {
    p.update();
    p.draw();
  }

  requestAnimationFrame(animateParticles);
}
animateParticles();

// Populate Presets
presets.forEach(text => {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'preset-chip';
  chip.textContent = text;
  chip.onclick = () => {
    inputEl.value = text;
    inputEl.focus();
  };
  presetsEl.appendChild(chip);
});

// Parse .env
function parseEnvContent(text) {
  const lines = text.split('\n');
  let key = '';
  let provider = '';
  for (const line of lines) {
    const clean = line.trim();
    if (clean.startsWith('#') || !clean.includes('=')) continue;
    const [name, ...valParts] = clean.split('=');
    const val = valParts.join('=').trim().replace(/^["']|["']$/g, '');
    if (name.trim() === 'API_KEY' && val) key = val;
    if (name.trim() === 'API_PROVIDER' && val) provider = val.toLowerCase();
  }
  return { key, provider };
}

// // Detect Config
async function detectConfiguration() {
  let detectedKey = '';
  let detectedProvider = 'gemini';
  let source = 'offline';

  // 1. Check .env file first
  try {
    const res = await fetch('.env?t=' + Date.now());
    if (res.ok) {
      const text = await res.text();
      const parsed = parseEnvContent(text);
      if (parsed.key) {
        detectedKey = parsed.key;
        if (parsed.provider) detectedProvider = parsed.provider;
        source = '.env file';
        // Auto-sync into localStorage so direct file:// opens also have the key!
        localStorage.setItem('regret_api_key', detectedKey);
        localStorage.setItem('regret_api_provider', detectedProvider);
      }
    }
  } catch (e) {}

  // 2. Fall back to localStorage if .env was empty or blocked by browser file:// policy
  if (!detectedKey) {
    const savedKey = localStorage.getItem('regret_api_key');
    const savedProvider = localStorage.getItem('regret_api_provider');
    if (savedKey && savedKey.trim()) {
      detectedKey = savedKey.trim();
      detectedProvider = savedProvider || 'gemini';
      source = 'saved in browser';
    }
  }

  currentKey = detectedKey;
  currentProvider = detectedProvider;
  apiKeyInput.value = detectedKey;
  apiProviderEl.value = detectedProvider;

  if (currentKey) {
    engineDot.className = 'engine-dot active';
    engineName.textContent = currentProvider.toUpperCase();
    envStatusText.textContent = `Active: ${currentProvider.toUpperCase()} (${source})`;
  } else {
    engineDot.className = 'engine-dot';
    engineName.textContent = 'API Settings';
    envStatusText.textContent = 'No key set. Using offline simulation.';
  }
}

detectConfiguration();

// Modal Actions
apiModalBtn.onclick = () => apiModal.classList.add('open');
closeModalBtn.onclick = () => apiModal.classList.remove('open');
apiModal.onclick = (e) => {
  if (e.target === apiModal) apiModal.classList.remove('open');
};

saveApiBtn.onclick = () => {
  const key = apiKeyInput.value.trim();
  const provider = apiProviderEl.value;
  if (key) {
    localStorage.setItem('regret_api_key', key);
    localStorage.setItem('regret_api_provider', provider);
  } else {
    localStorage.removeItem('regret_api_key');
    localStorage.removeItem('regret_api_provider');
  }
  detectConfiguration();
  apiModal.classList.remove('open');
};

clearApiBtn.onclick = () => {
  localStorage.removeItem('regret_api_key');
  localStorage.removeItem('regret_api_provider');
  apiKeyInput.value = '';
  detectConfiguration();
  apiModal.classList.remove('open');
};

// Update Gauge (Center 140, 135)
function updateGaugeVisual(score) {
  const angle = -90 + (score / 100) * 180;
  needle.style.transition = 'transform 1.1s cubic-bezier(0.2, 0.9, 0.25, 1)';
  needle.setAttribute('transform', `rotate(${angle} 140 135)`);

  const targetOffset = ARC_LENGTH - (score / 100) * ARC_LENGTH;
  gaugeFillArc.style.strokeDashoffset = targetOffset;

  if (score >= 75) {
    pivotDot.setAttribute('fill', '#ff453a');
  } else if (score >= 45) {
    pivotDot.setAttribute('fill', '#0a84ff');
  } else {
    pivotDot.setAttribute('fill', '#30d158');
  }
}

// Odometer Rollup
function animateScoreCounter(targetScore) {
  const duration = 1000;
  const start = 0;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (targetScore - start) * eased);
    scoreNum.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      scoreNum.textContent = targetScore;
    }
  }
  requestAnimationFrame(step);
}

// Built-in Offline Engine
function generateOfflineDiagnosis(text) {
  const lower = text.toLowerCase();
  let score = 75;
  let verdict = "Severe lapses in judgment";
  let reasons = [
    "Your prefrontal cortex took an unscheduled recess at the worst possible moment.",
    "The future you will look back on this moment with profound, visceral disbelief.",
    "Even your inner monologue is actively seeking independent legal representation."
  ];
  let advice = "Delete the app, throw your phone into a river, and start a quiet goat farm in Vermont.";

  if (lower.includes('ex') || lower.includes('text') || lower.includes('dm') || lower.includes('call') || lower.includes('message')) {
    score = 94;
    verdict = "Dignity officially evicted";
    reasons = [
      "They took a screenshot within four seconds to share in a group chat named 'emergency'.",
      "No sequence of follow-up paragraphs can reconstruct the pride you just surrendered.",
      "The 'read' receipt is already filing for emotional hazard compensation."
    ];
    advice = "Claim your phone was commandeered by a mischievous toddler or a rogue state actor.";
  } else if (lower.includes('job') || lower.includes('quit') || lower.includes('boss') || lower.includes('work') || lower.includes('email') || lower.includes('reply')) {
    score = 88;
    verdict = "Career trajectory compromised";
    reasons = [
      "HR has likely scheduled an impromptu sync ambiguously titled 'Friendly Touchpoint'.",
      "Your savings account is already hyperventilating behind closed doors.",
      "The exhilarating rush of sudden freedom will evaporate precisely when the rent invoice arrives."
    ];
    advice = "Update your LinkedIn headline immediately to 'Visionary Disruptor of Predictable Income'.";
  } else if (lower.includes('cake') || lower.includes('ate') || lower.includes('food') || lower.includes('pizza') || lower.includes('drink') || lower.includes('alcohol')) {
    score = 69;
    verdict = "Digestive & moral emergency";
    reasons = [
      "The serving size suggestion was never a personal challenge, though you treated it as one.",
      "Your metabolism has formally resigned in protest and joined a labor strike.",
      "Tomorrow morning is already preparing a very hostile cross-examination with you."
    ];
    advice = "Drink two sips of water, lie horizontally, and convince yourself calories are a social construct.";
  } else if (lower.includes('crypto') || lower.includes('money') || lower.includes('spent') || lower.includes('bought') || lower.includes('shopping')) {
    score = 86;
    verdict = "Financial disaster unlocked";
    reasons = [
      "Your wallet would file a restraining order if it had access to local law enforcement.",
      "The return policy definitely expired thirty seconds before your transaction settled.",
      "You have converted legal tender into pure, unadulterated buyer's remorse."
    ];
    advice = "Uninstall your banking application. If you cannot see the balance, technically it doesn't exist.";
  } else if (lower.includes('waiter') || lower.includes('you too') || lower.includes('awkward') || lower.includes('said')) {
    score = 64;
    verdict = "Social exile recommended";
    reasons = [
      "The other person is still processing what you meant and will never fully recover.",
      "You must now avoid that entire quadrant of the city indefinitely.",
      "This exact interaction will replay in your head every night at 2:45 AM for six years."
    ];
    advice = "Legally change your name and communicate exclusively through subtle written gestures.";
  } else {
    const hash = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    score = 52 + (hash % 44);
  }

  return { score, verdict, reasons, advice };
}

// AI API Callers
async function callGemini(apiKey, prompt) {
  const models = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
  const systemInstruction = `You are a deadpan, humorous regret calculator. Respond strictly with JSON (no markdown fences, no backticks).
Format:
{"score": number 0-100, "verdict": "short punchy phrase (max 6 words)", "reasons": ["short reason 1", "short reason 2", "short reason 3"], "advice": "absurd deadpan coping advice"}`;

  let lastError = null;

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\nAction: ${prompt}` }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Gemini ${res.status}: ${errorBody}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      let cleaned = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      return JSON.parse(cleaned);
    } catch (err) {
      lastError = err;
      if (!err.message.includes("404")) break;
    }
  }

  throw lastError;
}

async function callClaude(apiKey, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 600,
      system: `You are a deadpan, humorous regret calculator. Return strictly JSON with keys "score" (0-100), "verdict" (max 6 words), "reasons" (3 short punchy reasons), and "advice" (absurd coping advice). No markdown.`,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Claude ${res.status}: ${errorBody}`);
  }
  const data = await res.json();
  const rawText = data.content.map(b => b.text || "").join("");
  let cleaned = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

async function callOpenAI(apiKey, prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a deadpan, humorous regret calculator. Return JSON with keys "score" (0-100), "verdict" (max 6 words), "reasons" (3 short punchy reasons), and "advice" (absurd coping advice).`
        },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errorBody}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}

// Run Diagnosis
runBtn.onclick = async () => {
  const val = inputEl.value.trim();
  if (!val) {
    inputEl.focus();
    return;
  }

  lastInput = val;
  runBtn.disabled = true;
  runBtn.querySelector('span').textContent = "Calculating...";
  
  if (emptyState) emptyState.style.display = 'none';
  readout.classList.remove('show');
  copeBox.classList.remove('show');
  copeBox.textContent = "";
  gaugeSvg.classList.add('sweeping');
  gaugeFillArc.style.strokeDashoffset = ARC_LENGTH;

  let result;

  try {
    if (currentKey) {
      if (currentProvider === 'claude') {
        result = await callClaude(currentKey, val);
      } else if (currentProvider === 'openai') {
        result = await callOpenAI(currentKey, val);
      } else {
        result = await callGemini(currentKey, val);
      }
    } else {
      await new Promise(r => setTimeout(r, 600));
      result = generateOfflineDiagnosis(val);
    }
  } catch (err) {
    console.warn("API request failed, falling back to local engine:", err);
    result = generateOfflineDiagnosis(val);
  }

  gaugeSvg.classList.remove('sweeping');
  runBtn.disabled = false;
  runBtn.querySelector('span').textContent = "Calculate Regret";

  if (result) {
    const score = Math.max(0, Math.min(100, Math.round(result.score || 72)));
    updateGaugeVisual(score);
    animateScoreCounter(score);
    verdictText.textContent = result.verdict || "Questionable life choices";

    // Ambient background and particles shift
    bgWrapper.className = 'bg-wrapper';
    if (score >= 75) {
      bgWrapper.classList.add('hot');
      currentParticleTheme = 'hot';
    } else if (score >= 45) {
      bgWrapper.classList.add('moderate');
      currentParticleTheme = 'moderate';
    } else {
      bgWrapper.classList.add('mild');
      currentParticleTheme = 'mild';
    }

    reasonsList.innerHTML = "";
    (result.reasons || []).forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      reasonsList.appendChild(li);
    });

    lastAdvice = result.advice || "Sit with it.";
    readout.classList.add('show');
  }
};

// Coping Advice
copeBtn.onclick = () => {
  if (copeBox.classList.contains('show')) {
    copeBox.classList.remove('show');
  } else {
    copeBox.textContent = lastAdvice;
    copeBox.classList.add('show');
  }
};

// Enter Shortcut
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    runBtn.click();
  }
});
