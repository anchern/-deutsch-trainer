import { MODES, RATINGS, DAY, cardKey } from './scheduler.js';
export const STORAGE_KEY = 'deutsch-trainer:v2';
export const LEGACY_KEY = 'busbahn-progress';
export const emptyState = () => ({ version: 2, cards: {}, suspended: {}, settings: { newPerDay: 20 }, history: {}, legacyStats: null });
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeKey = key => !['__proto__', 'prototype', 'constructor'].includes(key);
const number = (v, max = 8.64e15) => Number.isFinite(v) && v >= 0 && v <= max;
export function validateState(raw) {
  if (!object(raw) || raw.version !== 2 || !object(raw.cards) || !object(raw.suspended) || !object(raw.settings) || !object(raw.history)) throw new Error('Цей файл не є резервною копією Deutsch Trainer версії 2.');
  if (![5, 10, 20, 50].includes(raw.settings.newPerDay)) throw new Error('Некоректний ліміт нових слів.');
  const state = emptyState();
  state.settings.newPerDay = raw.settings.newPerDay;
  for (const [key, c] of Object.entries(raw.cards)) {
    const [id, mode, extra] = key.split('::');
    if (!safeKey(key) || !/^[a-z0-9-]+$/.test(id) || !MODES.includes(mode) || extra !== undefined || !object(c) || !number(c.interval, 365) || !number(c.ease, 3.5) || c.ease < 1.3 || !number(c.due) || !number(c.introducedAt) || !number(c.updatedAt) || !Number.isInteger(c.reviews) || !number(c.reviews, 1e9) || !Number.isInteger(c.lapses) || !number(c.lapses, c.reviews) || !RATINGS.includes(c.lastRating)) throw new Error('У файлі є некоректний розклад повторень.');
    state.cards[key] = { interval: c.interval, ease: c.ease, due: c.due, introducedAt: c.introducedAt, updatedAt: c.updatedAt, reviews: c.reviews, lapses: c.lapses, lastRating: c.lastRating };
  }
  for (const [id, value] of Object.entries(raw.suspended)) {
    if (!safeKey(id) || !/^[a-z0-9-]+$/.test(id) || typeof value !== 'boolean') throw new Error('Некоректний список призупинених слів.');
    if (value) state.suspended[id] = true;
  }
  for (const [date, entry] of Object.entries(raw.history)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !object(entry) || !Number.isInteger(entry.reviews) || !number(entry.reviews, 1e9) || !Number.isInteger(entry.again) || !number(entry.again, entry.reviews)) throw new Error('Некоректна історія навчання.');
    state.history[date] = { reviews: entry.reviews, again: entry.again };
  }
  if (raw.legacyStats !== null && raw.legacyStats !== undefined) {
    if (!object(raw.legacyStats) || !number(raw.legacyStats.right, 1e9) || !number(raw.legacyStats.wrong, 1e9)) throw new Error('Некоректна попередня статистика.');
    state.legacyStats = { right: raw.legacyStats.right, wrong: raw.legacyStats.wrong };
  }
  return state;
}
export function migrateLegacy(raw, words, now = Date.now()) {
  if (!object(raw) || !object(raw.scores)) throw new Error('Не вдалося прочитати старий прогрес.');
  const state = emptyState();
  for (const w of words) {
    const score = raw.scores[w.legacyKey];
    if (!Number.isFinite(score) || score <= 0) continue;
    const level = Math.min(4, score), interval = level >= 3 ? 7 : 1;
    // The old app mixed skills; only seed the default flashcard direction.
    state.cards[cardKey(w.id, 'cards-de-ua')] = { interval, ease: 2.5, due: now + interval * DAY, introducedAt: now - DAY, updatedAt: now, reviews: Math.ceil(level), lapses: 0, lastRating: 'good' };
  }
  state.legacyStats = { right: number(raw.right, 1e9) ? raw.right : 0, wrong: number(raw.wrong, 1e9) ? raw.wrong : 0 };
  return state;
}
export function loadState(storage, words, now = Date.now()) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) return { state: validateState(JSON.parse(raw)) };
    raw = storage.getItem(LEGACY_KEY);
    if (raw !== null) {
      const state = migrateLegacy(JSON.parse(raw), words, now);
      if (!saveState(storage, state)) return { state, readOnly: true, warning: 'Старий прогрес прочитано, але браузер не дозволяє зберегти новий. Завантажте резервну копію у вкладці «Прогрес».' };
      return { state, migrated: true };
    }
    return { state: emptyState() };
  } catch (error) {
    return { state: emptyState(), readOnly: true, damaged: raw, warning: raw ? 'Збережений прогрес не вдалося прочитати. Його не перезаписано. Відкрийте «Прогрес», щоб зберегти дані або відновити копію.' : 'Браузер заблокував сховище. Прогрес збережеться лише до закриття сторінки; завантажте резервну копію.' };
  }
}
export function saveState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}
export function mergeStates(current, incoming) {
  const next = validateState(current), imported = validateState(incoming);
  for (const [key, c] of Object.entries(imported.cards)) if (!next.cards[key] || c.updatedAt > next.cards[key].updatedAt) next.cards[key] = c;
  // Import restores pauses, never silently unpauses existing words.
  next.suspended = { ...next.suspended, ...imported.suspended };
  for (const [day, h] of Object.entries(imported.history)) {
    const prior = next.history[day];
    if (!prior || h.reviews > prior.reviews) next.history[day] = h;
  }
  next.legacyStats ||= imported.legacyStats;
  return next;
}
