# 掃塔登記站

可直接放上 GitHub Pages 的繁體中文 PWA。Android 安裝後能接收 Ingress 分享；iPhone 可貼上連結或使用「捷徑」。分享後自動查重，未重複才由 Google Apps Script 提交 Google 表單。

## 已設定的資料來源

- 表單：https://forms.gle/xpR9ZVqGyX54SYz77
- 試算表：https://docs.google.com/spreadsheets/d/17IAcfBVCxYqCw6fdMlf9Ix_zc--XGyA5G-xVWjZwCqU/edit
- 工作表「表單回覆 1」，標題「塔連結」（目前 B 欄）。依標題定位，非固定欄號。

## 主辦方：一次性部署

需要能編輯該表單與試算表的 Google 帳號。僅有檢視權限不能部署這個後端。

1. 建立 GitHub 儲存庫，把本資料夾中的前端檔案放在儲存庫根目錄。`backend/`、`tests/` 不需要上傳到 Pages；本包不含任何帳密。
2. GitHub → Settings → Pages → Deploy from a branch → main / root，取得網站網址，例如 `https://yourname.github.io/portal-register/`。
3. 開啟指定試算表 → 擴充功能 → Apps Script。用 `backend/Code.gs` 取代編輯器預設內容。
4. 把 `allowedOrigins` 改成你的 GitHub Pages 網站來源，例如 `['https://yourname.github.io']`。不含 `/portal-register/`；有自訂網域就填該網域的來源。
5. 執行 `setup` 並用你的 Google 帳號授權。這會檢查表單與工作表，建立 `_Portal登記紀錄` 分頁，不會送出測試資料。若無法自動找到表單，在 `formEditUrl` 填入原表單的「編輯」網址；不要填 forms.gle 短網址或公開填答網址。
6. 部署 → 新增部署 → 網頁應用程式 → 執行身分「我」→ 存取權「所有人」。依畫面完成授權，複製結尾 `/exec` 的部署網址。若機構禁止匿名網頁應用程式，需要管理員允許或改用其他後端。
7. 在 `config.js` 的 `endpoint` 貼上 `/exec` 網址，將更新推到 GitHub。
8. 以 Chrome 開啟 Pages 網站，先貼上你允許登記的一座塔測試。第一次應成功，第二次應顯示重複；去表單回覆確認只有一筆。本包沒有對正式表單送出測試紀錄。
9. 後端程式變更後：管理部署 → 編輯 → 新版本 → 部署。單純儲存程式不會更新既有 `/exec`。

## 玩家：Android

Chrome 開啟網站 → 選單「安裝應用程式／新增至主畫面」（選擇安裝，不只是捷徑）。開啟安裝後的 App 一次，回到 Ingress 分享塔，選「掃塔登記」。會自動送出，無需再按按鈕。分享接收依裝置、Chrome 與實際分享內容支援情況而定；若選單未出現，重新開啟 App 並確認 service worker 正常，或先貼上連結使用。

## 玩家：iPhone

Safari 開啟網站即可貼上連結使用，也能加入主畫面。iOS 的 PWA 分享接收支援有限，不能保證它像 Android 一樣直接出現在分享選單。

可在「捷徑」建立接收 URL／文字的分享捷徑：捷徑輸入 → URL 編碼 → 文字 `你的網站完整網址?url=` 加上編碼後的變數 → 打開 URL。網站內會顯示目前網址的前綴。從 Ingress 分享給此捷徑後，網站會自動查重登記。請以實際 iPhone 測試 Ingress 傳出的內容。

## 防重複與失敗處理

- 只接受 `https://link.ingress.com/portal/<Portal ID>`，忽略 ID 大小寫與網址查詢參數；不抓取塔名或座標。
- 全部經此後端的登記使用同一把 Script Lock：讀取即時回覆表 → 查防重複紀錄 → 寫 pending → 提交真正的 Google 表單 → 標記 submitted。
- 額外紀錄可避免表單回覆尚未同步到試算表時，又被別人重送。
- 查重失敗不提交；離線不提交，也不背景排隊。逾時不假裝成功。
- `pending` 表示結果不明，會保守阻止重送。主辦方先在表單「回覆」與試算表核對此 ID；確定存在則將紀錄狀態改成 `submitted`。確定不存在後，才刪除專用紀錄分頁中該 ID 的那一列，再請玩家重試。不要刪除整個紀錄分頁。
- 防重複保證限於同一份 Apps Script 部署。使用者直接填原始 Google 表單，或使用另一份後端，仍可能繞過防重複；Google Forms 原生提交不受本程式的鎖控制。請對玩家提供登記站入口。
- 本方案沒有登入、驗證玩家身分或防機器人機制，適合可信任的社群。`allowedOrigins` 是回覆目標與基本請求檢查，並非身分驗證；公開程式中的端點不是密鑰。
- 不回傳試算表完整資料、他人資料、登記時間給玩家。後端需要讀寫試算表與表單的權限。原試算表現有共用權限不會被本程式變更。
- Apps Script 有執行時間、配額與服務限制；大量活動需另行評估後端。

## 開發檢查

不需套件安裝。Node.js 執行 `node tests/check.cjs`；語法檢查 `node --check app.js`、`node --check sw.js`。前端需以 HTTPS（或 localhost）開啟；直接點開 HTML 不支援安裝與分享。

Google 帳號部署、實際跨站回覆與 Android／iPhone 分享需要部署後實機驗收；本地模擬測試不能取代。

參考：https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target 、https://developers.google.com/apps-script/guides/web 、https://developers.google.com/apps-script/reference/lock/lock-service
