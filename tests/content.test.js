import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateTopics,wordsIn,checkSpelling,fullDe,optionsFor} from '../src/content.js';
const manifest=JSON.parse(await readFile(new URL('../data/topics.json',import.meta.url),'utf8'));
const topics=await Promise.all(manifest.topics.map(p=>readFile(new URL(`../data/${p}`,import.meta.url),'utf8').then(JSON.parse)));
test('45 existing words and all 49 photographed entries; one canonical Stadtzentrum',()=>{
  validateTopics(topics);assert.equal(topics[0].words.length,45);assert.equal(topics[1].words.length,49);
  assert.equal(wordsIn(topics).length,93);assert.equal(wordsIn(topics).filter(w=>w.de==='Stadtzentrum').length,1);
  assert.equal(wordsIn(topics,'wohnung','verbs').length,12);assert.equal(wordsIn(topics,'wohnung','home').length,15);assert.equal(wordsIn(topics,'wohnung','search').length,22);
});
test('conflicting shared identifiers are rejected',()=>{
  const data=structuredClone(topics);data[1].words.find(w=>w.id==='stadtzentrum').uk='different';assert.throws(()=>validateTopics(data),/Конфлікт/);
});
test('spelling accepts paired names, articles, WG aliases, NFC; keeps umlauts meaningful',()=>{
  const all=wordsIn(topics),find=de=>all.find(w=>w.de===de);
  const worker=find('Mitarbeiter / Mitarbeiterin');assert.equal(fullDe(worker),'der Mitarbeiter / die Mitarbeiterin');assert.ok(checkSpelling(worker,'die Mitarbeiterin'));
  assert.ok(checkSpelling(find('WG, Wohngemeinschaft'),'die WG'));assert.ok(checkSpelling(find('Müll'),' Müll '));assert.ok(!checkSpelling(find('Müll'),'Mull'));
  assert.ok(checkSpelling(find('Wohnungsanzeige'),'die Wohnungsanzeige'));
});
test('multiple-choice options contain one correct value and no duplicate distractors',()=>{
  const all=wordsIn(topics),stock=all.find(w=>w.de==='Stock');
  for(let i=0;i<20;i++){const choices=optionsFor(stock,all,'uk');assert.equal(choices.length,4);assert.equal(new Set(choices).size,4);assert.equal(choices.filter(v=>v===stock.uk).length,1);}
});
test('reverse quiz does not mark equivalent translations as wrong distractors',()=>{
  const all=wordsIn(topics),stock=all.find(w=>w.de==='Stock');
  for(let i=0;i<20;i++)assert.ok(!optionsFor(stock,all,'de').includes('das Stockwerk'));
  assert.ok(checkSpelling(stock,'das Stockwerk'));
});
