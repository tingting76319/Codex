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
  let lastCanvasPointerTs = 0;
  const handleCanvasPointer = (event) => {
    lastCanvasPointerTs = performance.now();
    onCanvasClick?.(event);
  };
  const handleCanvasClick = (event) => {
    // Some macOS/Electron setups dispatch both pointer and click; drop duplicate click.
    if (performance.now() - lastCanvasPointerTs < 220) return;
    onCanvasClick?.(event);
  };
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", handleCanvasPointer);
  canvas.addEventListener("click", handleCanvasClick);
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
