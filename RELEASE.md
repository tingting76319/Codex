# 發版流程（版本號 + Tag）

本文件用於搭配：

- `package.json` 版本遞增腳本
- `.github/workflows/build-macos.yml`

## 版本號遞增（本機）

不建立 git tag（先只更新 `package.json`）：

```bash
npm run version:patch
# 或
npm run version:minor
# 或
npm run version:major
```

查看目前版本：

```bash
npm run release:print-version
```

查看應建立的 tag：

```bash
npm run release:print-tag
```

## 建議發版步驟（GitHub Repo）

1. 更新版本號
```bash
npm run version:patch
```

2. 提交變更
```bash
git add package.json package-lock.json
git commit -m "release: vX.Y.Z"
```

3. 建立 tag
```bash
git tag "$(npm run -s release:print-tag)"
```

4. 推送分支與 tag
```bash
git push origin <branch>
git push origin vX.Y.Z
```

5. GitHub Actions 自動建置
- workflow 會在 tag (`v*`) 被推送後觸發
- 產出 `.dmg` 並附加到 GitHub Release（若 secrets 已設定）
- workflow 會先檢查 `tag` 是否與 `package.json.version` 一致，不一致會直接失敗（避免發錯版號）

## 手動觸發 CI（不發 tag）

到 GitHub Actions 手動執行 `Build macOS DMG`：

- `target_arch`: `universal`（建議）
- `notarize`: `true`（若 secrets 已設定）

## 注意

- 若尚未完成 Apple 簽章 / notarization 設定，雖然可以打包，但其他 macOS 仍可能顯示「檔案損毀」。
- 若要讓 Intel 與 Apple Silicon 都能安裝，建議發 `universal` 版本。
