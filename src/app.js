import { loadTopics, wordsIn, fullDe, checkSpelling, optionsFor } from './content.js';
import { DAY, MINUTE, cardKey, localDay, schedule, counts, buildQueue, newAllowance } from './scheduler.js';
import { STORAGE_KEY, LEGACY_KEY, emptyState, loadState, saveState, validateState, mergeStates } from './storage.js';
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = { home:'M3 10 12 3l9 7v11H3Z M9 21v-8h6v8', train:'M6 17h12V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2Z M6 10h12 M8 21l2-4m6 4-2-4 M9 14h.01M15 14h.01', cards:'M5 7h14v14H5Z M8 3h11a3 3 0 0 1 3 3v11 M9 12h6m-6 4h4', arrow:'M4 12h16m-6-6 6 6-6 6', back:'M20 12H4m6-6-6 6 6 6', check:'M5 12l4 4L19 6', sound:'M4 9h4l5-4v14l-5-4H4Z M17 8a6 6 0 0 1 0 8 M20 5a10 10 0 0 1 0 14', shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z M8 12l3 3 5-6', book:'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3Z M12 6v15' };
const icon = name => `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.cards}"/></svg>`;
const german = w => ['der','die','das'].includes(w.article) ? `<span class="article ${w.article}">${w.article}</span><span lang="de">${esc(w.de)}</span>` : `<span lang="de">${esc(fullDe(w))}</span>`;
const modeNames = {'cards-de-ua':'Картки · DE → UA','cards-ua-de':'Картки · UA → DE','de-ua':'Переклад · DE → UA','ua-de':'Переклад · UA → DE',article:'Артиклі',spell:'Написання'};
let topics, allWords, state, storage, damaged, readOnly = false, session = null;
let selectedTopic = 'all', selectedSection = 'all', selectedMode = 'cards-de-ua';
let dictionaryTopic = 'all', dictionaryFilter = 'all', query = '', toastTimer;
const nowCounts = (words, mode = 'cards-de-ua') => counts(words, state, mode);
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
function main(html, focus = false) { $('main').innerHTML = html; if (focus) $('main').focus({preventScroll:true}); }
function navigate(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function topicTitle(id) { return id === 'all' ? 'Усі теми' : topics.find(t => t.id === id)?.uk || 'Усі теми'; }
function renderHome() {
  const c = nowCounts(allWords), allowance = Math.min(c.new, newAllowance(state, 'cards-de-ua'));
  main(`<div class="intro"><div><h1>Час для німецької.</h1><p class="muted">Одна тема чи все разом — оберіть, що вчити сьогодні.</p></div><span class="date">${esc(new Intl.DateTimeFormat('uk',{day:'numeric',month:'long',weekday:'long'}).format(new Date()))}</span></div>
    <section class="review-banner" aria-labelledby="review-heading"><div><div class="eyebrow">Ваше щоденне повторення</div><h2 id="review-heading">${c.due ? `${c.due} слів чекають на повторення` : allowance ? 'Зробімо ще один крок.' : 'На зараз усе повторено.'}</h2><p>${c.due ? 'Спочатку пригадаємо те, що вже вчили. Потім — трохи нового.' : allowance ? `Сьогодні можна вивчити до ${allowance} нових слів. Відомі слова повернуться, коли настане час.` : c.nextDue ? `Наступне повторення: ${formatDate(c.nextDue)}.` : 'Можна переглянути словник або обрати іншу вправу.'}</p></div><div class="banner-action"><button class="button lime" data-action="setup" data-topic="all">Вчити всі теми ${icon('arrow')}</button><span class="small">${c.due} до повторення · ${allowance} нових</span></div></section>
    <section aria-labelledby="topics-heading"><div class="section-heading"><h2 id="topics-heading">Ваші теми</h2><span class="small">${topics.length} теми · ${allWords.length} унікальні слова</span></div><div class="topics">${topics.map(t => {
      const tc = nowCounts(wordsIn(topics,t.id));
      return `<article class="topic-card"><div class="topic-card-top"><div class="topic-icon ${t.icon === 'home' ? 'home' : ''}">${icon(t.icon)}</div><span class="small muted">Сторінка ${t.page}</span></div><span class="eyebrow muted">${esc(t.uk)}</span><h3 class="topic-title" lang="de">${esc(t.title)}</h3><p>${esc(t.description)}</p><div class="topic-meta"><span><b>${t.words.length}</b> слів</span><span><b>${tc.due}</b> до повторення</span><span><b>${tc.known}</b> засвоєно</span></div><div class="meter" role="img" aria-label="Засвоєно ${tc.known} із ${t.words.length}"><span style="width:${tc.known / t.words.length * 100}%"></span></div><div class="topic-bottom"><button class="button outline" data-action="setup" data-topic="${t.id}">Вчити тему ${icon('arrow')}</button><button class="button quiet" data-action="dictionary" data-topic="${t.id}">Словник</button></div></article>`;
    }).join('')}</div><p class="helper-line">${icon('cards')} Лічильники на цій сторінці — для карток DE → UA. Кожна вправа має власний розклад.</p></section>`);
}
function renderSetup() {
  const topic = topics.find(t => t.id === selectedTopic), pool = wordsIn(topics, selectedTopic, selectedSection);
  const c = nowCounts(pool, selectedMode), n = Math.min(c.new, newAllowance(state, selectedMode));
  const queue = buildQueue(pool, state, selectedMode);
  main(`<a class="back" href="#learn">${icon('back')} До тем</a><div class="workspace"><aside class="panel" aria-label="Параметри навчання"><h3>Як будемо вчити?</h3><div class="choice-list">${[['cards','Картки','Згадайте й оцініть себе'],['de-ua','DE → UA','Оберіть переклад'],['ua-de','UA → DE','Оберіть німецьке слово'],['article','Артиклі','der, die чи das?'],['spell','Написання','Введіть слово німецькою']].map(([mode,name,detail]) => `<button class="choice" data-action="mode" data-mode="${mode}" aria-pressed="${mode === 'cards' ? selectedMode.startsWith('cards') : selectedMode === mode}">${name}<small>${detail}</small></button>`).join('')}</div>${selectedMode.startsWith('cards') ? `<div class="panel-label">Напрямок карток</div><div class="pills">${['cards-de-ua','cards-ua-de'].map(m => `<button class="pill" data-action="direction" data-mode="${m}" aria-pressed="${selectedMode === m}">${m === 'cards-de-ua' ? 'DE → UA' : 'UA → DE'}</button>`).join('')}</div>` : ''}${topic ? `<div class="panel-label">Частина теми</div><div class="pills">${[{id:'all',uk:'Уся тема'},...topic.sections].map(s => `<button class="pill" data-action="section" data-section="${s.id}" aria-pressed="${selectedSection === s.id}">${esc(s.uk)}</button>`).join('')}</div>` : ''}</aside><section><div class="setup-head"><div class="eyebrow muted">${topic ? esc(topic.title) : 'Слова з усіх ваших тем'}</div><h1>${esc(topicTitle(selectedTopic))}</h1><p class="muted">${esc(modeNames[selectedMode])} · ${pool.length} слів у добірці</p></div><div class="panel setup-preview">${icon('cards')}<div class="stat-row"><div><strong>${c.due}</strong><span>до повторення</span></div><div><strong>${n}</strong><span>нових на сьогодні</span></div><div><strong>${c.known}</strong><span>засвоєно</span></div></div><p class="setup-note">${queue.length ? `У цій сесії — до ${queue.length} слів. Спочатку повторення, потім нові. Відповіді зберігаються одразу.` : selectedMode === 'article' && !pool.some(w => ['der','die','das'].includes(w.article) && !w.plural) ? 'У цій частині немає іменників для вправи на артиклі. Оберіть іншу частину або режим.' : c.nextDue ? `На зараз усе. Наступне повторення: ${formatDate(c.nextDue)}.${c.new && !n ? ' Ліміт нових слів на сьогодні вичерпано.' : ''}` : c.new && !n ? 'Ліміт нових слів на сьогодні вичерпано. Його можна змінити у вкладці «Прогрес».' : 'Немає доступних слів. Призупинені слова можна повернути через словник.'}</p><button class="button primary" data-action="start" ${queue.length ? '' : 'disabled'}>Почати навчання ${icon('arrow')}</button></div><p class="helper-line">${icon('shield')} Знайомі слова з’являються рідше. Розклад спільний для слова в різних темах, але окремий для кожної вправи.</p></section></div>`);
}
function startSession() {
  syncLatest();
  const pool = wordsIn(topics, selectedTopic, selectedSection);
  session = { topic: selectedTopic, section: selectedSection, mode: selectedMode, queue: buildQueue(pool,state,selectedMode), completed: 0, total: 0, current: null, revealed: false, judged: null };
  session.total = session.queue.length;
  nextCard();
}
function nextCard() {
  if (!session) return;
  const id = session.queue.shift();
  session.current = allWords.find(w => w.id === id);
  session.revealed = false; session.judged = null; session.chosen = null;
  if (!session.current) { renderComplete(); return; }
  const w = session.current;
  session.options = session.mode === 'article' ? ['der','die','das'] : optionsFor(w,allWords,session.mode === 'de-ua' ? 'uk' : 'de');
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
  const now = Date.now(), previous = state.cards[cardKey(w.id,s.mode)];
  const ratingButtons = `<div class="rating-grid" aria-label="Оцініть відповідь">${[['again','Ще раз'],['hard','Важко'],['good','Добре'],['easy','Легко']].map(([r,label],i) => `<button class="rating ${r}" data-action="rate" data-rating="${r}" ${s.judged === false && r !== 'again' ? 'disabled' : ''} aria-label="${label}, через ${intervalText(schedule(previous,r,now).due-now)}"><b>${label}</b><span>${intervalText(schedule(previous,r,now).due-now)}</span></button>`).join('')}</div>`;
  main(`<div class="study-wrap"><div class="study-top"><button class="button quiet back" data-action="end">${icon('back')} Завершити</button><span class="small muted">${s.completed} / ${s.total} слів · ${esc(modeNames[s.mode])}</span></div><div class="meter" role="img" aria-label="Опрацьовано ${s.completed} з ${s.total}"><span style="width:${s.total ? s.completed/s.total*100 : 0}%"></span></div><section class="study-card" style="margin-top:17px" aria-label="Навчальна картка"><div class="card-top"><span>${esc(section?.uk || topicTitle(s.topic))}</span><span class="badge">${previous ? 'Повторення' : 'Нове слово'}</span></div><div class="word-area"><div class="word">${prompt}</div>${flash && s.revealed ? `<hr class="answer-rule"><div class="translation">${forward ? esc(w.uk) : german(w)}</div>` : ''}${answerInfo}</div>${flash ? s.revealed ? ratingButtons : '<button class="button primary reveal" data-action="reveal">Показати відповідь <span class="small keyboard-help">· пробіл</span></button>' : s.mode === 'spell' ? `${s.revealed ? feedback + ratingButtons : `<form id="spell-form"><label class="spell-label" for="spell-input">Німецьке слово (можна з артиклем)</label><input class="input" id="spell-input" lang="de" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ваша відповідь…"><div class="spell-actions"><button class="button primary" type="submit">Перевірити</button><button class="button quiet" type="button" data-action="give-up">Не пам’ятаю</button></div></form>`}` : `<div class="choices">${s.options.map((o,i) => `<button class="answer ${s.revealed && o === correct ? 'correct' : s.revealed && s.chosen === o ? 'wrong' : ''}" data-action="answer" data-index="${i}" ${s.revealed ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>${feedback}${s.revealed ? ratingButtons : ''}`}</section><div class="study-footer"><div>${forward && s.mode !== 'article' || s.revealed ? `<button class="button quiet" data-action="speak" data-id="${w.id}">${icon('sound')} Вимова</button>` : '<span class="small">Спробуйте згадати без підказки</span>'}</div><button class="button quiet" data-action="suspend" data-id="${w.id}">Не повторювати</button></div>${s.revealed ? '<p class="small muted keyboard-help" style="text-align:center;margin-top:10px">1 — ще раз · 2 — важко · 3 — добре · 4 — легко</p>' : ''}</div>`,focus);
  if (s.mode === 'spell' && !s.revealed) { $('spell-form').addEventListener('submit', e => {e.preventDefault(); judgeSpelling(false);}); $('spell-input').focus({preventScroll:true}); }
}
function judgeSpelling(giveUp) {
  if (!session?.current || session.revealed) return;
  const input = $('spell-input')?.value || '';
  if (!giveUp && !input.trim()) { $('spell-input').focus(); return; }
  session.judged = !giveUp && checkSpelling(session.current,input); session.revealed = true; renderCard(true);
}
function rate(rating) {
  if (!session?.current || !session.revealed || (session.judged === false && rating !== 'again')) return;
  syncLatest();
  const key = cardKey(session.current.id,session.mode), now = Date.now();
  state.cards[key] = schedule(state.cards[key],rating,now);
  const day = localDay(now); state.history[day] ||= {reviews:0,again:0}; state.history[day].reviews++; if (rating === 'again') state.history[day].again++;
  persist(); session.completed++; nextCard();
}
function renderComplete() {
  const c = nowCounts(wordsIn(topics,session.topic,session.section),session.mode);
  const queue = buildQueue(wordsIn(topics,session.topic,session.section),state,session.mode);
  main(`<div class="study-wrap"><section class="panel empty-state">${icon('check')}<h1>Гарна робота на сьогодні.</h1><p>У цій сесії опрацьовано ${session.completed} слів.${readOnly ? ' Завантажте копію прогресу перед закриттям сторінки.' : ' Прогрес збережено у вашому браузері.'}</p>${c.nextDue ? `<p>Найближче повторення: <b>${formatDate(c.nextDue)}</b>.<br>Слова з оцінкою «Ще раз» повернуться через хвилину.</p>` : ''}<div class="button-row" style="justify-content:center"><button class="button primary" data-action="continue">${queue.length ? 'Продовжити навчання' : 'Перевірити наступні повторення'}</button><a class="button outline" href="#learn">До тем</a></div></section></div>`,true);
}
function wordStatus(w) {
  if (state.suspended[w.id]) return 'Призупинено в усіх вправах';
  const c = state.cards[cardKey(w.id,'cards-de-ua')];
  return !c ? 'Нове слово' : c.due <= Date.now() ? 'Час повторити' : `Повторення: ${formatDate(c.due)}`;
}
function renderDictionary() {
  main(`<div class="intro"><div><h1>Ваш словник</h1><p class="muted">Усі слова під рукою. Слухайте, пригадуйте, знаходьте потрібне.</p></div></div><div class="dictionary-controls"><label for="word-search" class="small muted">Пошук німецькою або українською</label><input class="input" id="word-search" type="search" placeholder="Наприклад, Wohnung або квартира" value="${esc(query)}"><div class="pills" aria-label="Тема словника">${[{id:'all',uk:'Усі теми'},...topics].map(t => `<button class="pill" data-action="dict-topic" data-topic="${t.id}" aria-pressed="${dictionaryTopic === t.id}">${esc(t.uk)}</button>`).join('')}</div><div class="pills" aria-label="Стан слів">${[['all','Усі слова'],['due','До повторення'],['paused','Призупинені']].map(([id,label])=>`<button class="pill" data-action="dict-filter" data-filter="${id}" aria-pressed="${dictionaryFilter === id}">${label}</button>`).join('')}</div></div><div class="section-heading"><span id="dictionary-count" class="small"></span><span class="small">Розклад карток DE → UA</span></div><div id="dictionary-rows"></div>`);
  $('word-search').addEventListener('input',e => {query=e.target.value;renderDictionaryRows();});renderDictionaryRows();
}
function renderDictionaryRows() {
  const search = query.trim().toLocaleLowerCase('uk');
  const words = wordsIn(topics,dictionaryTopic).filter(w => `${fullDe(w)} ${w.uk}`.toLocaleLowerCase('uk').includes(search)).filter(w => dictionaryFilter === 'all' || (dictionaryFilter === 'paused' ? state.suspended[w.id] : !state.suspended[w.id] && state.cards[cardKey(w.id,'cards-de-ua')]?.due <= Date.now()));
  $('dictionary-count').textContent = `Знайдено: ${words.length}`;
  $('dictionary-rows').innerHTML = words.length ? `<div class="word-list">${words.map(w => `<article class="word-row"><div><div class="german">${german(w)}</div><div class="word-status">${esc(wordStatus(w))}</div></div><div class="translation-cell">${esc(w.uk)}${w.note || w.example ? `<details><summary>Пояснення${w.example ? ' і приклад' : ''}</summary>${w.note ? `<p>${esc(w.note)}</p>` : ''}${w.example ? `<p lang="de">${esc(w.example.de)}</p><p>${esc(w.example.uk)}</p>` : ''}</details>` : ''}</div><div class="row-actions"><button class="button quiet" data-action="speak" data-id="${w.id}" aria-label="Послухати ${esc(w.de)}">${icon('sound')}</button><button class="button outline" data-action="suspend" data-id="${w.id}">${state.suspended[w.id] ? 'Повернути' : 'Не повторювати'}</button></div></article>`).join('')}</div>` : '<div class="panel empty-state"><h2>Нічого не знайдено</h2><p>Спробуйте інше слово або змініть фільтр.</p></div>';
}
function renderProgress() {
  const c = nowCounts(allWords), today = state.history[localDay(Date.now())] || {reviews:0};
  const reviews = Object.values(state.history).reduce((n,h)=>n+h.reviews,0);
  main(`<div class="intro"><div><h1>Ваш прогрес</h1><p class="muted">Маленькі кроки, які залишаються з вами.</p></div><span class="badge">${readOnly ? 'Тимчасово в пам’яті' : 'Зберігається локально'}</span></div><div class="progress-grid"><div class="metric"><span class="small muted">Відповідей сьогодні</span><strong>${today.reviews}</strong></div><div class="metric"><span class="small muted">Відповідей загалом</span><strong>${reviews}</strong></div><div class="metric"><span class="small muted">Засвоєно · картки DE → UA</span><strong>${c.known}<span class="small muted"> / ${allWords.length}</span></strong></div></div><div class="settings-grid"><section class="panel"><h2>Скільки нового щодня?</h2><p>Ліміт спільний для всіх тем і окремий для кожної вправи. Повторення вже вивчених слів не обмежуються.</p><div class="pills" aria-label="Нових слів на день">${[5,10,20,50].map(n=>`<button class="pill" data-action="limit" data-limit="${n}" aria-pressed="${state.settings.newPerDay === n}">${n} слів</button>`).join('')}</div><p class="small">Засвоєні — слова з інтервалом щонайменше 21 день. Вони повертаються рідко; через словник їх можна призупинити повністю.</p></section><section class="panel"><h2>Резервна копія</h2><p>Прогрес належить цьому браузеру. Збережіть копію перед очищенням даних або перенесіть її на інший пристрій.</p><div class="button-row"><button class="button primary" data-action="export">Завантажити копію</button><button class="button outline" data-action="import">Відновити з файлу</button><input id="import-file" type="file" accept="application/json,.json" hidden></div>${damaged ? '<button class="button outline" style="margin-top:12px" data-action="export-damaged">Завантажити непрочитані дані</button>' : ''}<p class="small">Імпорт об’єднує записи, залишаючи новішу відповідь для кожної картки. Лічильники за день не додаються, щоб уникнути дублів. Поточний денний ліміт зберігається.</p></section></div><details class="details-help"><summary>Як працюють повторення й локальне збереження</summary><p>Спочатку показуються слова, час повторення яких настав. Далі — нові в межах денного ліміту. Сесія містить до 20 слів. Після сесії можна продовжити.</p><p>Для нової картки: «Ще раз» — 1 хвилина, «Важко» — 10 хвилин, «Добре» — 1 день, «Легко» — 4 дні. Подальші правильні відповіді збільшують інтервал до максимуму 365 днів. Після помилки слово повертається до короткого повторення.</p><p>Це спрощена система за принципом Anki, а не точний алгоритм Anki / FSRS. Картки, переклад, артиклі й написання мають окремий прогрес: упізнавання слова не означає, що ви вже вмієте його писати.</p><p>Облікового запису й сервера немає. Кожен друг, що відкриє сайт, матиме власний прогрес у своєму браузері. Автоматичної синхронізації між пристроями немає. Зміна адреси сайту, приватний режим або очищення браузера можуть зробити старий прогрес недоступним.</p><p>Після першого завантаження сайт зберігається для роботи без інтернету. Вимова використовує німецькі голоси вашого пристрою; деякі голоси потребують інтернету. Для зручності можна додати сайт на головний екран через меню браузера.</p>${state.legacyStats ? `<p>Перенесено попередній прогрес теми «Mit Bus und Bahn»: ${state.legacyStats.right} правильних і ${state.legacyStats.wrong} помилкових відповідей. Старі оцінки враховано в картках DE → UA.</p>` : ''}</details><div class="danger-area"><span class="small muted">Повне скидання видалить розклад, статистику та призупинення слів.</span><button class="button danger" data-action="reset">Скинути прогрес</button></div>`);
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
  const w=allWords.find(w=>w.id===id); if (!w) return;
  if (!('speechSynthesis' in window)) {notice('Цей браузер не підтримує вимову.');return;}
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(fullDe(w));u.lang='de-DE';u.rate=.82;
  const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('de'));if(voice)u.voice=voice;
  u.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))notice('Не вдалося відтворити вимову. Перевірте німецькі голоси пристрою та з’єднання.');};speechSynthesis.speak(u);
}
function suspend(id) {
  syncLatest(); const paused=!!state.suspended[id]; if(paused)delete state.suspended[id];else state.suspended[id]=true;persist();
  notice(paused ? 'Слово повернуто до повторень.' : 'Слово призупинено в усіх вправах. Повернути його можна у словнику.');
  if(session?.current){session.completed++;nextCard();}else if(location.hash.startsWith('#dictionary'))renderDictionaryRows();
}
document.addEventListener('click',e=>{
  if(e.target.closest('.skip-link')){e.preventDefault();$('main').focus();return;}
  const b=e.target.closest('[data-action]');if(!b || b.disabled)return;
  const action=b.dataset.action;
  if(action==='setup'){selectedTopic=b.dataset.topic;selectedSection='all';session=null;navigate(`#topic/${selectedTopic}`);}
  if(action==='dictionary'){dictionaryTopic=b.dataset.topic;query='';dictionaryFilter='all';navigate('#dictionary');}
  if(action==='mode'){selectedMode=b.dataset.mode==='cards'?'cards-de-ua':b.dataset.mode;renderSetup();}
  if(action==='direction'){selectedMode=b.dataset.mode;renderSetup();}
  if(action==='section'){selectedSection=b.dataset.section;renderSetup();}
  if(action==='start')startSession();
  if(action==='continue'){session=null;renderSetup();}
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
  session=null;
  const hash=location.hash || '#learn';
  for(const a of document.querySelectorAll('[data-nav]')){const active=hash.startsWith(`#${a.dataset.nav}`) || (a.dataset.nav==='learn' && hash.startsWith('#topic/'));if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  if(hash.startsWith('#topic/')){const id=hash.slice(7);selectedTopic=topics.some(t=>t.id===id)?id:'all';const topic=topics.find(t=>t.id===selectedTopic);if(!topic?.sections.some(s=>s.id===selectedSection))selectedSection='all';renderSetup();}
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
