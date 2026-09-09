import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateState,loadState,saveState,migrateLegacy,mergeStates,STORAGE_KEY,LEGACY_KEY} from '../src/storage.js';
import {schedule,cardKey,DAY} from '../src/scheduler.js';
const words=[{id:'zug',legacyKey:'bahnhof|Zug'},{id:'fahrt',legacyKey:'bahnhof|Fahrt'}],now=new Date(2026,8,9,12).getTime();
function memory(initial={}){const values={...initial};return {values,getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=v;},removeItem:k=>delete values[k]};}
test('migration retains old data, schedules high scores later, is idempotent',()=>{
  const old={right:22,wrong:7,streak:2,scores:{'bahnhof|Zug':4,'bahnhof|Fahrt':1}};
  const storage=memory({[LEGACY_KEY]:JSON.stringify(old)});const loaded=loadState(storage,words,now);
  assert.ok(loaded.migrated);assert.equal(loaded.state.cards['zug::cards-de-ua'].due,now+7*DAY);
  assert.equal(loaded.state.cards['fahrt::cards-de-ua'].due,now+DAY);assert.equal(storage.values[LEGACY_KEY],JSON.stringify(old));
  assert.deepEqual(loadState(storage,words,now+DAY).state,loaded.state);
});
test('unreadable current state is protected from overwrite and migration',()=>{
  const storage=memory({[STORAGE_KEY]:'broken',[LEGACY_KEY]:JSON.stringify({scores:{}})});
  const result=loadState(storage,words);assert.ok(result.readOnly);assert.equal(result.damaged,'broken');assert.equal(storage.values[STORAGE_KEY],'broken');
});
test('blocked browser storage does not throw',()=>{
  const blocked={getItem(){throw new Error('denied');},setItem(){throw new Error('quota');}};
  assert.ok(loadState(blocked,words).readOnly);assert.equal(saveState(blocked,emptyState()),false);
});
test('backup round trip and merging retain newest per-card schedule',()=>{
  const s=emptyState();s.cards['zug::spell']=schedule(null,'good',now);s.suspended.zug=true;s.history['2026-09-09']={reviews:3,again:1};
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);
  const incoming=emptyState();incoming.cards['zug::spell']=schedule(s.cards['zug::spell'],'easy',now+DAY);incoming.cards['fahrt::spell']=schedule(null,'good',now);incoming.history['2026-09-09']={reviews:5,again:2};
  const merged=mergeStates(s,incoming);assert.equal(merged.cards['zug::spell'].updatedAt,now+DAY);assert.equal(merged.cards['fahrt::spell'].reviews,1);assert.equal(merged.suspended.zug,true);assert.equal(merged.history['2026-09-09'].reviews,5);assert.deepEqual(mergeStates(merged,incoming),merged);
});
test('rejects foreign backups, invalid dates, invalid interval and prototype keys',()=>{
  assert.throws(()=>validateState({version:99}));
  for(const property of ['due','interval','reviews']){const s=emptyState();s.cards['zug::spell']=schedule(null,'good',now);s.cards['zug::spell'][property]=-1;assert.throws(()=>validateState(s));}
  const s=emptyState();s.cards['zug::spell']=schedule(null,'good',now);s.cards['zug::spell'].ease=999;assert.throws(()=>validateState(s));
  const malicious=JSON.parse(JSON.stringify(emptyState()).replace('"suspended":{}','"suspended":{"__proto__":true}'));assert.throws(()=>validateState(malicious));
});
test('migration preserves usable in-memory progress if saving exceeds quota',()=>{
  const storage={getItem:k=>k===LEGACY_KEY?JSON.stringify({scores:{'bahnhof|Zug':4}}):null,setItem(){throw new Error('quota');}};
  const result=loadState(storage,words,now);assert.ok(result.readOnly);assert.equal(result.state.cards['zug::cards-de-ua'].interval,7);
});
