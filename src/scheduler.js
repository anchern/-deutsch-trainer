// Anki-inspired, deliberately small scheduler. Intervals are not Anki/FSRS compatible.
export const DAY = 86_400_000;
export const MINUTE = 60_000;
export const MODES = ['cards-de-ua', 'cards-ua-de', 'de-ua', 'ua-de', 'article', 'spell'];
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
  return words.filter(w => !state.suspended[w.id] && (mode !== 'article' || (!w.plural && ['der', 'die', 'das'].includes(w.article))));
}
export function counts(words, state, mode, now = Date.now()) {
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
  const fresh = pool.filter(w => !state.cards[cardKey(w.id, mode)]).slice(0, newAllowance(state, mode, now));
  return [...due, ...fresh].slice(0, limit).map(w => w.id);
}

export function modeCounts(words, state, now = Date.now()) {
  return Object.fromEntries(MODES.map(mode => {
    const count = counts(words, state, mode, now);
    return [mode, { ...count, newToday: Math.min(count.new, newAllowance(state, mode, now)) }];
  }));
}
export function overviewCounts(words, state, now = Date.now()) {
  const byMode = modeCounts(words, state, now);
  const dueWords = new Set(), knownWords = new Set();
  for (const mode of MODES) {
    for (const w of eligible(words, state, mode)) {
      const card = state.cards[cardKey(w.id, mode)];
      if (card?.due <= now) dueWords.add(w.id);
      if (card?.interval >= 21) knownWords.add(w.id);
    }
  }
  const upcoming = Object.values(byMode).map(c => c.nextDue).filter(t => t !== null);
  const due = Object.values(byMode).reduce((sum, c) => sum + c.due, 0);
  // Open a format that actually has work, rather than always the default cards.
  const recommendedMode = [...MODES].sort((a, b) => byMode[b].due - byMode[a].due)[0];
  return { byMode, due, dueWords: dueWords.size, known: knownWords.size,
    nextDue: upcoming.length ? Math.min(...upcoming) : null,
    recommendedMode: due ? recommendedMode : MODES.find(m => byMode[m].newToday > 0) || MODES[0] };
}
