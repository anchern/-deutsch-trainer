export function validateTopics(topics) {
  const topicIds = new Set(), canonical = new Map();
  if (!Array.isArray(topics) || !topics.length) throw new Error('Немає тем у словнику.');
  for (const topic of topics) {
    if (!/^[a-z0-9-]+$/.test(topic.id) || topicIds.has(topic.id) || !topic.title || !topic.uk || !Array.isArray(topic.sections) || !Array.isArray(topic.words) || !topic.words.length) throw new Error('Некоректна структура теми.');
    topicIds.add(topic.id);
    const sections = new Set(topic.sections.map(s => s.id)), ids = new Set();
    if (sections.size !== topic.sections.length || topic.sections.some(s => !s.id || !s.title || !s.uk)) throw new Error('Некоректні розділи теми.');
    for (const w of topic.words) {
      if (!/^[a-z0-9-]+$/.test(w.id) || ids.has(w.id) || !sections.has(w.section) || typeof w.de !== 'string' || !w.de.trim() || typeof w.uk !== 'string' || !w.uk.trim() || ![null, 'der', 'die', 'das', 'der/die'].includes(w.article)) throw new Error(`Некоректне слово: ${w.id}`);
      ids.add(w.id);
      const shared = canonical.get(w.id);
      if (shared && (shared.de !== w.de || shared.uk !== w.uk || shared.article !== w.article || !!shared.plural !== !!w.plural)) throw new Error(`Конфлікт спільного слова: ${w.id}`);
      if (w.accepted && (!Array.isArray(w.accepted) || w.accepted.some(a => typeof a !== 'string' || !a.trim()))) throw new Error(`Некоректні варіанти: ${w.id}`);
      if (w.definitionDe !== undefined && (typeof w.definitionDe !== 'string' || !w.definitionDe.trim())) throw new Error(`Некоректне пояснення: ${w.id}`);
      for (const field of ['synonyms', 'antonyms']) {
        if (w[field] !== undefined && (!Array.isArray(w[field]) || w[field].some(v => !v || typeof v.de !== 'string' || !v.de.trim() || (v.note !== undefined && typeof v.note !== 'string')))) throw new Error(`Некоректні ${field}: ${w.id}`);
      }
      if (shared && ['definitionDe', 'synonyms', 'antonyms'].some(field => JSON.stringify(shared[field]) !== JSON.stringify(w[field]))) throw new Error(`Конфлікт пояснень спільного слова: ${w.id}`);
      canonical.set(w.id, shared || w);
    }
  }
  return topics;
}
export async function loadTopics() {
  const get = async path => { const r = await fetch(path); if (!r.ok) throw new Error(`Не вдалося завантажити ${path}`); return r.json(); };
  const manifest = await get('./data/topics.json');
  if (manifest.version !== 1 || !Array.isArray(manifest.topics) || manifest.topics.some(p => !/^topics\/[a-z0-9-]+\.json$/.test(p))) throw new Error('Некоректний список тем.');
  return validateTopics(await Promise.all(manifest.topics.map(p => get(`./data/${p}`))));
}
export function wordsIn(topics, topicId = 'all', sectionId = 'all') {
  const found = new Map();
  for (const t of topics.filter(t => topicId === 'all' || t.id === topicId)) {
    for (const w of t.words.filter(w => sectionId === 'all' || w.section === sectionId)) if (!found.has(w.id)) found.set(w.id, w);
  }
  return [...found.values()];
}
export function fullDe(word) {
  if (word.article === 'der/die') return word.de.split(' / ').map((part, i) => `${i === 0 ? 'der' : 'die'} ${part}`).join(' / ');
  return word.article ? `${word.article} ${word.de}` : word.de;
}
export const normalize = s => s.normalize('NFC').trim().toLocaleLowerCase('de').replace(/[„“”"]/g, '').replace(/\s+/g, ' ');
export function checkSpelling(word, input) {
  const accepted = [word.de, fullDe(word), ...(word.accepted || [])];
  if (word.article === 'der/die') accepted.push(...word.de.split(' / '), ...fullDe(word).split(' / '));
  return accepted.some(value => normalize(value) === normalize(input));
}
export function optionsFor(word, words, field, random = Math.random) {
  const value = w => field === 'uk' ? w.uk : fullDe(w);
  const correct = value(word);
  // A synonym with the same translation would also be a correct reverse answer.
  const pool = [...new Set(words.filter(w => w.id !== word.id && (field === 'uk' || w.uk !== word.uk)).map(value))].filter(v => v !== correct);
  const shuffle = values => { for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; } return values; };
  return shuffle([correct, ...shuffle(pool).slice(0, 3)]);
}
