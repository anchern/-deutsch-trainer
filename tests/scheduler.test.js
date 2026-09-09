import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, DAY, MINUTE, cardKey, counts, buildQueue, newAllowance } from '../src/scheduler.js';
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
test('due first; future and suspended cards excluded; new daily limit across topics',()=>{
  const s=emptyState();s.settings.newPerDay=5;
  s.cards[cardKey('word-0',mode)]=schedule(null,'easy',now-DAY);
  s.cards[cardKey('word-2',mode)]=schedule(null,'again',now-2*MINUTE);
  s.suspended['word-3']=true;
  const queue=buildQueue(words,s,mode,now);
  assert.equal(queue[0],'word-2');assert.ok(!queue.includes('word-0'));assert.ok(!queue.includes('word-3'));assert.equal(queue.length,5);
  assert.equal(newAllowance(s,mode,now),4);
  const c=counts(words,s,mode,now);assert.equal(c.due,1);assert.equal(c.suspended,1);assert.equal(c.nextDue,now+3*DAY);
});
test('daily limit resets at local midnight, reviews remain available',()=>{
  const s=emptyState();s.settings.newPerDay=5;
  words.slice(0,5).forEach(w=>{s.cards[cardKey(w.id,mode)]=schedule(null,'good',now);});
  assert.equal(newAllowance(s,mode,now),0);assert.equal(buildQueue(words,s,mode,now).length,0);
  assert.equal(newAllowance(s,mode,now+DAY),5);assert.equal(buildQueue(words,s,mode,now+DAY).length,10);
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
