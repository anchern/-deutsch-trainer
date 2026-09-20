import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateTopics,wordsIn,checkSpelling,fullDe,optionsFor} from '../src/content.js';
const manifest=JSON.parse(await readFile(new URL('../data/topics.json',import.meta.url),'utf8'));
const topics=await Promise.all(manifest.topics.map(p=>readFile(new URL(`../data/${p}`,import.meta.url),'utf8').then(JSON.parse)));
test('45 existing words and all 49 photographed entries; one canonical Stadtzentrum',()=>{
  validateTopics(topics);assert.equal(topics[0].words.length,45);assert.equal(topics[1].words.length,49);
  assert.equal(wordsIn(topics).length,153);assert.equal(wordsIn(topics).filter(w=>w.de==='Stadtzentrum').length,1);
  assert.equal(wordsIn(topics,'wohnung','verbs').length,12);assert.equal(wordsIn(topics,'wohnung','home').length,15);assert.equal(wordsIn(topics,'wohnung','search').length,22);
});
test('Auf dem Amt covers page 92, parenthetical vocabulary and shared progress',()=>{
  const amt=topics.find(t=>t.id==='amt');assert.equal(amt.page,92);assert.equal(amt.words.length,61);
  for(const [section,count] of Object.entries({amt:7,formulare:25,verben:13,familie:12,andere:4}))assert.equal(wordsIn(topics,'amt',section).length,count);
  const find=id=>amt.words.find(w=>w.id===id);
  for(const id of ['strasse','hausnummer','postleitzahl','wohnort','geschieden','ledig','verheiratet','verwitwet','maennlich','weiblich','divers'])assert.ok(find(id));
  for(const id of ['unterlagen','grosseltern','schwiegereltern','geschwister'])assert.equal(find(id).plural,true);
  const grandmother=find('grossvater-grossmutter');assert.equal(fullDe(grandmother),'der Großvater / die Großmutter');assert.ok(checkSpelling(grandmother,'die Großmutter'));
  for(const w of wordsIn(topics,'amt','verben')){assert.ok(w.example?.de);assert.ok(w.example?.uk);}
  assert.equal(wordsIn(topics).filter(w=>w.de==='warten').length,1);
  assert.equal(find('warten').id,topics.find(t=>t.id==='transport').words.find(w=>w.de==='warten').id);
  assert.ok(amt.words.every(w=>!w.legacyKey));
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
test('every published word has a short German definition and explicit relation lists',()=>{
  for(const w of wordsIn(topics)){
    assert.ok(w.definitionDe?.trim(),w.id);assert.ok(w.definitionDe.split(/\s+/).length<=45,w.id);
    for(const variant of w.de.split(/\s*[/,]\s*/)){
      const escaped=variant.toLocaleLowerCase('de').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      assert.ok(!new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`,'u').test(w.definitionDe.toLocaleLowerCase('de')),`Definition repeats ${variant}`);
    }
    for(const field of ['synonyms','antonyms']){
      assert.ok(Array.isArray(w[field]),`${w.id}: ${field}`);
      for(const term of w[field])assert.ok(!/[\u0400-\u04FF]/.test(term.de),`Non-German term: ${w.id} / ${term.de}`);
    }
  }
});
test('invalid lexical metadata and inconsistent shared-word details are rejected',()=>{
  const malformed=structuredClone(topics);malformed[0].words[0].synonyms=['departure'];assert.throws(()=>validateTopics(malformed),/synonyms/);
  const shared=structuredClone(topics);shared[1].words.find(w=>w.id==='stadtzentrum').definitionDe='Andere Erklärung.';assert.throws(()=>validateTopics(shared),/Конфлікт/);
  const optional=structuredClone(topics);for(const t of optional)for(const w of t.words){delete w.definitionDe;delete w.synonyms;delete w.antonyms;}assert.doesNotThrow(()=>validateTopics(optional));
});
