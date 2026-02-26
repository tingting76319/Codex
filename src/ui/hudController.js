export function createHudController({ hud, game, updateAudioHud }) {
  function setMessage(text) {
    hud.msg.textContent = text;
  }

  function updateHud() {
    hud.lives.textContent = String(game.lives);
    hud.gold.textContent = String(game.gold);
    hud.kills.textContent = String(game.kills);
    hud.wave.textContent = String(Math.max(1, game.wave));
    if (hud.waveBtn) {
      if (game.waveActive) {
        hud.waveBtn.textContent = "本波進行中";
      } else if (game.displaySettings?.autoStartWaves !== false) {
        const t = Math.max(0, Number(game.autoWaveTimer ?? 0));
        const bonus = Math.max(0, Number(game.autoWaveBonusPreview ?? 0));
        hud.waveBtn.textContent = `下一波 ${t.toFixed(1)}s${bonus > 0 ? `｜提前 +${bonus}` : ""}`;
      } else {
        hud.waveBtn.textContent = "開始/下一波";
      }
    }
    if (hud.waveAutoStatus) {
      const autoEnabled = game.displaySettings?.autoStartWaves !== false;
      hud.waveAutoStatus.style.display = autoEnabled || !game.waveActive ? "block" : "none";
      if (hud.waveAutoModeLabel) {
        const streak = Math.max(0, Number(game.earlyStartStreak ?? 0));
        hud.waveAutoModeLabel.textContent = `自動開波：${autoEnabled ? "開" : "關"}${streak > 0 ? `｜連續提前 x${streak}` : ""}`;
      }
      if (hud.waveAutoCountdownLabel) {
        if (game.waveActive) hud.waveAutoCountdownLabel.textContent = "本波進行中";
        else if (autoEnabled) hud.waveAutoCountdownLabel.textContent = `下一波 ${Math.max(0, Number(game.autoWaveTimer ?? 0)).toFixed(1)}s`;
        else hud.waveAutoCountdownLabel.textContent = "手動開始";
      }
      if (hud.waveAutoProgressBar) {
        const total = Math.max(0.2, Number(game.autoWaveDelayTotal ?? 1.4));
        const remaining = Math.max(0, Number(game.autoWaveTimer ?? 0));
        const pct = game.waveActive ? 100 : autoEnabled ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : 0;
        hud.waveAutoProgressBar.style.width = `${pct}%`;
      }
    }
    hud.pauseBtn.textContent = game.paused ? "繼續" : "暫停";
    hud.speedBtn.textContent = game.timeScale === 1 ? "x1 速度" : "x2 速度";
    if (hud.mapLabel) hud.mapLabel.textContent = game.mapShortLabel ?? "-";
    if (hud.stageLabel) hud.stageLabel.textContent = game.stageShortLabel ?? "-";
    const activeButtons = {
      basic: hud.towerTypeBasicBtn,
      slow: hud.towerTypeSlowBtn,
      splash: hud.towerTypeSplashBtn,
      sniper: hud.towerTypeSniperBtn,
      support: hud.towerTypeSupportBtn
    };
    for (const btn of Object.values(activeButtons)) {
      if (btn) btn.classList.remove("is-active");
    }
    activeButtons[game.selectedTowerType]?.classList.add("is-active");
    updateAudioHud();
  }

  return { setMessage, updateHud };
}
