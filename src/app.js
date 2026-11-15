import { loadTopics, wordsIn, fullDe, checkSpelling, optionsFor } from './content.js';
import { DAY, MINUTE, PRIMARY_MODE, dailyNew, practiceSchedule, createRun, reconcileRun, eligible, MODES, cardKey, localDay, counts, buildQueue, modeCounts, overviewCounts } from './scheduler.js';
import { STORAGE_KEY, LEGACY_KEY, emptyState, loadState, saveState, validateState, mergeStates } from './storage.js';
import { learningDetails } from './presentation.js';
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = { home:'M3 10 12 3l9 7v11H3Z M9 21v-8h6v8', train:'M6 17h12V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2Z M6 10h12 M8 21l2-4m6 4-2-4 M9 14h.01M15 14h.01', cards:'M5 7h14v14H5Z M8 3h11a3 3 0 0 1 3 3v11 M9 12h6m-6 4h4', arrow:'M4 12h16m-6-6 6 6-6 6', back:'M20 12H4m6-6-6 6 6 6', check:'M5 12l4 4L19 6', sound:'M4 9h4l5-4v14l-5-4H4Z M17 8a6 6 0 0 1 0 8 M20 5a10 10 0 0 1 0 14', shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z M8 12l3 3 5-6', book:'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3Z M12 6v15' };
const icon = name => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.cards}"/></svg>`;
const german = w => ['der','die','das'].includes(w.article) ? `<span class="article ${w.article}">${w.article}</span><span lang="de">${esc(w.de)}</span>` : `<span lang="de">${esc(fullDe(w))}</span>`;
const modeNames = {'cards-de-ua':'Картки · DE → UA','cards-ua-de':'Картки · UA → DE','de-ua':'Переклад · DE → UA','ua-de':'Переклад · UA → DE',article:'Артиклі',spell:'Написання'};
let topics, allWords, state, storage, damaged, readOnly = false, session = null;
let selectedTopic = 'all', selectedSection = 'all', selectedMode = PRIMARY_MODE;
let dictionaryTopic = 'all', dictionaryFilter = 'all', query = '', toastTimer;
let topicQuery = '', renderedCountSignature = '';
const migrationNote = () => Object.keys(state.cards).some(k => !k.endsWith(`::${PRIMARY_MODE}`)) && !Object.keys(state.cards).some(k => k.endsWith(`::${PRIMARY_MODE}`)) ? '<p class="migration-note">Основний прогрес тепер — пригадування німецькою. Попередні результати збережені в додаткових вправах.</p>' : '';
const dailyLabel = () => `${dailyNew(state) >= state.settings.newPerDay ? 'Денну ціль виконано: ' : 'Сьогодні: '}${dailyNew(state)}/${state.settings.newPerDay} нових`;
const difficultIds = (pool, mode = PRIMARY_MODE) => pool.filter(w=>!state.suspended[w.id] && ['again','hard'].includes(state.cards[cardKey(w.id,mode)]?.lastRating)).map(w=>w.id);
const metricLine = c => `Опрацьовано <b>${c.processed}/${c.active}</b> · нові ${c.new} · до повторення ${c.due}${c.suspended ? ` · призупинено ${c.suspended}` : ''}`;
function savedRun() { state.run = reconcileRun(state.run,topics,state); return state.run && state.run.cursor < state.run.ids.length ? state.run : null; }

