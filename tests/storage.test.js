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

test('v2 profiles migrate additively with exact source backup and unchanged independent cards',()=>{
 for(const modes of [['cards-ua-de'],['cards-de-ua'],['cards-ua-de','article','spell','de-ua','ua-de']]){
  const old={version:2,cards:{},suspended:{zug:true},settings:{newPerDay:5},history:{'2026-09-09':{reviews:30,again:4}},legacyStats:null};
  for(const mode of modes)old.cards[cardKey('zug',mode)]=schedule(null,'good',now);
  const raw=JSON.stringify(old),storage=memory({[STORAGE_KEY]:raw}),loaded=loadState(storage,words,now);
  assert.equal(loaded.state.version,3);assert.deepEqual(loaded.state.cards,old.cards);assert.deepEqual(loaded.state.history,old.history);assert.deepEqual(loaded.state.practice,{});assert.equal(loaded.state.settings.newPerDay,5);
  assert.equal(storage.values[`${STORAGE_KEY}:before-v3`],raw);assert.deepEqual(loadState(storage,words).state,loaded.state);
 }
});
test('v2 migration quota failure preserves usable state and never replaces original',()=>{
 const old={...emptyState(),version:2};old.cards['zug::cards-ua-de']=schedule(null,'easy',now);const raw=JSON.stringify(old);
 const storage={getItem:k=>k===STORAGE_KEY?raw:null,setItem(){throw Error('quota');}};
 const result=loadState(storage,words);assert.equal(result.readOnly,true);assert.equal(result.state.cards['zug::cards-ua-de'].interval,4);assert.equal(storage.getItem(STORAGE_KEY),raw);
});
test('v3 backup retains early attempts, mode-specific history, cursor, preferences and difficult IDs',()=>{
 const s=emptyState();s.settings={newPerDay:5,lastTopic:'wohnung',lastSection:'verbs',recallExplained:true};
 s.cards['zug::cards-ua-de']={...schedule(null,'good',now),earlyReviews:0};
 s.practice['2026-09-09']={'cards-ua-de':{reviews:12,again:3,early:2},article:{reviews:8,again:1,early:0}};
 s.run={id:'run-1',topic:'wohnung',section:'verbs',kind:'full',ids:['zug','fahrt'],cursor:1,difficult:['zug'],updatedAt:now};
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);
 const imported=mergeStates(emptyState(),s);assert.deepEqual(mergeStates(imported,s),imported);assert.equal(imported.practice['2026-09-09']['cards-ua-de'].reviews,12);assert.equal(imported.run.cursor,1);
});
test('import keeps newer run and rejects cursor saved before newer primary work',()=>{
 const s=emptyState(),old=emptyState();
 const run={id:'run-1',topic:'wohnung',section:'all',kind:'full',ids:['zug','fahrt'],cursor:1,difficult:[],updatedAt:now};
 s.run={...run,cursor:2,updatedAt:now+100};old.run=run;
 assert.equal(mergeStates(s,old).run.cursor,2);
 s.run=null;s.cards['zug::cards-ua-de']=schedule(null,'good',now+100);
 assert.equal(mergeStates(s,old).run,null);
});
test('invalid run/history/early metadata is rejected before any overwrite',()=>{
 const s=emptyState();s.run={id:'run-1',topic:'wohnung',section:'all',kind:'full',ids:['zug','zug'],cursor:0,difficult:[],updatedAt:now};assert.throws(()=>validateState(s));
 s.run=null;s.practice={'bad-date':{}};assert.throws(()=>validateState(s));
 s.practice={'2026-09-09':{'spell':{reviews:1,again:2,early:0}}};assert.throws(()=>validateState(s));
 s.practice={};s.cards['zug::spell']={...schedule(null,'good',now),earlyReviews:2};assert.throws(()=>validateState(s));
});
