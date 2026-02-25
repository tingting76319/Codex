# GitHub Actions macOS 簽章 / 公證設定

本專案已提供：

- Workflow: `.github/workflows/build-macos.yml`
- notarize hook: `scripts/notarize.js`

## 需要的 GitHub Secrets

請在 GitHub Repo `Settings -> Secrets and variables -> Actions` 新增：

- `MACOS_CERT_P12_BASE64`（Developer ID Application `.p12` 的 base64）
- `MACOS_CERT_PASSWORD`（匯出 `.p12` 時設定的密碼）
- `APPLE_ID`（Apple Developer 帳號）
- `APPLE_APP_SPECIFIC_PASSWORD`（Apple ID 的 app-specific password）
- `APPLE_TEAM_ID`（Apple Developer Team ID）

## 設定順序（建議）

1. 先只設定 `MACOS_CERT_P12_BASE64` + `MACOS_CERT_PASSWORD`
- 讓 CI 先完成「簽章但不 notarize」驗證

2. 再補 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`
- 讓 CI 進一步完成 notarization

3. 用新 tag 驗證（例如 `v1.0.x`）
- 查看 log 是否出現 `[notarize] Completed`

## `MACOS_CERT_P12_BASE64` 產生方式

先從鑰匙圈匯出 `Developer ID Application` 憑證為 `.p12`，再做 base64：

```bash
base64 -i developer-id-app.p12 | pbcopy
```

把貼上的內容存成 `MACOS_CERT_P12_BASE64`。

## 觸發方式

1. 手動觸發（`workflow_dispatch`）
- 可選 `universal` / `arm64` / `x64`
- 可選是否啟用 notarization

2. 推送 tag（例如 `v1.0.1`）
- 自動建置 `universal`
- 自動上傳 Release 附件（`.dmg` + `.blockmap`）

## 常見問題

- `檔案損毀`：通常是未簽章或未 notarize 成功
- `No valid identities found`：Runner 沒有成功匯入 `.p12` 或密碼錯誤
- notarize 失敗：確認 `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` 正確
- `GitHub Personal Access Token is not set`：請確認 workflow 已更新到 `v1.0.3+` 後的 `GH_TOKEN` 修正版本
