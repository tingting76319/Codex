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
        hud.waveBtn.textContent = `提前開波 ${t.toFixed(1)}s${bonus > 0 ? `｜+${bonus}` : ""}`;
      } else {
        hud.waveBtn.textContent = "開始/下一波";
      }
    }
    if (hud.waveAutoStatus) {
      const autoEnabled = game.displaySettings?.autoStartWaves !== false;
      hud.waveAutoStatus.style.display = autoEnabled || !game.waveActive ? "block" : "none";
      if (hud.waveAutoModeLabel) {
        const streak = Math.max(0, Number(game.earlyStartStreak ?? 0));
        const capMult = Number(game.earlyStartBonusCapMult ?? 1.75);
        const condMult = Number(game.earlyStartConditionBonusMult ?? 1);
        hud.waveAutoModeLabel.textContent = `自動開波：${autoEnabled ? "開" : "關"}${streak > 0 ? `｜連續提前 x${streak}` : ""}｜條件加成 x${condMult.toFixed(2)}｜獎勵上限 x${capMult.toFixed(2)}`;
      }
      if (hud.waveAutoCountdownLabel) {
        const totalBonus = Math.max(0, Number(game.earlyStartBonusTotal ?? 0));
        if (game.waveActive) hud.waveAutoCountdownLabel.textContent = `本波進行中｜本關提前獎勵 +${totalBonus}`;
        else if (autoEnabled) hud.waveAutoCountdownLabel.textContent = `下一波 ${Math.max(0, Number(game.autoWaveTimer ?? 0)).toFixed(1)}s｜本關提前獎勵 +${totalBonus}`;
        else hud.waveAutoCountdownLabel.textContent = `手動開始｜本關提前獎勵 +${totalBonus}`;
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
