# Oral recall refresh — acceptance verification

Baseline: `e70c87db9b6ad2c7328a5a26b9b6bc5102c526e6` (`main`). Vocabulary IDs, legacy keys, words, and examples are unchanged. The working branch is `codex/oral-recall-refresh`; production is not deployed.

## Automated evidence

`npm test`: **51 passed, 0 failed**. `npm run build`: **passed**, 3 topics / 155 entries / 153 unique IDs; regenerated `sw.js`. `git diff --check`: passed.

The suite checks the scheduler, storage, content, presentation, offline worker and actual application controller (isolated DOM/storage adapters). The controller tests exercise reveal/rate, real persistence, reload, portions, optional mode isolation, stale-card/run rejection and section restoration. They do not replace browser layout verification.

- Goal 5 permits 12 and 61 primary introductions; repeats, shared IDs and optional formats do not inflate it. Local-day rollover is tested.
- A 61-ID full pass with all Again ratings reaches the last word; an interrupted pass restores its cursor and section. Removed/suspended IDs reconcile without resetting completed positions.
- General counters exclude optional schedules, deduplicate shared IDs, include failed primary attempts in coverage and handle zero active words. Suspending/reactivating retains history.
- Every mode preserves due/interval/ease after repeated successful early practice; failures are recorded. A card's early condition remains frozen until the next opening.
- Primary HTML contains no German answer, definition, example or TTS action before reveal. Reveal alone does not save a review. A repeated rating cannot score the next hidden card.
- v2 primary-only, reverse-only and mixed profiles retain schedules, settings, suspensions and legacy activity; the exact v2 source is backed up. Legacy busbahn migration remains conservative and idempotent.
- v2/v3 backups, repeat imports, newer schedule conflicts, incompatible/older cursors, malformed metadata, damaged storage and quota failure are tested.
- Existing offline tests verify repository subpaths, cache-only navigation/assets and scope-isolated cache cleanup.

## Browser evidence

The live site was inspected before changes. The new app is tested on a separate localhost origin so existing production/local profiles remain untouched.

- Actual Amt pass with goal 5: 12 failed ratings, reload, resume at ID 13, then portions of 20, 20 and 9. Final summary: 61/61 active words, daily goal 61/5; Again on every word did not block new words.
- A mixed v2 profile shows 8 primary due words on home while 30 spelling reviews remain in optional results. Reverse-only and legacy profiles show the migration explanation and no invented primary coverage.
- Successful early recall was verified by exporting the actual browser state: due date, interval, ease and introduction time are unchanged; reviews and early reviews increase by one.
- Actual v2/v3 file import, repeated v3 import, export, and rejection of malformed JSON were exercised through the browser. Invalid import leaves counters unchanged.
- A second tab changing the goal terminates the open card and offers the saved pass. Automated checks also cover the race between a stale rating/suspension and a newer cursor.
- Dictionary search, suspend/reactivate, section filtering, the empty article-eligible group, optional article practice and Space/3 keyboard recall were exercised. Primary coverage remains unchanged after optional practice and after suspension/reactivation.
- Legacy, all-suspended and damaged-storage fixtures display the expected conservative migration, 0/0 coverage and recovery download states.
- 1280×800 and 390×844 show all three topic rows and their action buttons in the initial viewport. Final mobile row bottoms: 536, 679, 821 px. At 320 px the home, topic, dictionary and progress document widths are exactly 320 px.
- A local 20-topic registry renders 20 consistent rows; German/Ukrainian search and an empty result were checked. No fixture or synthetic topic is included in the shipped app.
- Reflow at 640×400 CSS pixels was checked as the layout equivalent of 200% zoom on 1280×800. All rating actions remain reachable with vertical scrolling and no horizontal overflow. The in-app browser did not apply native zoom shortcuts, so actual browser-native 200% zoom remains a manual check.
- Main text/surface contrast: 15.13:1; secondary text/raised surface: 8.11:1; primary button: 8.17:1. Rating text/background pairs exceed 8.8:1. Links/buttons have visible focus and minimum 44-pixel hit heights.
- The TTS action was invoked without a console error; audible quality/availability depends on device voices and was not acoustically assessed.
- All three owned local servers were stopped. Reloading the final app still restored the saved pass at 12/49, revealed a card, saved a Good rating at 13/49, and returned home showing 13/5. This verifies navigation, vocabulary, code assets and persistence without a server.
- Screenshots of home/topic/cards on both viewport sizes, the 61-word completion, reflow and offline state accompany the review report.

## Boundaries

Self-ratings do not assess pronunciation or overall language proficiency. Text is fully functional without a German TTS voice. Existing source editions remain unconfirmed. Browser storage has no transactional multi-writer guarantees; the application rejects observable stale work and advises one study tab. Backup history merging is conservative, not an exact union of independently recorded multi-device events. Existing v2-only clients should be closed before using v3; old app code cannot read a newer backup schema. Offline worker upgrades activate after old tabs close.
