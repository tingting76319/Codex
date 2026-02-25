# Changelog

本檔案記錄對使用者可見的重要更新（功能、修正、發佈流程）。

格式參考 Keep a Changelog（簡化版）。

## [1.0.4] - 2026-02-25

### Changed
- CI 打包腳本加入 `--publish never`，避免 `electron-builder` 在 tag build 階段自動發佈造成 `GH_TOKEN` 錯誤。

## [1.0.3] - 2026-02-25

### Fixed
- GitHub Actions `Create GitHub Release` step 傳入 `GH_TOKEN`，修正 release action 因缺 token 失敗。

## [1.0.2] - 2026-02-25

### Fixed
- GitHub Actions workflow 修正 `secrets` 條件式語法，改為使用 `env` 旗標判斷。

## [1.0.1] - 2026-02-25

### Fixed
- GitHub Actions 在缺少簽章憑證 secrets 時，明確關閉 code signing，避免空 `CSC_LINK` 導致 build 失敗。

## [1.0.0] - 2026-02-25

### Added
- 魚塔防禦遊戲核心玩法（多魚種、多塔種、Boss 波次、技能樹、音訊、主選單、圖鑑、關卡模式）
- DMG 打包（macOS）
- GitHub Actions macOS 打包 workflow（初版）
