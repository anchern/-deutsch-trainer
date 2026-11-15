// Anki-inspired, deliberately small scheduler. Intervals are not Anki/FSRS compatible.
export const DAY = 86_400_000;
export const MINUTE = 60_000;
export const MODES = ['cards-de-ua', 'cards-ua-de', 'de-ua', 'ua-de', 'article', 'spell'];
export const PRIMARY_MODE = 'cards-ua-de';
export const RATINGS = ['again', 'hard', 'good', 'easy'];
export const cardKey = (id, mode) => `${id}::${mode}`;
export const localDay = time => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function schedule(previous, rating, now = Date.now()) {
  if (!RATINGS.includes(rating)) throw new Error('Unknown rating');
  const p = previous || { interval: 0, ease: 2.5, reviews: 0, lapses: 0, introducedAt: now };
  let interval, delay, ease = p.ease;
  if (rating === 'again') { interval = 0; delay = MINUTE; ease = Math.max(1.3, ease - 0.2); }
  else if (p.interval < 1) {
    interval = rating === 'hard' ? 0 : rating === 'good' ? 1 : 4;
    delay = interval ? interval * DAY : 10 * MINUTE;
  } else {
    if (rating === 'hard') { interval = Math.max(p.interval + 1, Math.ceil(p.interval * 1.2)); ease = Math.max(1.3, ease - 0.15); }
    if (rating === 'good') interval = Math.max(p.interval + 1, Math.round(p.interval * ease));
    if (rating === 'easy') { interval = Math.max(p.interval + 2, Math.round(p.interval * ease * 1.3)); ease = Math.min(3.5, ease + 0.15); }
    interval = Math.min(365, interval);
    delay = interval * DAY;
  }
  return { interval, ease, due: now + delay, reviews: p.reviews + 1,
    lapses: p.lapses + (rating === 'again' ? 1 : 0), introducedAt: p.introducedAt,
    updatedAt: now, lastRating: rating };
}
export function eligible(words, state, mode) {
  return [...new Map(words.map(w => [w.id, w])).values()].filter(w => !state.suspended[w.id] && (mode !== 'article' || (!w.plural && ['der', 'die', 'das'].includes(w.article))));
}
export function counts(words, state, mode, now = Date.now()) {
  words = [...new Map(words.map(w => [w.id, w])).values()];
  const result = { total: words.length, new: 0, due: 0, learning: 0, known: 0, suspended: 0, nextDue: null };
  result.suspended = words.filter(w => state.suspended[w.id]).length;
  for (const w of eligible(words, state, mode)) {
    const c = state.cards[cardKey(w.id, mode)];
    if (!c) { result.new++; continue; }
    if (c.due <= now) result.due++;
    else result.nextDue = result.nextDue === null ? c.due : Math.min(result.nextDue, c.due);
    if (c.interval >= 21) result.known++; else result.learning++;
  }
  return result;
}
export function newAllowance(state, mode, now = Date.now()) {
  const today = localDay(now);
  const introduced = Object.entries(state.cards).filter(([key, c]) => key.endsWith(`::${mode}`) && localDay(c.introducedAt) === today).length;
  return Math.max(0, state.settings.newPerDay - introduced);
}
export function buildQueue(words, state, mode, now = Date.now(), limit = 20) {
  const pool = eligible(words, state, mode);
  const due = pool.filter(w => state.cards[cardKey(w.id, mode)]?.due <= now)
    .sort((a, b) => state.cards[cardKey(a.id, mode)].due - state.cards[cardKey(b.id, mode)].due);
  const fresh = pool.filter(w => !state.cards[cardKey(w.id, mode)]);
  return [...due, ...fresh].slice(0, limit).map(w => w.id);
}

export function modeCounts(words, state, now = Date.now()) {
  return Object.fromEntries(MODES.map(mode => {
    const count = counts(words, state, mode, now);
    return [mode, { ...count, newToday: Math.min(count.new, newAllowance(state, mode, now)) }];
  }));
}
// All general screens use the same primary-recall metric, deduplicated by ID.
export function overviewCounts(words, state, now = Date.now()) {
  const c = counts(words, state, PRIMARY_MODE, now);
  return { ...c, active: c.total - c.suspended, processed: c.learning + c.known,
    byMode: modeCounts(words, state, now), dueWords: c.due, recommendedMode: PRIMARY_MODE };
}
export function dailyNew(state, now = Date.now()) {
  return Object.entries(state.cards).filter(([key, c]) => key.endsWith(`::${PRIMARY_MODE}`) && localDay(c.introducedAt) === localDay(now)).length;
}
// The condition is captured when a card opens, not when the answer is revealed.
export function practiceSchedule(previous, rating, now = Date.now(), early = !!previous && previous.due > now) {
  const next = schedule(previous, rating, now);
  if (early && rating !== 'again') return { ...previous, reviews: next.reviews, updatedAt: now, lastRating: rating, earlyReviews: (previous.earlyReviews || 0) + 1 };
  return { ...next, earlyReviews: (previous?.earlyReviews || 0) + (early ? 1 : 0) };
}
export function createRun(words, state, topic, section, kind = 'recommended', now = Date.now()) {
  const ids = kind === 'full' ? eligible(words, state, PRIMARY_MODE).map(w => w.id) : buildQueue(words, state, PRIMARY_MODE, now, Infinity);
  return { id: `${now}-${Math.random().toString(36).slice(2,10)}`, topic, section, kind, ids, cursor: 0, difficult: [], updatedAt: now };
}
export function reconcileRun(run, topics, state) {
  if (!run) return null;
  const topic = topics.find(t => t.id === run.topic);
  if (run.topic !== 'all' && !topic || run.section !== 'all' && !topic?.sections.some(s => s.id === run.section)) return null;
  const allowed = new Set(topics.filter(t => run.topic === 'all' || t.id === run.topic).flatMap(t => t.words.filter(w => run.section === 'all' || w.section === run.section).map(w => w.id)));
  const keep = id => allowed.has(id) && !state.suspended[id];
  return { ...run, ids: run.ids.filter(keep), cursor: run.ids.slice(0,run.cursor).filter(keep).length, difficult: run.difficult.filter(keep) };
}
