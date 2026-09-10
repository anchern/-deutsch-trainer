export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function counterBadges(count) {
  return `<span class="counter-badges"><span class="count-dot new-count" aria-label="${count.newToday} нових на сьогодні" title="Нових на сьогодні: ${count.newToday}. Ще не вчили: ${count.new}.">${count.newToday}</span><span class="count-dot due-count" aria-label="${count.due} до повторення" title="До повторення зараз: ${count.due}">${count.due}</span></span>`;
}
export const counterLegend = () => '<p class="counter-legend"><span><span class="legend-dot new-count" aria-hidden="true"></span> Нові на сьогодні</span><span><span class="legend-dot due-count" aria-hidden="true"></span> До повторення</span></p>';
export function learningDetails(word) {
  if (!word.definitionDe && !word.synonyms && !word.antonyms) return '';
  const related = (label, values, empty) => `<div class="word-relations"><h3>${label}</h3>${values?.length ? `<ul>${values.map(v => `<li><span lang="de">${escapeHtml(v.de)}</span>${v.note ? `<span class="relation-note">${escapeHtml(v.note)}</span>` : ''}</li>`).join('')}</ul>` : `<p class="muted small">${empty}</p>`}</div>`;
  return `<div class="learning-details">${word.definitionDe ? `<div class="simple-definition"><h3>Простими словами · A1–A2</h3><p lang="de">${escapeHtml(word.definitionDe)}</p></div>` : ''}<div class="relations-grid">${related('Синоніми та близькі вирази',word.synonyms,'Немає прямого поширеного відповідника.')}${related('Антоніми та протилежності',word.antonyms,'Немає природного антоніма в цьому значенні.')}</div></div>`;
}
