import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as content from '../src/content.js';
import * as scheduler from '../src/scheduler.js';
import * as persistence from '../src/storage.js';
import * as presentation from '../src/presentation.js';
const source=(await readFile(new URL('../src/app.js',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/init\(\);\s*$/,'');
const topic=JSON.parse(await readFile(new URL('../data/topics/amt.json',import.meta.url),'utf8'));
function app(initial=persistence.emptyState(),topics=[topic]){
 const nodes=new Map(),handlers={},events={};let stored=JSON.stringify(initial);
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',hidden:true,focus(){},addEventListener(){}});return nodes.get(id);};
 const document={getElementById:node,querySelectorAll:()=>[],addEventListener:(event,fn)=>handlers[event]=fn,hidden:false};
 const storage={getItem:()=>stored,setItem:(k,v)=>{stored=v;}};
 const window={scrollTo(){},addEventListener:(event,fn)=>events[event]=fn};
 const deps={...content,...scheduler,...persistence,...presentation,document,window,location:{hash:'#topic/amt'},setInterval(){},setTimeout(){},clearTimeout(){}};
 const api=new Function(...Object.keys(deps),source+`;return {
  setup(){allWords=wordsIn(arguments[0]);topics=arguments[0];state=arguments[1];storage=arguments[2];selectedTopic=topics[0].id;selectedSection='all';},
  startSession,rate,suspend,nextCard,renderHome,renderProgress,renderSetup,route,renderTopicRows,
  search:q=>topicQuery=q,
  reveal(){session.revealed=true;renderCard(true);},getState:()=>state,getSession:()=>session,
  setSection:s=>selectedSection=s,
 };`)(...Object.values(deps));
 api.setup(topics,structuredClone(initial),storage);
 return {...api,html:()=>node('main').innerHTML,rows:()=>node('topic-rows').innerHTML,stored:()=>JSON.parse(stored),overwrite:s=>stored=JSON.stringify(s),handlers,events};
}
test('oral card cannot leak German target, examples, definitions or TTS before reveal; reveal is not progress',()=>{
 const a=app();a.startSession('full');const w=topic.words[0];
 for(const secret of [w.de,w.definitionDe,w.example?.de].filter(Boolean))assert.ok(!a.html().includes(secret));
 assert.ok(!a.html().includes('data-action="speak"'));assert.equal(Object.keys(a.stored().cards).length,0);
 a.rate('easy');assert.equal(Object.keys(a.stored().cards).length,0);
 a.reveal();assert.ok(a.html().includes(w.de));assert.equal(Object.keys(a.stored().cards).length,0);
 a.rate('again');a.rate('easy');assert.equal(Object.keys(a.stored().cards).length,1);assert.equal(a.stored().run.cursor,1);assert.equal(a.stored().practice[scheduler.localDay(Date.now())]['cards-ua-de'].reviews,1);
});
test('full run survives reload, all 61 failed attempts, portions, and goal 5 without omissions',()=>{
 let s=persistence.emptyState();s.settings.newPerDay=5;let a=app(s);a.startSession('full');
 const seen=[];
 for(let i=0;i<61;i++){
  seen.push(a.getSession().current.id);a.reveal();a.rate('again');
  if(i===11){s=a.stored();a=app(s);a.route();assert.ok(a.html().includes('Збережене проходження: 12/61'));a.startSession();}
  else if(!a.getSession().current && i<60)a.startSession();
 }
 assert.equal(new Set(seen).size,61);assert.equal(a.stored().run.cursor,61);assert.equal(scheduler.dailyNew(a.stored()),61);assert.ok(a.html().includes('61/5'));assert.ok(a.html().includes('61/61'));assert.equal(a.stored().run.difficult.length,61);
});
test('optional article practice keeps main button primary, separate results, topic and section',()=>{
 const a=app();a.setSection('amt');a.startSession('recommended','article');a.getSession().revealed=true;a.getSession().judged=true;a.rate('easy');
 assert.equal(scheduler.overviewCounts(topic.words,a.stored()).processed,0);assert.equal(scheduler.dailyNew(a.stored()),0);
 assert.equal(a.getSession().section,'amt');assert.ok(a.stored().cards[`${topic.words[0].id}::article`]);
 a.startSession();assert.equal(a.getSession().mode,scheduler.PRIMARY_MODE);assert.equal(a.getSession().section,'amt');
});
test('newer same-card or same-run work from another tab cannot be overwritten by open card',()=>{
 for(const change of ['card','cursor']){
  const a=app();a.startSession('full');a.reveal();const incoming=a.stored(),id=topic.words[0].id;
  if(change==='card')incoming.cards[`${id}::cards-ua-de`]=scheduler.schedule(null,'easy',Date.now()+100);
  else incoming.run.cursor=1;
  a.overwrite(incoming);a.rate('again');assert.deepEqual(a.stored(),incoming);assert.equal(a.getSession(),null);
 }
});
test('reload restores section before offering saved run and never restarts its list',()=>{
 const a=app();a.setSection('verben');a.startSession('full');a.reveal();a.rate('good');
 const b=app(a.stored());b.route();assert.ok(b.html().includes('value="verben" selected'));b.startSession();assert.equal(b.getSession().section,'verben');assert.equal(b.getSession().current.id,topic.words.filter(w=>w.section==='verben')[1].id);
});
test('twenty topics stay as one compact row each; search matches both languages and empty result',()=>{
 const topics=Array.from({length:20},(_,i)=>({...topic,id:`topic-${i}`,title:`Thema ${i}`,uk:`Тема ${i}`}));
 const a=app(persistence.emptyState(),topics);a.renderHome();assert.equal((a.rows().match(/class="topic-row"/g)||[]).length,20);assert.ok(!a.rows().includes('data-action="extra"'));a.search('Thema 19');a.renderTopicRows();assert.equal((a.rows().match(/class="topic-row"/g)||[]).length,1);a.search('Тема 19');a.renderTopicRows();assert.equal((a.rows().match(/class="topic-row"/g)||[]).length,1);a.search('missing');a.renderTopicRows();assert.ok(a.rows().includes('Тему не знайдено'));
});

test('keyboard ratings cannot act before reveal, in an input/control, or on a held key',()=>{
 const a=app();a.startSession('full');
 const key=(value,tag='MAIN',repeat=false)=>a.handlers.keydown({key:value,code:value===' '?'Space':value,target:{tagName:tag},repeat,preventDefault(){}});
 key('1');assert.equal(a.stored().run.cursor,0);key(' ','INPUT');assert.equal(a.getSession().revealed,false);
 key(' ');assert.equal(a.getSession().revealed,true);key('3','MAIN',true);assert.equal(a.stored().run.cursor,0);
 key('3');assert.equal(a.stored().run.cursor,1);key('3');assert.equal(a.stored().run.cursor,1);
});

test('known difficult words remain reachable after closing summary and starting another topic/pass',()=>{
 const a=app();a.startSession('full');a.reveal();a.rate('again');const stored=a.stored();stored.run=null;
 const b=app(stored);b.renderSetup();assert.ok(b.html().includes('Складні слова · 1'));b.startSession('recommended',scheduler.PRIMARY_MODE,true);assert.equal(b.getSession().current.id,topic.words[0].id);
});

test('stale suspension cannot advance a newer cursor or change pauses from another tab',()=>{
 const a=app();a.startSession('full');const incoming=a.stored();incoming.run.cursor=1;a.overwrite(incoming);a.suspend(topic.words[0].id);assert.deepEqual(a.stored(),incoming);assert.equal(a.getSession(),null);
});
test('a backup made after difficult-word practice restores the unfinished main pass',()=>{
 const a=app();a.startSession('full');a.reveal();a.rate('again');const id=a.getSession().current.id;
 a.startSession('recommended',scheduler.PRIMARY_MODE,true);a.reveal();a.rate('good');
 const backup=a.stored(),restored=persistence.mergeStates(persistence.emptyState(),backup);assert.equal(restored.run.cursor,1);assert.equal(restored.run.ids[1],id);
});
