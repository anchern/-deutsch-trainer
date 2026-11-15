import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateTopics,wordsIn,fullDe,checkSpelling,optionsFor} from '../src/content.js';
import {eligible,createRun,reconcileRun,schedule,cardKey,PRIMARY_MODE,overviewCounts} from '../src/scheduler.js';
import {emptyState,validateState,mergeStates} from '../src/storage.js';
const registry=JSON.parse(await readFile(new URL('../data/topics.json',import.meta.url),'utf8'));
const topics=await Promise.all(registry.topics.map(p=>readFile(new URL(`../data/${p}`,import.meta.url),'utf8').then(JSON.parse)));
const topic=topics.find(t=>t.id==='arbeit'),words=topic.words,find=id=>words.find(w=>w.id===id);
const expected={
 berufe:['architekt-architektin','arzt-aerztin','baecker-baeckerin','buchhalter-buchhalterin','buerokaufmann-buerokauffrau','grafiker-grafikerin','hausmann-hausfrau','informatiker-informatikerin','kaufmann-kauffrau','krankenpfleger-krankenschwester','koch-koechin','lehrer-lehrerin','sekretaer-sekretaerin','chef-chefin'],
 sicherheit:['alarm','aufzug','brand','brandmelder','schutzhelm','steckdose','treppe','warnweste'],
 buero:['anmachen-geraet','einschalten','aufmachen','oeffnen','ausdrucken','ausschalten','ausmachen-geraet','herunterfahren-computer','notieren','anrufbeantworter','besprechung','protokoll','treffen-nomen','meeting','termin'],
 dativ:['antworten','gehoeren','helfen','schreiben','telefonieren-mit','zuhoeren','zuschauen']
};
test('Arbeit matches the exact 44-entry photo inventory, four sections and source scope',()=>{
 assert.equal(topic.title,'Bei der Arbeit');assert.equal(topic.uk,'На роботі');assert.equal(topic.page,76);
 assert.deepEqual(topic.sections.map(s=>s.id),Object.keys(expected));
 for(const [section,ids] of Object.entries(expected))assert.deepEqual(words.filter(w=>w.section===section).map(w=>w.id),ids);
 assert.equal(words.length,44);assert.equal(words.reduce((n,w)=>n+(w.article==='der/die'?2:1),0),58);
 assert.equal(topic.source.level,'A2.2');assert.equal(topic.source.lesson,'8 — Bei der Arbeit');assert.equal(topic.source.printedPage,76);assert.equal(topic.source.verification,'verified');
 assert.equal(topic.source.book,'Einfach gut! Deutsch für die Integration — Kurs- und Arbeitsbuch');
 assert.equal(topic.source.edition,undefined);assert.equal(topic.source.url,undefined);assert.ok(words.every(w=>!w.legacyKey));
 assert.equal(wordsIn(topics).length,197);assert.equal(topics.reduce((n,t)=>n+t.words.length,0),199);
 assert.equal(new Set(words.map(w=>w.id)).size,44);
});
test('all printed occupation forms retain correct masculine/feminine pairs and optional one-form spelling',()=>{
 const pairs=[['Architekt','Architektin'],['Arzt','Ärztin'],['Bäcker','Bäckerin'],['Buchhalter','Buchhalterin'],['Bürokaufmann','Bürokauffrau'],['Grafiker','Grafikerin'],['Hausmann','Hausfrau'],['Informatiker','Informatikerin'],['Kaufmann','Kauffrau'],['Krankenpfleger','Krankenschwester'],['Koch','Köchin'],['Lehrer','Lehrerin'],['Sekretär','Sekretärin'],['Chef','Chefin']];
 pairs.forEach(([male,female],i)=>{const w=find(expected.berufe[i]);assert.equal(w.article,'der/die');assert.equal(w.de,`${male} / ${female}`);assert.equal(fullDe(w),`der ${male} / die ${female}`);for(const spelling of [male,female,`der ${male}`,`die ${female}`])assert.ok(checkSpelling(w,spelling));assert.deepEqual(w.antonyms,[]);});
 for(const invalid of ['Kaufmannin','Bürokaufmannin','Krankenschwesterer'])assert.ok(!words.some(w=>checkSpelling(w,invalid)));
});
test('all remaining printed German forms, articles, and constructions are exact',()=>{
 const full=[
 'der Alarm','der Aufzug','der Brand','der Brandmelder','der Schutzhelm','die Steckdose','die Treppe','die Warnweste',
 'anmachen','einschalten','aufmachen','öffnen','ausdrucken','ausschalten','ausmachen','herunterfahren','notieren','der Anrufbeantworter','die Besprechung','das Protokoll','das Treffen','das Meeting','der Termin',
 'antworten','gehören','helfen','schreiben','telefonieren mit','zuhören','zuschauen'];
 assert.deepEqual(words.filter(w=>w.section!=='berufe').map(fullDe),full);
 assert.equal(eligible(words,emptyState(),'article').length,14);assert.equal(eligible(words.filter(w=>w.section==='berufe'),emptyState(),'article').length,0);assert.ok(!find('treppe').plural);
 assert.notEqual(find('termin').id,wordsIn(topics).find(w=>w.de==='Besichtigungstermin').id);
});
test('all 16 verb examples retain the intended conjugation, case and separable prefixes',()=>{
 const examples={
 'anmachen-geraet':'Ich mache den Drucker an.','einschalten':'Ich schalte den Drucker ein.','aufmachen':'Ich mache die Bürotür auf.','oeffnen':'Ich öffne die Bürotür.','ausdrucken':'Ich drucke das Protokoll aus.','ausschalten':'Ich schalte den Drucker aus.','ausmachen-geraet':'Ich mache den Drucker aus.','herunterfahren-computer':'Nach der Arbeit fährt er den Computer herunter.','notieren':'Ich notiere die Telefonnummer.',
 'antworten':'Ich antworte meiner Kollegin.','gehoeren':'Der Laptop gehört meinem Kollegen.','helfen':'Die Kollegin hilft mir.','schreiben':'Ich schreibe meinem Chef eine E-Mail.','telefonieren-mit':'Ich telefoniere mit meiner Chefin.','zuhoeren':'Ich höre meinem Kollegen zu.','zuschauen':'Ich schaue der Kollegin bei der Arbeit zu.'};
 assert.equal(words.filter(w=>w.article===null).length,16);
 for(const [id,text]of Object.entries(examples)){const w=find(id);assert.equal(w.example.de,text);assert.ok(w.example.uk.trim());assert.ok(w.note.trim());assert.ok(!w.de.includes('·'));assert.ok(!checkSpelling(w,text));}
 for(const [id,split]of [['anmachen-geraet','an·machen'],['einschalten','ein·schalten'],['aufmachen','auf·machen'],['ausdrucken','aus·drucken'],['ausschalten','aus·schalten'],['ausmachen-geraet','aus·machen'],['herunterfahren-computer','herunter·fahren'],['zuhoeren','zu·hören'],['zuschauen','zu·schauen']])assert.ok(find(id).note.includes(split));
 assert.ok(find('telefonieren-mit').note.includes('mit + Dativ'));assert.ok(find('schreiben').note.includes('Akkusativ'));assert.ok(find('gehoeren').note.includes('не відокремлюється'));
});
const officePairs=[['anmachen-geraet','einschalten'],['aufmachen','oeffnen'],['ausschalten','ausmachen-geraet'],['treffen-nomen','meeting']];
test('office aliases are explicit and reciprocal; grammar and near-looking errors stay meaningful',()=>{
 for(const [first,second]of officePairs)for(const [id,other]of [[first,second],[second,first]]){
  const a=find(id),b=find(other);assert.equal(a.uk,b.uk);assert.ok(a.synonyms.some(s=>s.de===b.de && s.note));
  for(const answer of [a.de,b.de,fullDe(a),fullDe(b)]){assert.ok(a.accepted.includes(answer));assert.ok(checkSpelling(a,answer));}
 }
 const wrong={'telefonieren-mit':['telefonieren','jemandem telefonieren'],'ausdrucken':['ausdrücken'],'herunterfahren-computer':['herunterladen','hochfahren','ausschalten','ausmachen'],'oeffnen':['offnen'],'zuhoeren':['zuhoren'],'helfen':['hilft']};
 for(const [id,answers]of Object.entries(wrong))for(const answer of answers)assert.ok(!checkSpelling(find(id),answer),`${id}: ${answer}`);
 assert.ok(checkSpelling(find('oeffnen'),' ÖFFNEN '));assert.ok(checkSpelling(find('telefonieren-mit'),'telefonieren mit'));
});
test('both quiz directions exclude each office equivalent deterministically',()=>{
 for(const [first,second]of officePairs)for(const [id,other]of [[first,second],[second,first]])for(const field of ['de','uk']){
  const target=find(id);assert.deepEqual(optionsFor(target,[target,find(other)],field,()=>0),[field==='uk'?target.uk:fullDe(target)]);
 }
 const meetings=['besprechung','treffen-nomen','meeting','termin'].map(find);
 for(const target of meetings)for(const field of ['de','uk'])assert.deepEqual(optionsFor(target,meetings,field,()=>0),[field==='uk'?target.uk:fullDe(target)]);
 const unrelated=['alarm','brand','schutzhelm'].map(find),target=find('termin');
 for(const field of ['de','uk'])assert.equal(optionsFor(target,[target,...unrelated],field,()=>0).length,4);
 assert.ok(!checkSpelling(find('termin'),'das Meeting')); // Quiz exclusion never broadens spelling.
});
test('quiz ambiguity metadata validates independently and older topics remain compatible',()=>{
 const invalid=structuredClone(topics);invalid.find(t=>t.id==='arbeit').words[0].quizGroup=['not-a-string'];assert.throws(()=>validateTopics(invalid),/група/);
 const old=topics.filter(t=>t.id!=='arbeit');assert.doesNotThrow(()=>validateTopics(old));assert.equal(wordsIn(old).length,153);
 const conflict=structuredClone(topics);conflict[1].words.find(w=>w.id==='stadtzentrum').quizGroup='different';assert.throws(()=>validateTopics(conflict),/Конфлікт/);
});
test('adding Arbeit preserves existing progress, suspended words, backups and stable old pass IDs',()=>{
 const old=topics.filter(t=>t.id!=='arbeit'),s=emptyState(),now=Date.now();
 for(const w of wordsIn(old).slice(0,8))s.cards[cardKey(w.id,PRIMARY_MODE)]=schedule(null,'good',now);
 s.suspended['altbau']=true;s.run=createRun(wordsIn(old),s,'all','all','full',now);s.run.cursor=7;
 const before=JSON.stringify(s),restored=reconcileRun(s.run,topics,s);assert.deepEqual(restored,s.run);assert.equal(JSON.stringify(s),before);assert.ok(!restored.ids.includes('alarm'));
 assert.deepEqual(validateState(s),s);assert.deepEqual(mergeStates(emptyState(),s).cards,s.cards);
 const count=overviewCounts(wordsIn(topics),s,now);assert.equal(count.processed,8);assert.equal(count.new,188);assert.equal(count.suspended,1);
 assert.equal(overviewCounts(words,s,now).processed,0);assert.equal(overviewCounts(words,s,now).new,44);
});
test('the generated offline cache includes the registered Arbeit JSON',async()=>{
 assert.ok(registry.topics.includes('topics/arbeit.json'));
 assert.ok((await readFile(new URL('../sw.js',import.meta.url),'utf8')).includes('"./data/topics/arbeit.json"'));
});
