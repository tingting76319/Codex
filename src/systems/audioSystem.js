export function createAudioSystem({ game, hud }) {
const audioState = {
  ctx: null,
  masterGain: null,
  bgmGain: null,
  sfxGain: null,
  initialized: false,
  started: false,
  nextBgmTime: 0,
  bgmStep: 0,
  bgmMode: "calm",
  lastSfxAt: new Map()
};

function updateAudioHud() {
  if (hud.muteBtn) {
    hud.muteBtn.textContent = game.audioMuted ? "靜音中" : "音訊開啟";
  }
  if (hud.bgmVolumeValue) hud.bgmVolumeValue.textContent = String(Math.round(game.bgmVolume * 100));
  if (hud.sfxVolumeValue) hud.sfxVolumeValue.textContent = String(Math.round(game.sfxVolume * 100));
}

function applyAudioVolumes() {
  if (!audioState.initialized) return;
  const muted = game.audioMuted ? 0 : 1;
  audioState.masterGain.gain.setTargetAtTime(muted, audioState.ctx.currentTime, 0.02);
  audioState.bgmGain.gain.setTargetAtTime(Math.max(0, game.bgmVolume), audioState.ctx.currentTime, 0.03);
  audioState.sfxGain.gain.setTargetAtTime(Math.max(0, game.sfxVolume), audioState.ctx.currentTime, 0.02);
}

function ensureAudio() {
  if (audioState.initialized) {
    if (audioState.ctx.state === "suspended") {
      audioState.ctx.resume().catch(() => {});
    }
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctxAudio = new AudioCtx();
  const masterGain = ctxAudio.createGain();
  const bgmGain = ctxAudio.createGain();
  const sfxGain = ctxAudio.createGain();
  masterGain.gain.value = game.audioMuted ? 0 : 1;
  bgmGain.gain.value = game.bgmVolume;
  sfxGain.gain.value = game.sfxVolume;
  bgmGain.connect(masterGain);
  sfxGain.connect(masterGain);
  masterGain.connect(ctxAudio.destination);
  audioState.ctx = ctxAudio;
  audioState.masterGain = masterGain;
  audioState.bgmGain = bgmGain;
  audioState.sfxGain = sfxGain;
  audioState.initialized = true;
  applyAudioVolumes();
}

function playTone({
  type = "sine",
  freq = 440,
  duration = 0.12,
  gain = 0.15,
  attack = 0.005,
  release = 0.08,
  when = null,
  target = "sfx",
  endFreq = null
}) {
  ensureAudio();
  if (!audioState.initialized) return;
  const ctxAudio = audioState.ctx;
  const start = when ?? ctxAudio.currentTime;
  const osc = ctxAudio.createOscillator();
  const env = ctxAudio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
  }
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.01, duration + release));
  osc.connect(env);
  env.connect(target === "bgm" ? audioState.bgmGain : audioState.sfxGain);
  osc.start(start);
  osc.stop(start + duration + release + 0.02);
}

function playNoiseBurst({ duration = 0.08, gain = 0.08, when = null, lowpass = 1800 } = {}) {
  ensureAudio();
  if (!audioState.initialized) return;
  const ctxAudio = audioState.ctx;
  const start = when ?? ctxAudio.currentTime;
  const buffer = ctxAudio.createBuffer(1, Math.max(256, Math.floor(ctxAudio.sampleRate * duration)), ctxAudio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctxAudio.createBufferSource();
  src.buffer = buffer;
  const filter = ctxAudio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = lowpass;
  const env = ctxAudio.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.06);
  src.connect(filter);
  filter.connect(env);
  env.connect(audioState.sfxGain);
  src.start(start);
  src.stop(start + duration + 0.08);
}

