import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, DAY, MINUTE, cardKey, counts, buildQueue, newAllowance, PRIMARY_MODE, dailyNew, overviewCounts, practiceSchedule, createRun, reconcileRun, localDay } from '../src/scheduler.js';
import { emptyState } from '../src/storage.js';
const now=new Date(2026,8,9,12).getTime(), mode='cards-de-ua';
const words=Array.from({length:60},(_,i)=>({id:`word-${i}`,article:i%2?'die':null}));
test('initial learning intervals and failed recall',()=>{
  for(const [rating,delay] of [['again',MINUTE],['hard',10*MINUTE],['good',DAY],['easy',4*DAY]])assert.equal(schedule(null,rating,now).due,now+delay);
  let c=schedule(null,'easy',now);c=schedule(c,'easy',c.due);assert.ok(c.interval>4);
  const failed=schedule(c,'again',c.due);assert.equal(failed.interval,0);assert.equal(failed.lapses,1);assert.equal(failed.due,c.due+MINUTE);
});
test('successful recalls progressively space reviews and cap at 365 days',()=>{
  let c=schedule(null,'good',now), previous=0;
  for(let i=0;i<50;i++){assert.ok(c.interval>=previous);previous=c.interval;c=schedule(c,'good',c.due);}
  assert.equal(c.interval,365);assert.ok(c.ease>=1.3);
});
test('due first; future and suspended excluded; daily goal never caps the queue',()=>{
  const s=emptyState();s.settings.newPerDay=5;
  s.cards[cardKey('word-0',mode)]=schedule(null,'easy',now-DAY);
  s.cards[cardKey('word-2',mode)]=schedule(null,'again',now-2*MINUTE);
  s.suspended['word-3']=true;
  const queue=buildQueue(words,s,mode,now);
  assert.equal(queue[0],'word-2');assert.ok(!queue.includes('word-0'));assert.ok(!queue.includes('word-3'));assert.equal(queue.length,20);
  assert.equal(newAllowance(s,mode,now),4);
  const c=counts(words,s,mode,now);assert.equal(c.due,1);assert.equal(c.suspended,1);assert.equal(c.nextDue,now+3*DAY);
});
test('daily recommendation resets at local midnight, queue stays unlimited',()=>{
  const s=emptyState();s.settings.newPerDay=5;
  words.slice(0,5).forEach(w=>{s.cards[cardKey(w.id,mode)]=schedule(null,'good',now);});
  assert.equal(newAllowance(s,mode,now),0);assert.equal(buildQueue(words,s,mode,now).length,20);
  assert.equal(newAllowance(s,mode,now+DAY),5);assert.equal(buildQueue(words,s,mode,now+DAY).length,20);
});
test('progress is shared across topics, isolated across exercise modes',()=>{
  const s=emptyState();s.cards[cardKey('word-1',mode)]=schedule(null,'easy',now);
  assert.deepEqual(buildQueue([words[1]],s,mode,now),[]);
  assert.deepEqual(buildQueue([words[1]],s,'spell',now),['word-1']);
});
test('article-only verb group produces an empty queue, plurals excluded',()=>{
  assert.deepEqual(buildQueue([{id:'gehen',article:null},{id:'costs',article:'die',plural:true}],emptyState(),'article',now),[]);
});
test('again cards become due after the actual learning delay',()=>{
  const s=emptyState();s.cards[cardKey('word-0',mode)]=schedule(null,'again',now);
  assert.deepEqual(buildQueue([words[0]],s,mode,now+MINUTE-1),[]);
  assert.deepEqual(buildQueue([words[0]],s,mode,now+MINUTE),['word-0']);
});

test('overview excludes optional reviews but preserves independent schedules',async()=>{
  const {overviewCounts}=await import('../src/scheduler.js');
  const s=emptyState();
  for(const id of ['word-1','word-3','word-5','word-7'])s.cards[cardKey(id,'article')]=schedule(null,'again',now-2*MINUTE);
  s.cards[cardKey('word-1','spell')]=schedule(null,'again',now-2*MINUTE);
  const c=overviewCounts(words,s,now);
  assert.equal(c.byMode['cards-de-ua'].due,0);assert.equal(c.byMode.article.due,4);
  assert.equal(c.due,0);assert.equal(c.dueWords,0);assert.equal(c.recommendedMode,PRIMARY_MODE);
  s.suspended['word-1']=true;assert.equal(overviewCounts(words,s,now).due,0);
});
test('mode badges respect section eligibility, mode budgets and both card directions',async()=>{
  const {modeCounts}=await import('../src/scheduler.js');
  const s=emptyState();s.settings.newPerDay=5;
  words.slice(0,5).forEach(w=>{s.cards[cardKey(w.id,'cards-de-ua')]=schedule(null,'good',now);});
  const c=modeCounts(words,s,now);
  assert.equal(c['cards-de-ua'].newToday,0);assert.equal(c['cards-ua-de'].newToday,5);
  assert.equal(c.article.new,30);assert.equal(c.article.newToday,5);
  const verbs=words.filter(w=>!w.article);assert.equal(modeCounts(verbs,s,now).article.newToday,0);
});
test('overview updates when the review becomes due and does not count future cards early',async()=>{
  const {overviewCounts}=await import('../src/scheduler.js');
  const s=emptyState();s.cards[cardKey('word-1',PRIMARY_MODE)]=schedule(null,'again',now);
  assert.equal(overviewCounts(words,s,now+MINUTE-1).due,0);
  assert.equal(overviewCounts(words,s,now+MINUTE).due,1);
  assert.equal(overviewCounts(words,s,now+MINUTE).recommendedMode,PRIMARY_MODE);
});

