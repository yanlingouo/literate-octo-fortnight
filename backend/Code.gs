// 在指定試算表的「擴充功能 → Apps Script」貼上本檔。
const SETTINGS = {
  spreadsheetId: '17IAcfBVCxYqCw6fdMlf9Ix_zc--XGyA5G-xVWjZwCqU',
  sheetName: '表單回覆 1',
  portalHeader: '塔連結',
  ledgerName: '_Portal登記紀錄',
  // 必填：GitHub Pages 的 origin，不含專案路徑，例如 https://yourname.github.io
  allowedOrigins: ['https://yanlingouo.github.io'],,
  // 通常留空；會自動使用試算表所連結的表單。必要時填「編輯表單」的完整網址。
  formEditUrl: ''
};

function portalId_(text) {
  const match = String(text).trim().match(/^https:\/\/link\.ingress\.com\/portal\/([a-f0-9]{32}\.[a-f0-9]+)(?:[/?#].*)?$/i);
  return match ? match[1].toLowerCase() : null;
}

function getResources_() {
  const book = SpreadsheetApp.openById(SETTINGS.spreadsheetId);
  const sheet = book.getSheetByName(SETTINGS.sheetName);
  if (!sheet) throw new Error('找不到回覆工作表。');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const column = headers.indexOf(SETTINGS.portalHeader) + 1;
  if (!column) throw new Error('找不到塔連結欄位。');
  const formUrl = SETTINGS.formEditUrl || book.getFormUrl();
  if (!formUrl) throw new Error('試算表未連結 Google 表單，請設定 formEditUrl。');
  const form = FormApp.openByUrl(formUrl);
  if (form.getDestinationId() !== SETTINGS.spreadsheetId) throw new Error('表單回覆目的地與試算表不符。');
  const items = form.getItems(FormApp.ItemType.TEXT).filter(item => item.getTitle() === SETTINGS.portalHeader);
  if (items.length !== 1) throw new Error('表單必須有唯一的「塔連結」簡答欄位。');
  if (form.getItems().some(item => item.getId() !== items[0].getId() && isRequired_(item))) throw new Error('表單新增了其他必填欄位，請先更新程式。');
  return { book, sheet, column, form, item: items[0].asTextItem() };
}

function isRequired_(item) {
  const conversions = { TEXT:'asTextItem', PARAGRAPH_TEXT:'asParagraphTextItem', MULTIPLE_CHOICE:'asMultipleChoiceItem', CHECKBOX:'asCheckboxItem', LIST:'asListItem', DATE:'asDateItem', DATETIME:'asDateTimeItem', TIME:'asTimeItem', DURATION:'asDurationItem', SCALE:'asScaleItem', GRID:'asGridItem', CHECKBOX_GRID:'asCheckboxGridItem' };
  const method = conversions[String(item.getType())];
  // 未支援的新問題種類採保守處理；版面配置元素不用填答。
  if (!method) return !['IMAGE','VIDEO','PAGE_BREAK','SECTION_HEADER'].includes(String(item.getType()));
  return item[method]().isRequired();
}

// 部署前執行一次：只檢查設定，並建立專用防重複紀錄，不送出表單。
function setup() {
  if (SETTINGS.allowedOrigins.some(origin => origin.includes('YOURNAME'))) throw new Error('請先填入 allowedOrigins。');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const r = getResources_();
    let ledger = r.book.getSheetByName(SETTINGS.ledgerName);
    if (!ledger) { ledger = r.book.insertSheet(SETTINGS.ledgerName); ledger.appendRow(['Portal ID','時間','狀態','表單回覆 ID']); SpreadsheetApp.flush(); }
    console.log('設定檢查完成；尚未送出任何表單。');
  } finally { lock.releaseLock(); }
}

function register_(url) {
  const id = portalId_(url);
  if (!id) return {status:'error',message:'Portal 連結格式不正確，未送出。'};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return {status:'error',message:'目前登記人數較多，請稍後再試；本次未送出。'};
  try {
    const r = getResources_();
    const ledger = r.book.getSheetByName(SETTINGS.ledgerName);
    if (!ledger) throw new Error('請主辦方先執行 setup。');
    const rows = r.sheet.getLastRow();
    if (rows > 1 && r.sheet.getRange(2, r.column, rows - 1, 1).getDisplayValues().some(row => portalId_(row[0]) === id)) {
      return {status:'duplicate',message:'這座塔已有人登記，已阻止重複送出。'};
    }
    const logRows = ledger.getLastRow();
    const previous = logRows > 1 ? ledger.getRange(2,1,logRows-1,4).getValues().find(row => row[0] === id) : null;
    if (previous) return {status:previous[2] === 'submitted' ? 'duplicate' : 'pending',message:previous[2] === 'submitted' ? '這座塔已完成登記，已阻止重複送出。' : '這座塔有一筆尚未確認的登記，已阻止重送。請主辦方核對表單回覆。'};
    if (!r.form.isAcceptingResponses()) return {status:'error',message:'主辦方目前已關閉表單，未送出。'};
    // 在送出前永久保留 pending。就算提交後斷線或寫入失敗，也不會盲目重送。
    ledger.appendRow([id,new Date(),'pending','']);
    const row = ledger.getLastRow(); SpreadsheetApp.flush();
    try {
      const response = r.form.createResponse().withItemResponse(r.item.createResponse('https://link.ingress.com/portal/' + id)).submit();
      ledger.getRange(row,3,1,2).setValues([['submitted',response.getId()]]); SpreadsheetApp.flush();
      return {status:'submitted',message:'登記成功！這座塔已送出至 Google 表單。'};
    } catch (error) {
      console.error(String(error));
      return {status:'pending',message:'送出結果尚未確認，已保留防重複紀錄。請主辦方核對表單，勿自行重送。'};
    }
  } finally { lock.releaseLock(); }
}

function doGet() { return HtmlService.createHtmlOutput('掃塔登記服務已啟用。請從主辦方的登記站使用。'); }
function doPost(e) {
  const p = e && e.parameter || {};
  if (!SETTINGS.allowedOrigins.includes(p.origin) || !/^[a-f0-9-]{36}$/i.test(p.nonce || '')) return HtmlService.createHtmlOutput('不接受這個網站的請求。');
  let result;
  try { result = register_(p.url); }
  catch (error) { console.error(String(error)); result = {status:'error',message:'查重服務暫時無法完成，未確認成功；請主辦方檢查設定，稍後再試。'}; }
  const payload = JSON.stringify(Object.assign({type:'portal-result',nonce:p.nonce},result)).replace(/</g,'\\u003c');
  const origin = JSON.stringify(p.origin).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' + payload + ',' + origin + ');</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
