const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.join(__dirname, '..');
const id = '56760f76438438d6820797ba777ec7b3.16';
const url = 'https://link.ingress.com/portal/' + id;
const source = fs.readFileSync(path.join(root,'backend/Code.gs'),'utf8');
function backend({existing=[],fail=false}={}) {
  const log = [['Portal ID','時間','狀態','表單回覆 ID']]; let count=0,locked=false;
  const range = (rows,start,col) => ({ getDisplayValues:()=>rows.map(r=>r.map(String)), getValues:()=>rows, setValues:values=>{ log[start-1].splice(col-1,values[0].length,...values[0]); } });
  const sheet = {getLastColumn:()=>2,getLastRow:()=>existing.length+1,getRange:(r,c)=>range(r===1?[['時間戳記','塔連結']]:existing.map(x=>[x]))};
  const ledger = {getLastRow:()=>log.length,getRange:(r,c)=>range(log.slice(r-1),r,c),appendRow:r=>log.push(r)};
  const item = {getTitle:()=> '塔連結',getId:()=>1,asTextItem:()=>item,createResponse:value=>value};
  const form = {getDestinationId:()=> '17IAcfBVCxYqCw6fdMlf9Ix_zc--XGyA5G-xVWjZwCqU',getItems:()=>[item],isAcceptingResponses:()=>true,createResponse:()=>({withItemResponse(value){assert.equal(value,url);return this;},submit(){assert.ok(locked); count++; if(fail)throw Error('uncertain');return {getId:()=> 'response-1'};}})};
  const book = {getSheetByName:n=>n==='表單回覆 1'?sheet:ledger,getFormUrl:()=> 'linked-form'};
  const context = vm.createContext({console:{error(){}},SpreadsheetApp:{openById:()=>book,flush(){}},FormApp:{openByUrl:()=>form,ItemType:{TEXT:'TEXT'}},LockService:{getScriptLock:()=>({tryLock:()=>{locked=true;return true;},releaseLock:()=>{locked=false;}})}});
  vm.runInContext(source,context);
  return {call:input=>context.register_(input),log,count:()=>count};
}
let b=backend(); assert.equal(b.call(url).status,'submitted'); assert.equal(b.call(url).status,'duplicate'); assert.equal(b.count(),1);
b=backend({existing:[url+'?utm_source=share']}); assert.equal(b.call(url.toUpperCase()).status,'duplicate'); assert.equal(b.count(),0);
b=backend({fail:true}); assert.equal(b.call(url).status,'pending'); assert.equal(b.call(url).status,'pending'); assert.equal(b.count(),1);
b=backend(); assert.equal(b.call('https://evil.test/portal/'+id).status,'error'); assert.equal(b.count(),0);
// Extract the actual frontend parser; unrelated browser setup is excluded.
const app = fs.readFileSync(path.join(root,'app.js'),'utf8');
const parser=app.slice(app.indexOf('function parsePortal'),app.indexOf('function sendPortal'));
const front=vm.createContext({});vm.runInContext(parser,front);
assert.equal(front.parsePortal('分享這座塔 '+url+'?foo=bar').id,id);
assert.throws(()=>front.parsePortal('https://link.ingress.com.evil.test/portal/'+id));
assert.throws(()=>front.parsePortal(url+'\nhttps://link.ingress.com/portal/'+'a'.repeat(32)+'.16'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest')));
assert.equal(manifest.share_target.method,'POST');assert.equal(manifest.share_target.action,'./share');
for(const icon of manifest.icons)assert.ok(fs.existsSync(path.join(root,icon.src)));
console.log('PASS: success, duplicate, uncertain submission, invalid links, shared-text parsing, multi-portal rejection, manifest and icons. No live submissions.');