test('primary overview deduplicates shared IDs, covers failures and restores suspended history',()=>{
 const s=emptyState();s.cards[cardKey('word-0',PRIMARY_MODE)]=schedule(null,'again',now-2*MINUTE);
 s.cards[cardKey('word-1',PRIMARY_MODE)]={...schedule(null,'good',now-DAY),interval:21};
 s.cards[cardKey('word-2','spell')]={...schedule(null,'good',now-DAY),interval:21};
 let c=overviewCounts([...words,words[0]],s,now);
 assert.equal(c.total,60);assert.equal(c.processed,2);assert.equal(c.new,58);assert.equal(c.due,2);assert.equal(c.known,1);
 s.suspended['word-1']=true;c=overviewCounts(words,s,now);assert.equal(c.active,59);assert.equal(c.processed,1);assert.equal(c.known,0);
 delete s.suspended['word-1'];assert.equal(overviewCounts(words,s,now).processed,2);
 for(const w of words)s.suspended[w.id]=true;
 c=overviewCounts(words,s,now);assert.equal(c.active,0);assert.equal(c.processed,0);
});
test('12 primary introductions exceed goal 5; repeats and optional modes never inflate daily new',()=>{
 const s=emptyState();s.settings.newPerDay=5;
 for(const w of words.slice(0,12))s.cards[cardKey(w.id,PRIMARY_MODE)]=schedule(null,'again',now);
 s.cards[cardKey(words[0].id,PRIMARY_MODE)]=practiceSchedule(s.cards[cardKey(words[0].id,PRIMARY_MODE)],'easy',now+1);
 s.cards[cardKey('word-59','spell')]=schedule(null,'good',now);
 assert.equal(dailyNew(s,now),12);assert.equal(buildQueue(words,s,PRIMARY_MODE,now).length,20);
 const midnight=new Date(new Date(now).getFullYear(),new Date(now).getMonth(),new Date(now).getDate()+1).getTime();
 assert.equal(dailyNew(s,midnight),0);assert.notEqual(localDay(now),localDay(midnight));
});
test('successful early practice in every mode preserves due, interval and ease; failure remains recorded',()=>{
 for(const m of ['cards-ua-de','cards-de-ua','article','spell','ua-de','de-ua']){
  let c=schedule(null,'easy',now);const due=c.due,interval=c.interval,ease=c.ease;
  for(let i=1;i<=20;i++)c=practiceSchedule(c,'easy',now+i);
  assert.equal(c.due,due,m);assert.equal(c.interval,interval,m);assert.equal(c.ease,ease,m);assert.equal(c.reviews,21);assert.equal(c.earlyReviews,20);
  c=practiceSchedule(c,'again',now+30);assert.equal(c.interval,0);assert.equal(c.due,now+30+MINUTE);assert.equal(c.lapses,1);assert.equal(c.earlyReviews,21);
 }
});
test('card condition stays frozen across reveal; resumed card checks time again',()=>{
 const c=schedule(null,'good',now), opened=c.due-1;
 assert.equal(practiceSchedule(c,'easy',c.due+10,true).due,c.due);
 assert.ok(practiceSchedule(c,'easy',c.due+10).due>c.due);
 assert.equal(practiceSchedule(c,'easy',opened).interval,c.interval);
});
test('full 61-word run with goal 5 gives every ID one attempt despite failures and portions',()=>{
 const pool=[...words,{id:'last',article:null}],s=emptyState();s.settings.newPerDay=5;
 s.cards[cardKey('word-0',PRIMARY_MODE)]=schedule(null,'easy',now);
 const r=createRun([...pool,pool[0]],s,'amt','all','full',now),seen=[];
 assert.equal(r.ids.length,61);
 while(r.cursor<r.ids.length){const portion=r.ids.slice(r.cursor,r.cursor+20);assert.ok(portion.length<=20);for(const id of portion){seen.push(id);s.cards[cardKey(id,PRIMARY_MODE)]=practiceSchedule(s.cards[cardKey(id,PRIMARY_MODE)],'again',now+r.cursor);r.cursor++;}}
 assert.equal(new Set(seen).size,61);assert.equal(seen.at(-1),'last');
 assert.equal(createRun(pool,s,'amt','all','full',now).ids.length,61);
});
test('recommended stable run is due-first and cannot let repeated failures starve fresh words',()=>{
 const s=emptyState();s.cards[cardKey('word-0',PRIMARY_MODE)]=schedule(null,'again',now-2*MINUTE);
 const r=createRun(words,s,'all','all','recommended',now);assert.equal(r.ids.length,60);assert.equal(r.ids[0],'word-0');
 r.cursor=20;s.cards[cardKey('word-0',PRIMARY_MODE)]=schedule(s.cards[cardKey('word-0',PRIMARY_MODE)],'again',now);
 assert.equal(r.ids.slice(r.cursor)[0],'word-20');
});
test('restoration reconciles removed IDs, removed sections, pauses and already attempted positions',()=>{
 const s=emptyState(),r=createRun(words,s,'test','all','full',now);r.cursor=25;r.difficult=['word-1','word-2'];
 const topics=[{id:'test',sections:[{id:'one'}],words:words.slice(1)}];s.suspended['word-2']=true;s.suspended['word-40']=true;
 const restored=reconcileRun(r,topics,s);assert.equal(restored.cursor,23);assert.equal(restored.ids.length,57);assert.deepEqual(restored.difficult,['word-1']);assert.equal(restored.ids[restored.cursor],'word-25');
 assert.equal(reconcileRun({...r,topic:'missing'},topics,s),null);assert.equal(reconcileRun({...r,section:'missing'},topics,s),null);
});
