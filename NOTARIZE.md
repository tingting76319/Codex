# macOS 簽章 / Notarization（模板）

目前專案已加入 `electron-builder` 的 notarization 模板設定：

- `build.afterSign = scripts/notarize.js`
- `build/mac.hardenedRuntime = true`
- `build/entitlements*.plist`

## 1. 安裝依賴（如尚未安裝）

```bash
npm install
```

## 2. 準備 Apple 憑證（必要）

你需要：

- Apple Developer 會員
- 有效的 `Developer ID Application` 憑證（放在 Keychain）
- Apple ID 的 App-Specific Password

## 3. 設定環境變數

```bash
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOURTEAMID"
```

## 4. 打包（建議 universal）

```bash
npm run dist:mac:universal
```

也可分架構：

```bash
npm run dist:mac:arm64
npm run dist:mac:x64
```

## 5. 驗證（在產物機器上）

```bash
spctl --assess --verbose=4 "dist/mac-arm64/魚塔防禦.app"
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/魚塔防禦.app"
```

## 注意

- 若未設定 `APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID`，`scripts/notarize.js` 會自動略過 notarization（不會中斷打包）。
- 若仍出現「檔案損毀」，通常是未簽章/未公證，或對方機器仍有 `quarantine` 標記。