const countSignature = () => JSON.stringify([localDay(Date.now()),modeCounts(allWords,state)]);
const nowCounts = (words, mode = PRIMARY_MODE) => counts(words, state, mode);
const formatDate = value => new Intl.DateTimeFormat('uk', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(value);
function intervalText(delay) {
  if (delay < DAY) return `${Math.max(1, Math.round(delay / MINUTE))} хв`;
  return `${Math.round(delay / DAY)} дн`;
}
function notice(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500); }
function warn(text) { $('warning').textContent = text; $('warning').hidden = !text; }
function persist() {
  if (readOnly) return;
  if (!saveState(storage, state)) { readOnly = true; warn('Не вдалося зберегти прогрес у браузері. Завантажте резервну копію у вкладці «Прогрес».'); }
}
function syncLatest() {
  if (readOnly) return;
  try { const raw = storage.getItem(STORAGE_KEY); if (raw) state = validateState(JSON.parse(raw)); }
  catch { readOnly = true; warn('Не вдалося прочитати сховище. Поточний прогрес можна завантажити у вкладці «Прогрес».'); }
}
function main(html, focus = false) { if (state && allWords) renderedCountSignature = countSignature(); $('main').innerHTML = html; if (focus) $('main').focus({preventScroll:true}); }
function navigate(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function topicTitle(id) { return id === 'all' ? 'Усі теми' : topics.find(t => t.id === id)?.uk || 'Усі теми'; }
function renderHome() {
  const c = overviewCounts(allWords,state), run = savedRun();
  const last = run?.topic || state.settings.lastTopic;
  main(`<section class="today-bar"><div><span class="eyebrow">Усне пригадування · UA → DE</span><h1>${last ? 'Сьогодні' : 'Обери тему'}</h1><p>${dailyLabel()} <span class="separator">·</span> ${c.due} до повторення</p></div>${last ? `<button class="button primary" data-action="resume-home">Продовжити ${icon('arrow')}</button>` : '<span class="today-hint">Пригадай → відкрий → оціни</span>'}</section>
  <section aria-labelledby="topics-heading"><div class="section-heading"><div><h2 id="topics-heading">Теми <span class="small muted">${topics.length}</span></h2><p class="small muted">${c.processed}/${c.active} опрацьовано · самооцінка</p></div><label class="topic-search"><span class="sr-only">Знайти тему</span><input class="input" id="topic-search" type="search" placeholder="Знайти тему…" value="${esc(topicQuery)}"></label></div><div id="topic-rows" class="topics"></div></section>${migrationNote()}`);
  renderTopicRows();
  $('topic-search').addEventListener('input',e => {topicQuery=e.target.value;renderTopicRows();});
}
function renderTopicRows() {
  const found = topics.filter(t => `${t.title} ${t.uk}`.toLocaleLowerCase('uk').includes(topicQuery.trim().toLocaleLowerCase('uk')));
  $('topic-rows').innerHTML = found.length ? found.map((t,i) => {
    const c = overviewCounts(wordsIn(topics,t.id),state);
    return `<article class="topic-row"><div class="topic-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</div><div class="topic-info"><h3><a href="#topic/${t.id}" lang="de">${esc(t.title)}</a></h3><p class="topic-uk">${esc(t.uk)}</p><p class="small muted">${t.words.length} слів · опрацьовано ${c.processed}/${c.active} · повторити ${c.due}</p><div class="meter" role="img" aria-label="Опрацьовано ${c.processed} із ${c.active}"><span style="width:${c.active ? c.processed/c.active*100 : 0}%"></span></div></div><button class="button outline" data-action="learn-topic" data-topic="${t.id}" aria-label="Вчити: ${esc(t.uk)}">Вчити ${icon('arrow')}</button></article>`;
  }).join('') : '<div class="panel empty-state"><h3>Тему не знайдено</h3><p>Спробуй німецьку або українську назву.</p></div>';
}
function renderSetup() {
  const topic = topics.find(t=>t.id===selectedTopic), pool = wordsIn(topics,selectedTopic,selectedSection), c=overviewCounts(pool,state), run=savedRun();
  const difficult=difficultIds(pool);
  const sameRun = run?.topic===selectedTopic && run?.section===selectedSection;
  const hasWork = buildQueue(pool,state,PRIMARY_MODE).length;
  const source = topic?.source || {};
  main(`<a class="back" href="#learn">${icon('back')} Усі теми</a><div class="topic-layout"><section class="topic-main"><div class="eyebrow">${topic ? esc(topic.title) : 'Deutsch Trainer'}</div><h1>${esc(topicTitle(selectedTopic))}</h1><p class="muted">${esc(topic?.description || 'Слова з усіх тем без повторних ID')}</p><div class="coverage"><div>${metricLine(c)}</div><div class="meter" role="img" aria-label="Опрацьовано ${c.processed} із ${c.active}"><span style="width:${c.active ? c.processed/c.active*100 : 0}%"></span></div><p class="small muted">На довгому повторенні: ${c.known} · основний інтервал від 21 дня</p></div>
  ${topic ? `<label class="field-label" for="section-select">Частина теми</label><select class="input" id="section-select">${[{id:'all',uk:'Уся тема'},...topic.sections].map(v=>`<option value="${v.id}" ${v.id===selectedSection?'selected':''}>${esc(v.uk)}</option>`).join('')}</select>` : ''}
  <div class="topic-actions"><button class="button primary" data-action="start-primary" ${c.active?'':'disabled'}>${sameRun ? 'Продовжити' : hasWork ? c.due ? 'Повторити' : 'Вчити' : 'Потренувати тему'} ${icon('arrow')}</button><button class="button outline" data-action="full" ${c.active?'':'disabled'}>Пройти всю тему</button><button class="button quiet" data-action="dictionary" data-topic="${selectedTopic}">Словник ${icon('book')}</button></div>
  <p class="small muted">${c.active ? sameRun ? `Збережене проходження: ${run.cursor}/${run.ids.length}.` : 'До 20 різних слів у порції. Денна ціль не обмежує продовження.' : 'Усі слова призупинено. Поверни їх у словнику.'}</p>
  <div class="recall-guide"><span class="step-number">UA → DE</span><div><h2>Пригадай німецькою вголос</h2><p>Відкрий відповідь та оціни свою спробу. Іменник — разом з артиклем.</p><p class="small muted">Самооцінка пригадування; без перевірки вимови чи рівня B1.</p></div></div>${migrationNote()}
  ${difficult.length ? `<details class="details-help"><summary>Складні слова · ${difficult.length}</summary><p>${difficult.map(id=>esc(fullDe(allWords.find(w=>w.id===id)))).join(' · ')}</p><button class="button outline" data-action="retry">Повторити складні</button></details>` : ''}
  <details class="details-help extra-practice"><summary>Додаткова практика <span class="small muted">· за бажанням</span></summary><p>Окремі результати. Не змінюють основний прогрес і денну ціль.</p><div class="extra-grid">${MODES.filter(m=>m!==PRIMARY_MODE).map(m=>{const n=modeCounts(pool,state)[m];return `<button class="choice" data-action="extra" data-mode="${m}"><b>${esc(modeNames[m])}</b><small>${n.learning+n.known} опрацьовано · ${n.due} до повторення</small></button>`;}).join('')}</div></details>
  <details class="details-help"><summary>Джерело теми · ${source.verification==='verified' ? 'звірено' : 'видання не підтверджене'}</summary><dl class="source-list">${[['Книжка / серія',source.book],['Рівень',source.level],['Видання',source.edition],['Урок',source.lesson],['Друкована сторінка',source.printedPage ?? topic?.page]].map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v ?? 'Невідомо')}</dd></div>`).join('')}</dl>${source.url ? `<a class="button outline" href="${esc(source.url)}" target="_blank" rel="noopener">Відкрити джерело</a>` : ''}<p class="small muted">Номер сторінки сам по собі не підтверджує видання або відповідність поточній домашній роботі.</p></details></section><aside class="topic-aside"><span class="eyebrow">Сьогодні</span><strong>${dailyNew(state)}<span> / ${state.settings.newPerDay}</span></strong><p>нових слів</p><p class="small muted">${dailyNew(state)>=state.settings.newPerDay?'Ціль виконано. Можна вчитися далі.':'М’яка ціль, без денного обмеження.'}</p></aside></div>`);
  $('section-select')?.addEventListener('change',e=>{selectedSection=e.target.value;renderSetup();});
}

function startSession(kind = 'recommended', mode = PRIMARY_MODE, retry = false) {
  syncLatest(); selectedMode = mode;
  const pool = wordsIn(topics,selectedTopic,selectedSection);
  let run = savedRun(), queue;
  const persistent = mode === PRIMARY_MODE && !retry;
  if (persistent) {
    if (kind==='full' || run?.topic!==selectedTopic || run?.section!==selectedSection) {
      run = createRun(pool,state,selectedTopic,selectedSection,kind);
      if (!run.ids.length && kind==='recommended') run=createRun(pool,state,selectedTopic,selectedSection,'full');
      state.run=run;
    }
    queue=run.ids.slice(run.cursor,run.cursor+20);
    state.settings.lastTopic=selectedTopic; state.settings.lastSection=selectedSection;
  } else if (retry) queue=(session?.answers?.filter(a=>['again','hard'].includes(a.rating)).map(a=>a.id) || difficultIds(pool,mode)).filter(id=>pool.some(w=>w.id===id) && !state.suspended[id]).slice(0,20);
  else { queue=buildQueue(pool,state,mode); if(!queue.length) queue=eligible(pool,state,mode).slice(0,20).map(w=>w.id); }
  if (!queue.length) {renderSetup();notice(mode==='article' ? 'У цій частині немає іменників для вправи на артиклі. Обери іншу частину.' : 'Немає активних слів для цієї вправи.');return;}
  persist(); window.scrollTo(0,0);
  session={topic:selectedTopic,section:selectedSection,mode,queue,total:queue.length,completed:0,current:null,revealed:false,judged:null,persistent,runId: persistent?run.id:null,answers:[],retry};
  nextCard();
}
function nextCard() {
  if(!session)return;
  let id;
  do { id=session.queue.shift(); } while(id && (state.suspended[id] || !allWords.some(w=>w.id===id)));
  session.current=allWords.find(w=>w.id===id);
  session.revealed=false;session.judged=null;session.chosen=null;
  if(!session.current){renderComplete();return;}
  session.runCursor=state.run?.cursor;
  session.openedAt=Date.now();
  session.previous=state.cards[cardKey(id,session.mode)];
  session.early=!!session.previous && session.previous.due>session.openedAt;
  session.options=session.mode==='article'?['der','die','das']:optionsFor(session.current,allWords,session.mode==='de-ua'?'uk':'de');
  renderCard(true);
}

function renderCard(focus = false) {
  const s = session, w = s.current, flash = s.mode.startsWith('cards');
  const forward = ['cards-de-ua','de-ua','article'].includes(s.mode);
  const topic = topics.find(t => (s.topic === 'all' || t.id === s.topic) && t.words.some(v => v.id === w.id));
  const section = topic?.sections.find(v => v.id === topic.words.find(v => v.id === w.id)?.section);
  const prompt = s.mode === 'article' ? `<span lang="de">${esc(w.de)}</span>` : forward ? german(w) : esc(w.uk);
  const correct = s.mode === 'article' ? w.article : s.mode === 'de-ua' ? w.uk : fullDe(w);
  const feedback = s.judged !== null ? `<div class="feedback ${s.judged ? 'ok' : 'bad'}" role="status">${s.judged ? 'Правильно!' : `Правильна відповідь: ${esc(correct)}`}</div>` : '';
  const answerInfo = s.revealed ? `${w.note ? `<p class="note">${esc(w.note)}</p>` : ''}${w.example ? `<div class="example"><p lang="de">${esc(w.example.de)}</p><span>${esc(w.example.uk)}</span></div>` : ''}` : '';
  const now = Date.now(), previous = s.previous;
  const ratingButtons = `<div class="rating-grid" aria-label="Оцініть відповідь">${[['again','Не згадав'],['hard','Згадав важко'],['good','Згадав'],['easy','Згадав легко']].map(([r,label],i) => `<button class="rating ${r}" data-action="rate" data-rating="${r}" ${s.judged === false && r !== 'again' ? 'disabled' : ''} aria-label="${label}, через ${intervalText(Math.max(0,practiceSchedule(previous,r,now,s.early).due-now))}"><b>${label}</b><span>${s.early && r!=='again' ? 'без перенесення · ' : ''}${intervalText(Math.max(0,practiceSchedule(previous,r,now,s.early).due-now))}</span></button>`).join('')}</div>`;
  main(`<div class="study-wrap"><div class="study-top"><button class="button quiet back" data-action="end">${icon('back')} Завершити</button><span class="small muted">${s.completed+1} / ${s.total} у порції · ${s.mode===PRIMARY_MODE ? 'Усне пригадування' : esc(modeNames[s.mode])}</span></div><div class="meter" role="img" aria-label="Опрацьовано ${s.completed} з ${s.total}"><span style="width:${s.total ? s.completed/s.total*100 : 0}%"></span></div>${s.persistent ? `<p class="run-position small muted">Проходження: ${state.run.cursor}/${state.run.ids.length} активних слів</p>` : ''}<section class="study-card" aria-label="Навчальна картка"><div class="card-top"><span>${esc(section?.uk || topicTitle(s.topic))}</span><span class="badge">${s.early ? 'Додаткове повторення' : previous ? 'Повторення' : 'Нове слово'}</span></div>${s.mode===PRIMARY_MODE ? `<p class="recall-instruction">${w.article==='der/die' ? 'Пригадай обидві форми німецькою вголос — разом з артиклями.' : 'Пригадай німецькою вголос. Іменник — разом з артиклем.'}</p>` : ''}<div class="word-area"><div class="word">${prompt}</div>${flash && s.revealed ? `<hr class="answer-rule"><div class="translation">${forward ? esc(w.uk) : german(w)}</div>` : ''}</div>${flash ? s.revealed ? ratingButtons : '<button class="button primary reveal" data-action="reveal">Показати відповідь <span class="small keyboard-help">· пробіл</span></button>' : s.mode === 'spell' ? `${s.revealed ? feedback + ratingButtons : `<form id="spell-form"><label class="spell-label" for="spell-input">Німецьке слово (можна з артиклем)</label><input class="input" id="spell-input" lang="de" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ваша відповідь…"><div class="spell-actions"><button class="button primary" type="submit">Перевірити</button><button class="button quiet" type="button" data-action="give-up">Не пам’ятаю</button></div></form>`}` : `<div class="choices">${s.options.map((o,i) => `<button class="answer ${s.revealed && o === correct ? 'correct' : s.revealed && s.chosen === o ? 'wrong' : ''}" data-action="answer" data-index="${i}" ${s.revealed ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>${feedback}${s.revealed ? ratingButtons : ''}`}${s.revealed ? `${answerInfo}<details class="card-details"><summary>Докладніше</summary>${learningDetails(w)}</details>` : ''}</section><div class="study-footer"><div>${forward && s.mode !== 'article' || s.revealed ? `<button class="button quiet" data-action="speak" data-id="${w.id}">${icon('sound')} Вимова</button>` : '<span class="small">Спробуйте згадати без підказки</span>'}</div><button class="button quiet" data-action="suspend" data-id="${w.id}">Не повторювати</button></div>${s.mode===PRIMARY_MODE && !state.settings.recallExplained ? '<details class="recall-explanation" open><summary>Як оцінити пригадування</summary><p>Оцінюй спробу до відкриття відповіді. Якщо лише впізнав відповідь після відкриття — обери «Не згадав».</p></details>' : ''}${s.revealed ? '<p class="small muted keyboard-help" style="text-align:center;margin-top:10px">1 — не згадав · 2 — важко · 3 — згадав · 4 — легко</p>' : ''}</div>`,focus);
  if (s.mode === 'spell' && !s.revealed) { $('spell-form').addEventListener('submit', e => {e.preventDefault(); judgeSpelling(false);}); $('spell-input').focus({preventScroll:true}); }
}
function judgeSpelling(giveUp) {
  if (!session?.current || session.revealed) return;
  const input = $('spell-input')?.value || '';
  if (!giveUp && !input.trim()) { $('spell-input').focus(); return; }
  session.judged = !giveUp && checkSpelling(session.current,input); session.revealed = true; renderCard(true);
}
function rate(rating) {
  if(!session?.current || !session.revealed || session.rating || !['again','hard','good','easy'].includes(rating) || session.judged===false && rating!=='again')return;
  const s=session; s.rating=true;
  const key=cardKey(s.current.id,s.mode), expected=s.previous;
  syncLatest();
  if(JSON.stringify(state.cards[key])!==JSON.stringify(expected) || s.persistent && (state.run?.id!==s.runId || state.run.cursor!==s.runCursor)) {session=null;renderSetup();notice('Дані змінилися в іншій вкладці. Продовж навчання зі збереженої позиції.');return;}
  const now=Date.now();state.cards[key]=practiceSchedule(expected,rating,now,s.early);
  const day=localDay(now);state.practice[day] ||= {};state.practice[day][s.mode] ||= {reviews:0,again:0,early:0};
  const h=state.practice[day][s.mode];h.reviews++;if(rating==='again')h.again++;if(s.early)h.early++;
  if(s.persistent){const r=state.run;r.cursor++;r.updatedAt=now;if(['again','hard'].includes(rating) && !r.difficult.includes(s.current.id))r.difficult.push(s.current.id);}
  if(s.mode===PRIMARY_MODE){state.settings.recallExplained=true;if(state.run)state.run.updatedAt=now;}
  persist();s.answers.push({id:s.current.id,rating});s.completed++;s.rating=false;nextCard();
}
function renderComplete() {
  const s=session, c=overviewCounts(wordsIn(topics,s.topic,s.section),state), r=s.persistent ? state.run : null;
  const difficult=s.answers.filter(a=>['again','hard'].includes(a.rating));
  const recalled=s.answers.length-s.answers.filter(a=>a.rating==='again').length;
  const finished=r && r.cursor>=r.ids.length;
  main(`<div class="study-wrap"><section class="panel completion"><span class="eyebrow">${finished ? 'Проходження завершено' : 'Порцію завершено'}</span><h1>${r ? `Опрацьовано ${r.cursor}/${r.ids.length} активних слів` : `${s.completed} слів опрацьовано`}</h1><p>${recalled} із ${s.completed} пригадано за самооцінкою${s.mode===PRIMARY_MODE?'':` · ${esc(modeNames[s.mode])}`}.</p><p class="muted">${metricLine(c)}</p><p class="daily-result">${dailyLabel()}</p><p class="small muted">${readOnly ? 'Прогрес лише в пам’яті. Завантаж копію перед закриттям.' : 'Оцінки й позицію збережено у браузері.'} Це охоплення матеріалу, а не підтвердження довгострокового знання.</p><div class="button-row"><button class="button primary" data-action="continue">${finished ? 'Продовжити практику' : 'Продовжити'} ${icon('arrow')}</button><button class="button outline" data-action="back-topic">До теми</button></div>${difficult.length ? `<div class="difficult-list"><h2>Потребують повторення · ${difficult.length}</h2><ul>${difficult.map(a=>{const w=allWords.find(w=>w.id===a.id);return `<li><span lang="de">${esc(fullDe(w))}</span><span>${esc(w.uk)} · ${a.rating==='again'?'не згадав':'важко'}</span></li>`;}).join('')}</ul><button class="button outline" data-action="retry">Повторити складні</button></div>` : ''}${difficultIds(wordsIn(topics,s.topic,s.section),s.mode).length ? '<p class="small muted">Складні слова залишаються в розкладі. Основні складні слова доступні також на сторінці теми.</p>' : ''}</section></div>`,true);
}

function wordStatus(w) {
  if (state.suspended[w.id]) return 'Призупинено в усіх вправах';
  const overview = overviewCounts([w],state);
  if (overview.due) return 'До повторення · усне пригадування';
  return overview.nextDue ? `Повторення: ${formatDate(overview.nextDue)}` : 'Нове слово';
}
function renderDictionary() {
  main(`<div class="intro"><div><h1>Ваш словник</h1><p class="muted">Усі слова під рукою. Слухайте, пригадуйте, знаходьте потрібне.</p></div></div><div class="dictionary-controls"><label for="word-search" class="small muted">Пошук німецькою або українською</label><input class="input" id="word-search" type="search" placeholder="Наприклад, Wohnung або квартира" value="${esc(query)}"><div class="pills" aria-label="Тема словника">${[{id:'all',uk:'Усі теми'},...topics].map(t => `<button class="pill" data-action="dict-topic" data-topic="${t.id}" aria-pressed="${dictionaryTopic === t.id}">${esc(t.uk)}</button>`).join('')}</div><div class="pills" aria-label="Стан слів">${[['all','Усі слова'],['due','До повторення'],['paused','Призупинені']].map(([id,label])=>`<button class="pill" data-action="dict-filter" data-filter="${id}" aria-pressed="${dictionaryFilter === id}">${label}</button>`).join('')}</div></div><div class="section-heading"><span id="dictionary-count" class="small"></span><span class="small">Основний шлях · UA → DE</span></div><p id="dictionary-summary" class="small muted dictionary-summary"></p><div id="dictionary-rows"></div>`);
  $('word-search').addEventListener('input',e => {query=e.target.value;renderDictionaryRows();});renderDictionaryRows();
}
function renderDictionaryRows() {
  const search = query.trim().toLocaleLowerCase('uk');
  const words = wordsIn(topics,dictionaryTopic).filter(w => `${fullDe(w)} ${w.uk}`.toLocaleLowerCase('uk').includes(search)).filter(w => dictionaryFilter === 'all' || (dictionaryFilter === 'paused' ? state.suspended[w.id] : overviewCounts([w],state).due > 0));
  $('dictionary-count').textContent = `Знайдено: ${words.length}`;
  $('dictionary-summary').innerHTML=metricLine(overviewCounts(words,state));
  $('dictionary-rows').innerHTML = words.length ? `<div class="word-list">${words.map(w => `<article class="word-row"><div><div class="german">${german(w)}</div><div class="word-status">${esc(wordStatus(w))}</div></div><div class="translation-cell">${esc(w.uk)}${w.definitionDe || w.note || w.example ? `<details><summary>Пояснення, синоніми й антоніми</summary>${learningDetails(w)}${w.note ? `<p>${esc(w.note)}</p>` : ''}${w.example ? `<p lang="de">${esc(w.example.de)}</p><p>${esc(w.example.uk)}</p>` : ''}</details>` : ''}</div><div class="row-actions"><button class="button quiet" data-action="speak" data-id="${w.id}" aria-label="Послухати ${esc(w.de)}">${icon('sound')}</button><button class="button outline" data-action="suspend" data-id="${w.id}">${state.suspended[w.id] ? 'Повернути' : 'Не повторювати'}</button></div></article>`).join('')}</div>` : '<div class="panel empty-state"><h2>Нічого не знайдено</h2><p>Спробуйте інше слово або змініть фільтр.</p></div>';
}
function renderProgress() {
  const c=overviewCounts(allWords,state), today=state.practice[localDay(Date.now())]?.[PRIMARY_MODE] || {reviews:0,early:0};
  const reviews=Object.entries(state.cards).filter(([k])=>k.endsWith(`::${PRIMARY_MODE}`)).reduce((n,[,v])=>n+v.reviews,0);
  const old=Object.values(state.history).reduce((n,h)=>n+h.reviews,0);
  main(`<div class="intro"><div><div class="eyebrow">Усне пригадування · самооцінка</div><h1>Прогрес</h1><p class="muted">${metricLine(c)}</p></div><span class="badge">${readOnly?'Лише в пам’яті':'Зберігається локально'}</span></div>${migrationNote()}<div class="progress-grid">${[['Нові сьогодні',`${dailyNew(state)} / ${state.settings.newPerDay}`],['Спроб сьогодні · новий облік',today.reviews],['Спроб основного шляху',reviews],['До повторення',c.due],['На довгому повторенні',c.known],['Призупинено',c.suspended]].map(([label,n])=>`<div class="metric"><span class="small muted">${label}</span><strong>${n}</strong></div>`).join('')}</div><p class="small muted progress-note">Денні спроби обліковуються від цього оновлення. Нові слова визначаються датою першої основної оцінки. Сьогодні дострокових спроб: ${today.early}. Довге повторення — основний інтервал ≥21 дня за самооцінкою. Це не оцінка вимови, письма, рівня CEFR або готовності до DTZ.</p><div class="settings-grid"><section class="panel"><h2>Денна ціль</h2><p>Нові унікальні слова в основному шляху за локальний день. Ціль не обмежує навчання — можна пройти всю тему.</p><div class="pills" aria-label="Денна ціль">${[5,10,20,50].map(n=>`<button class="pill" data-action="limit" data-limit="${n}" aria-pressed="${state.settings.newPerDay===n}">${n} слів</button>`).join('')}</div><p class="small muted">Пропущені дні не збільшують ціль.</p></section><section class="panel"><h2>Резервна копія</h2><p>Збережи результати, налаштування та позицію проходження або перенеси їх на інший пристрій.</p><div class="button-row"><button class="button primary" data-action="export">Завантажити копію</button><button class="button outline" data-action="import">Відновити з файлу</button><input id="import-file" type="file" accept="application/json,.json" hidden></div>${damaged?'<button class="button outline" data-action="export-damaged">Завантажити непрочитані дані</button>':''}<p class="small muted">Імпорт зберігає новіший розклад кожної картки й поточну ціль. Повторний імпорт не додає дублікати.</p></section></div><details class="details-help"><summary>Результати додаткових вправ</summary><p>Окремі розклади; не впливають на основний прогрес.</p><div class="extra-results">${MODES.filter(m=>m!==PRIMARY_MODE).map(m=>{const n=modeCounts(allWords,state)[m];return `<p><b>${esc(modeNames[m])}</b><span>${n.learning+n.known} опрацьовано · ${n.due} до повторення · ${n.known} на довгому повторенні</span></p>`;}).join('')}</div>${old?`<p>Стара загальна активність: ${old} спроб. Формат цих відповідей невідомий; до нової щоденної статистики вони не додаються.</p>`:''}${state.legacyStats?`<p>Старі результати Mit Bus und Bahn: ${state.legacyStats.right} правильних, ${state.legacyStats.wrong} помилкових; перенесено лише в DE → UA.</p>`:''}</details><details class="details-help"><summary>Як працюють повторення й збереження</summary><p>Спочатку належні повторення, далі нові. Порція — до 20 різних слів. «Пройти всю тему» охоплює також майбутні повторення, кожне активне слово один раз. Помилки можна повторити окремо.</p><p>Нова картка: не згадав — 1 хв, важко — 10 хв, згадав — 1 день, легко — 4 дні. Успішне дострокове повторення не переносить строк далі; помилка повертає до короткого повторення.</p><p>Це спрощений власний алгоритм, не FSRS. Дані зберігаються на пристрої. Користуйся однією вкладкою для навчання. Облікового запису й автоматичної синхронізації немає.</p><p>Офлайн доступний після першого завантаження. Озвучення залежить від німецьких голосів пристрою.</p></details><div class="danger-area"><span class="small muted">Скидання видаляє розклад, статистику та призупинення.</span><button class="button danger" data-action="reset">Скинути прогрес</button></div>`);
  $('import-file').addEventListener('change',importFile);
}

function download(value, name) {
  const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value,null,2)],{type:'application/json'}));
  const a = document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importFile(e) {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('Файл завеликий. Оберіть резервну копію до 5 МБ.');
    const incoming = validateState(JSON.parse(await file.text()));
    syncLatest();
    const merged = mergeStates(state,incoming);
    if (damaged && !confirm('У браузері є непрочитані дані. Після імпорту їх буде замінено. Завантажте їх перед продовженням, якщо потрібна копія. Продовжити?')) return;
    state=merged; readOnly=false; damaged=null; warn(''); persist();renderProgress();notice(readOnly ? 'Копію відкрито, але браузер не дозволяє зберегти її.' : 'Прогрес із копії додано.');
  } catch(error) { notice(error instanceof SyntaxError ? 'Файл не містить коректного JSON. Прогрес не змінено.' : error.message); }
  finally { if ($('import-file')) $('import-file').value=''; }
}
function speak(id) {
  if(session?.mode===PRIMARY_MODE && !session.revealed)return;
  const w=allWords.find(w=>w.id===id); if (!w) return;
  if (!('speechSynthesis' in window)) {notice('Цей браузер не підтримує вимову.');return;}
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(fullDe(w));u.lang='de-DE';u.rate=.82;
  const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('de'));if(voice)u.voice=voice;
  u.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))notice('Не вдалося відтворити вимову. Перевірте німецькі голоси пристрою та з’єднання.');};speechSynthesis.speak(u);
}
function suspend(id) {
  syncLatest();
  if(session?.current && (JSON.stringify(state.cards[cardKey(session.current.id,session.mode)])!==JSON.stringify(session.previous) || session.persistent && (state.run?.id!==session.runId || state.run.cursor!==session.runCursor))){session=null;renderSetup();notice('Дані змінилися в іншій вкладці. Відкрий навчання знову.');return;}
  const paused=!!state.suspended[id]; if(paused)delete state.suspended[id];else state.suspended[id]=true;persist();
  notice(paused ? 'Слово повернуто до повторень.' : 'Слово призупинено в усіх вправах. Повернути його можна у словнику.');
  if(session?.current){if(session.persistent){state.run.cursor++;state.run.updatedAt=Date.now();persist();}nextCard();}else if(location.hash.startsWith('#dictionary'))renderDictionaryRows();
}
document.addEventListener('click',e=>{
  if(e.target.closest('.skip-link')){e.preventDefault();$('main').focus();return;}
  const b=e.target.closest('[data-action]');if(!b || b.disabled)return;
  const action=b.dataset.action;
  if(action==='learn-topic'){selectedTopic=b.dataset.topic;selectedSection='all';if(location.hash!==`#topic/${selectedTopic}`){history.pushState(null,'',`#topic/${selectedTopic}`);route();}startSession();}
  if(action==='resume-home'){const r=savedRun();selectedTopic=r?.topic||state.settings.lastTopic||'all';selectedSection=r?.section||state.settings.lastSection||'all';if(location.hash!==`#topic/${selectedTopic}`){history.pushState(null,'',`#topic/${selectedTopic}`);route();}startSession();}
  if(action==='dictionary'){dictionaryTopic=b.dataset.topic;query='';dictionaryFilter='all';navigate('#dictionary');}
  if(action==='start-primary')startSession();
  if(action==='full')startSession('full');
  if(action==='extra')startSession('recommended',b.dataset.mode);
  if(action==='continue')startSession('recommended',session?.mode||PRIMARY_MODE);
  if(action==='retry')startSession('recommended',session?.mode||PRIMARY_MODE,true);
  if(action==='back-topic' && session){selectedTopic=session.topic;selectedSection=session.section;session=null;selectedMode=PRIMARY_MODE;renderSetup();}
  if(action==='end'){session=null;renderSetup();}

  if(action==='reveal' && session?.current && !session.revealed){session.revealed=true;renderCard(true);}
  if(action==='answer' && session?.current && !session.revealed){const s=session;s.chosen=s.options[Number(b.dataset.index)];s.judged=s.chosen===(s.mode==='article'?s.current.article:s.mode==='de-ua'?s.current.uk:fullDe(s.current));s.revealed=true;renderCard(true);}
  if(action==='give-up')judgeSpelling(true);
  if(action==='rate')rate(b.dataset.rating);
  if(action==='speak')speak(b.dataset.id);
  if(action==='suspend')suspend(b.dataset.id);
  if(action==='dict-topic'){dictionaryTopic=b.dataset.topic;renderDictionary();}
  if(action==='dict-filter'){dictionaryFilter=b.dataset.filter;renderDictionary();}
  if(action==='limit'){syncLatest();state.settings.newPerDay=Number(b.dataset.limit);persist();renderProgress();}
  if(action==='export'){syncLatest();download(state,`deutsch-progress-${localDay(Date.now())}.json`);}
  if(action==='export-damaged')download(damaged,'deutsch-progress-recovery.json');
  if(action==='import')$('import-file').click();
  if(action==='reset' && confirm('Скинути весь прогрес на цьому пристрої? Перед цим можна завантажити резервну копію.')){
    state=emptyState();readOnly=false;damaged=null;warn('');persist();
    try{storage.removeItem(LEGACY_KEY);}catch{}renderProgress();notice(readOnly ? 'Прогрес скинуто лише в пам’яті: сховище недоступне.' : 'Прогрес скинуто.');
  }
});
document.addEventListener('keydown',e=>{
  if(!session?.current || e.repeat || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(e.target.tagName))return;
  if(e.code==='Space' && session.mode.startsWith('cards') && !session.revealed){e.preventDefault();session.revealed=true;renderCard(true);}
  else if(session.revealed && ['1','2','3','4'].includes(e.key)){e.preventDefault();rate(['again','hard','good','easy'][Number(e.key)-1]);}
});
function route() {
  session=null;selectedMode=PRIMARY_MODE;
  const hash=location.hash || '#learn';
  for(const a of document.querySelectorAll('[data-nav]')){const active=hash.startsWith(`#${a.dataset.nav}`) || (a.dataset.nav==='learn' && hash.startsWith('#topic/'));if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  if(hash.startsWith('#topic/')){const id=hash.slice(7);selectedTopic=topics.some(t=>t.id===id)?id:'all';const saved=savedRun();if(saved?.topic===selectedTopic)selectedSection=saved.section;const topic=topics.find(t=>t.id===selectedTopic);if(!topic?.sections.some(s=>s.id===selectedSection))selectedSection='all';renderSetup();}
  else if(hash==='#dictionary')renderDictionary();
  else if(hash==='#progress')renderProgress();
  else renderHome();
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
window.addEventListener('storage',e=>{
  if(e.key!==STORAGE_KEY && e.key!==null)return;
  const loaded=loadState(storage,allWords);state=loaded.state;readOnly=!!loaded.readOnly;damaged=loaded.damaged;warn(loaded.warning||'');route();notice('Прогрес оновлено в іншій вкладці. Відкрийте навчання знову, щоб продовжити.');
});
function refreshScheduledCounts() {
  if (!state || !topics || session || document.hidden) return;
  const hash = location.hash || '#learn';
  if (!['#learn','#progress','#dictionary'].includes(hash) && !hash.startsWith('#topic/')) return;
  if (renderedCountSignature === countSignature()) return;
  const focused = document.activeElement;
  const selector = focused?.dataset.action ? Object.entries(focused.dataset).map(([key,value]) => `[data-${key}="${value}"]`).join('') : null;
  if (hash.startsWith('#topic/')) renderSetup(); else if(hash==='#progress')renderProgress();else if(hash==='#dictionary')renderDictionaryRows();else renderHome();
  renderedCountSignature=countSignature();
  if (selector) document.querySelector(selector)?.focus({preventScroll:true});
}
setInterval(refreshScheduledCounts, 10000);
window.addEventListener('focus', refreshScheduledCounts);
document.addEventListener('visibilitychange', refreshScheduledCounts);
async function init() {
  try {
    topics=await loadTopics();allWords=wordsIn(topics);
    try{storage=window.localStorage;}catch{storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};}
    const loaded=loadState(storage,allWords);state=loaded.state;readOnly=!!loaded.readOnly;damaged=loaded.damaged;warn(loaded.warning||'');route();
    if(loaded.migrated)notice('Попередній прогрес перенесено до карток теми «Mit Bus und Bahn».');
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('./sw.js').then(reg=>{
        if(reg.active && navigator.serviceWorker.controller)$('connection').textContent='Доступно офлайн · прогрес у браузері';
        const watch=worker=>worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){if(navigator.serviceWorker.controller)notice('Є оновлення словника. Закрийте всі вкладки сайту й відкрийте його знову.');else $('connection').textContent='Доступно офлайн · прогрес у браузері';}});
        watch(reg.installing);reg.addEventListener('updatefound',()=>watch(reg.installing));
      }).catch(()=>{$('connection').textContent='Прогрес у браузері · офлайн-копія недоступна';});
    }
  } catch(error){main(`<section class="panel empty-state"><h1>Словник не завантажився</h1><p>${esc(error.message)}</p><p>Перевірте з’єднання й оновіть сторінку. Збережений прогрес залишається у браузері.</p><button class="button primary" id="reload">Спробувати знову</button></section>`);$('reload').onclick=()=>location.reload();}
}
init();