function playSfx(name) {
  ensureAudio();
  if (!audioState.initialized || game.audioMuted || game.sfxVolume <= 0) return;
  const now = performance.now();
  const throttleMs = {
    shotBasic: 20,
    shotSlow: 25,
    shotSplash: 35,
    hit: 15,
    enemyLeak: 120,
    bossShield: 160,
    bossSummon: 180
  };
  const last = audioState.lastSfxAt.get(name) ?? 0;
  if (throttleMs[name] && now - last < throttleMs[name]) return;
  audioState.lastSfxAt.set(name, now);

  if (name === "shotBasic") playTone({ type: "triangle", freq: 920, endFreq: 520, duration: 0.05, gain: 0.05 });
  else if (name === "shotSlow") playTone({ type: "sine", freq: 520, endFreq: 260, duration: 0.08, gain: 0.06 });
  else if (name === "shotSplash") {
    playTone({ type: "square", freq: 260, endFreq: 120, duration: 0.07, gain: 0.055 });
    playNoiseBurst({ duration: 0.05, gain: 0.025, lowpass: 1200 });
  } else if (name === "hit") playTone({ type: "triangle", freq: 340, endFreq: 250, duration: 0.03, gain: 0.03 });
  else if (name === "kill") playTone({ type: "sine", freq: 680, endFreq: 820, duration: 0.06, gain: 0.045 });
  else if (name === "towerPlace") playTone({ type: "triangle", freq: 420, endFreq: 620, duration: 0.09, gain: 0.06 });
  else if (name === "towerUpgrade") {
    playTone({ type: "triangle", freq: 520, duration: 0.07, gain: 0.05 });
    playTone({ type: "triangle", freq: 780, duration: 0.09, gain: 0.045, when: audioState.ctx.currentTime + 0.06 });
  } else if (name === "branchUpgrade") {
    playTone({ type: "sine", freq: 700, duration: 0.06, gain: 0.05 });
    playTone({ type: "sine", freq: 980, duration: 0.07, gain: 0.045, when: audioState.ctx.currentTime + 0.05 });
    playTone({ type: "sine", freq: 1280, duration: 0.08, gain: 0.035, when: audioState.ctx.currentTime + 0.11 });
  } else if (name === "waveStart") playTone({ type: "triangle", freq: 380, endFreq: 540, duration: 0.15, gain: 0.055 });
  else if (name === "bossAlarm") {
    playTone({ type: "sawtooth", freq: 180, duration: 0.18, gain: 0.06 });
    playTone({ type: "sawtooth", freq: 160, duration: 0.18, gain: 0.05, when: audioState.ctx.currentTime + 0.22 });
  } else if (name === "bossSummon") {
    playTone({ type: "sawtooth", freq: 240, endFreq: 140, duration: 0.22, gain: 0.07 });
    playNoiseBurst({ duration: 0.08, gain: 0.05, lowpass: 900 });
  } else if (name === "bossShield") {
    playTone({ type: "sine", freq: 420, endFreq: 880, duration: 0.2, gain: 0.05 });
    playTone({ type: "sine", freq: 620, endFreq: 1240, duration: 0.18, gain: 0.035 });
  } else if (name === "enemyLeak") playTone({ type: "square", freq: 220, endFreq: 130, duration: 0.12, gain: 0.05 });
  else if (name === "gameOver") {
    playTone({ type: "sawtooth", freq: 260, endFreq: 110, duration: 0.36, gain: 0.08 });
    playNoiseBurst({ duration: 0.16, gain: 0.05, lowpass: 700 });
  }
}

function scheduleBgmTick() {
  ensureAudio();
  if (!audioState.initialized) return;
  const ctxAudio = audioState.ctx;
  const mode = game.lives <= 6 || game.wave % 5 === 0 || game.fishes.some((f) => f.isBoss) ? "combat" : "calm";
  audioState.bgmMode = mode;
  const stepDur = mode === "combat" ? 0.22 : 0.34;
  const calmSeq = [164.81, 196.0, 220.0, 196.0, 246.94, 220.0, 196.0, 174.61];
  const combatBass = [110.0, 110.0, 123.47, 123.47, 98.0, 98.0, 92.5, 98.0];
  const combatLead = [220.0, 246.94, 220.0, 293.66, 246.94, 220.0, 196.0, 220.0];
  const idx = audioState.bgmStep % 8;
  if (mode === "calm") {
    playTone({ target: "bgm", type: "triangle", freq: calmSeq[idx], duration: 0.18, gain: 0.06, when: audioState.nextBgmTime });
    if (idx % 2 === 0) {
      playTone({ target: "bgm", type: "sine", freq: calmSeq[idx] / 2, duration: 0.28, gain: 0.035, when: audioState.nextBgmTime });
    }
  } else {
    playTone({ target: "bgm", type: "square", freq: combatBass[idx], duration: 0.12, gain: 0.055, when: audioState.nextBgmTime });
    playTone({ target: "bgm", type: "triangle", freq: combatLead[idx], duration: 0.1, gain: 0.04, when: audioState.nextBgmTime + 0.04 });
  }
  audioState.bgmStep += 1;
  audioState.nextBgmTime += stepDur;
  if (!audioState.started) audioState.started = true;
  if (audioState.nextBgmTime < ctxAudio.currentTime) audioState.nextBgmTime = ctxAudio.currentTime + 0.05;
}

function updateBgmScheduler() {
  if (!audioState.initialized || game.audioMuted || game.bgmVolume <= 0) return;
  const ctxAudio = audioState.ctx;
  if (ctxAudio.state === "suspended") return;
  if (!audioState.started) {
    audioState.nextBgmTime = ctxAudio.currentTime + 0.03;
  }
  while (audioState.nextBgmTime < ctxAudio.currentTime + 0.35) {
    scheduleBgmTick();
  }
}

  return { updateAudioHud, applyAudioVolumes, ensureAudio, playSfx, updateBgmScheduler };
}
