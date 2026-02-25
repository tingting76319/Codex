export function createHudController({ hud, game, updateAudioHud }) {
  function setMessage(text) {
    hud.msg.textContent = text;
  }

  function updateHud() {
    hud.lives.textContent = String(game.lives);
    hud.gold.textContent = String(game.gold);
    hud.kills.textContent = String(game.kills);
    hud.wave.textContent = String(Math.max(1, game.wave));
    hud.pauseBtn.textContent = game.paused ? "繼續" : "暫停";
    hud.speedBtn.textContent = game.timeScale === 1 ? "x1 速度" : "x2 速度";
    if (hud.mapLabel) hud.mapLabel.textContent = game.mapShortLabel ?? "-";
    if (hud.stageLabel) hud.stageLabel.textContent = game.stageShortLabel ?? "-";
    const activeButtons = {
      basic: hud.towerTypeBasicBtn,
      slow: hud.towerTypeSlowBtn,
      splash: hud.towerTypeSplashBtn
    };
    for (const btn of Object.values(activeButtons)) {
      if (btn) btn.classList.remove("is-active");
    }
    activeButtons[game.selectedTowerType]?.classList.add("is-active");
    updateAudioHud();
  }

  return { setMessage, updateHud };
}
