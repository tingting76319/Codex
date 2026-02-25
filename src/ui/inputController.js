export function bindInputHandlers({
  canvas,
  hud,
  menu,
  onCanvasClick,
  onStartWave,
  onTogglePause,
  onToggleSpeed,
  onSelectTowerType,
  onToggleMute,
  onBgmVolumeInput,
  onSfxVolumeInput,
  onMapChange,
  onStageChange,
  onApplyStage,
  onMenuMapChange,
  onMenuStageChange,
  onMenuStart,
  onMenuClose
}) {
  canvas.addEventListener("click", onCanvasClick);
  hud.waveBtn?.addEventListener("click", onStartWave);
  hud.pauseBtn?.addEventListener("click", onTogglePause);
  hud.speedBtn?.addEventListener("click", onToggleSpeed);
  hud.towerTypeBasicBtn?.addEventListener("click", () => onSelectTowerType?.("basic"));
  hud.towerTypeSlowBtn?.addEventListener("click", () => onSelectTowerType?.("slow"));
  hud.towerTypeSplashBtn?.addEventListener("click", () => onSelectTowerType?.("splash"));
  hud.muteBtn?.addEventListener("click", onToggleMute);
  hud.bgmVolume?.addEventListener("input", onBgmVolumeInput);
  hud.sfxVolume?.addEventListener("input", onSfxVolumeInput);
  hud.mapSelect?.addEventListener("change", onMapChange);
  hud.stageSelect?.addEventListener("change", onStageChange);
  hud.applyStageBtn?.addEventListener("click", onApplyStage);
  menu?.mapSelect?.addEventListener("change", onMenuMapChange);
  menu?.stageSelect?.addEventListener("change", onMenuStageChange);
  menu?.startBtn?.addEventListener("click", onMenuStart);
  menu?.closeBtn?.addEventListener("click", onMenuClose);
}
