# Deutsch Trainer

A static German–Ukrainian vocabulary trainer with independent exercise schedules, topic-based learning, and device-local progress. Host it on GitHub Pages or any static hosting service. No accounts, backend, database, or browser runtime dependencies are required.

Project documentation, pull request titles/descriptions, and commit messages are written in **English**. The learner interface remains Ukrainian; learning content uses German and Ukrainian. See `AGENTS.md` for contributor conventions.

## Features

- **Mit Bus und Bahn:** all 45 original entries from page 76, including article explanations.
- **Unsere neue Wohnung:** all 49 entries from page 84, with Ukrainian translations and examples for all 12 verbs.
- **Auf dem Amt:** all 50 main entries from page 92, plus 11 parenthetical terms for addresses, marital status, and gender. Family pairs follow the existing paired-word format; all 13 verbs include examples.
- **Bei der Arbeit:** 44 entries covering the 40 printed vocabulary rows on lesson 8, page 76 of *Einfach gut! Deutsch für die Integration A2.2, Kurs- und Arbeitsbuch*: 14 paired occupations/roles, 8 safety terms, 15 office entries and 7 dative constructions. The pairs contain 28 occupation forms; the topic contains 58 German forms in total. All 16 verb entries include examples.
- **197 unique words** across 199 topic entries. Shared words such as Stadtzentrum and warten keep the same identifier and progress.
- **One primary path:** Ukrainian cue → recall the German word aloud → reveal the full form and existing context → self-rate. No typing, recording, or speech recognition is required.
- Home, topic, dictionary, and progress counters use unique active word IDs in `cards-ua-de`. Coverage includes unsuccessful attempts; it is not a claim of language proficiency.
- DE → UA flashcards, both multiple-choice directions, articles, and spelling remain optional under a collapsed topic section, with separate schedules and results.
- A soft daily goal of 5/10/20/50 new primary words never blocks learning. Sessions contain up to 20 distinct words and offer continuation.
- Full-topic practice creates a stable, resumable list of all active words in the selected topic/section. Each ID gets one attempt before any optional difficult-word retry. Failures cannot starve unseen words.
- Successful early practice records the attempt but preserves the interval, ease, and due date. Failed early recall returns to the existing one-minute relearning rule. This applies to every mode.
- Compact dark topic rows, bilingual topic search, responsive layouts, keyboard shortcuts, and visible focus states.
- Full German forms, existing notes/examples, definitions, contextual synonyms and antonyms appear after reveal. No vocabulary content or stable IDs have been replaced.
- Optional source metadata explicitly distinguishes verified sources from unknown editions. Existing page numbers are not treated as current homework.
- Local progress, legacy migration, JSON backup/import, suspension, device German voices, and offline support after the first successful load.

## Run and validate

Requires Node.js 22 or newer. There are no dependencies, so `npm install` is unnecessary.

```sh
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. Use `npm run dev` to serve source files while editing. Set `PORT` to use a different local port. The included server is for local development, not production hosting.

Vocabulary is loaded using `fetch`, so opening `index.html` through `file://` is not supported. Use a static HTTP server. Service workers need HTTPS or localhost. If an offline copy is already active, build the update, reload once to let the browser discover it, close all tabs for the app, and reopen it. During development, the service worker can instead be unregistered through browser developer tools.

Tests cover content integrity, stable shared IDs, safe lexical/source metadata, primary-only counters, soft goals, full 61-word passes, early practice, reveal/rating conditions, reload restoration, stale-tab protection, suspension, v2/legacy migration, backup merge, and offline cache isolation. See `docs/verification.md` for the recall-model evidence and `docs/arbeit-verification.md` for the new topic checks.

## Deployment and sharing

`npm run build` validates all registered topics, generates the root `sw.js`, and writes a complete static site to `dist/`. Upload the **contents of `dist/`** to a static host.

Existing GitHub Pages publishing from the repository root can continue unchanged because all runtime files are also present there. Always run the build and commit regenerated `sw.js` after source or vocabulary changes. Relative asset paths support repository URLs such as `/-deutsch-trainer/`.

The `Check trainer` workflow runs tests and the build, verifies that `sw.js` is current, and uploads a `deutsch-trainer-static` artifact. It does not change Pages configuration or deploy automatically.

Share the site URL with friends. Each browser keeps its own independent progress. There is no automatic cross-device sync; use a JSON backup to transfer progress. Speech depends on available German voices, some of which need an internet connection.

Keep the same origin when updating the app. Browser storage belongs to the protocol, hostname, and port, not the GitHub repository. Changing any of those requires backup/import to retain progress. Copies under different paths on the same origin share the progress key. Offline caches, however, are isolated by application scope.

## Add a topic

1. Create `data/topics/<topic-id>.json` using an existing topic or the example below.
2. Add `"topics/<topic-id>.json"` to the `topics` array in `data/topics.json`.
3. Run `npm test` and `npm run build`; commit the topic, registry, and regenerated `sw.js`.

The topic picker, dictionary, counters, and offline cache follow the registry automatically.

```json
{
  "id": "food",
  "title": "Essen und Trinken",
  "uk": "Їжа та напої",
  "description": "Продукти й замовлення в кафе",
  "icon": "book",
  "page": 100,
  "sections": [
    { "id": "drinks", "title": "Getränke", "uk": "Напої" }
  ],
  "words": [
    {
      "id": "wasser",
      "section": "drinks",
      "article": "das",
      "de": "Wasser",
      "uk": "вода",
      "definitionDe": "Diese Flüssigkeit ist klar. Man trinkt sie und wäscht sich damit.",
      "synonyms": [],
      "antonyms": [],
      "note": "Вчіть разом з артиклем: das Wasser.",
      "example": { "de": "Ich trinke Wasser.", "uk": "Я п’ю воду." }
    }
  ]
}
```

The Arbeit list was checked against a supplied photograph of the printed `Lernwortschatz` page (SHA-256 `1331e93a75baec5896553a26cf82810039a40991dffbfbdccff1957f73d0aaad`). Source verification refers to the vocabulary list visible in that photo. The book title comes from the supplied course context; the photograph does not show a title/copyright page, so edition/year/ISBN remain unknown. The photo and handwritten annotations are not shipped. The older Transport topic also has page 76 and is unchanged. Structured translations, explanations and examples are normalized learning material, not a transcription of the handwritten notes.

Office pairs are split into separate stable IDs. Explicit `accepted` aliases support the intended spelling alternatives; synonyms do not implicitly become accepted answers. Paired occupations ask for both forms in primary oral recall, while optional spelling accepts one form as before. An optional word `quizGroup` excludes potentially equivalent choices in both quiz directions without merging words, schedules or spelling answers. The four work-meeting terms use this conservative exclusion group.

Lexical distinctions were checked against [Duden: Kaufmann](https://www.duden.de/rechtschreibung/Kaufmann), [Duden: herunterfahren](https://www.duden.de/rechtschreibung/herunterfahren), and the [telc A2.2 Ukrainian vocabulary list, lesson 8](https://www.telc.net/fileadmin/user_upload/Downloads_Verlag/Einfach_gut/Wortschatzlisten/Einfach_gut_A2.2_Wortschatzliste_Ukrainisch.pdf). The broader telc list is not the source of additional cards. Definitions and examples are learner-oriented explanations, not copied dictionary definitions.

Optional topic `source` fields are `book`, `level`, `edition`, `lesson`, `printedPage`, `url` (HTTP/HTTPS), and `verification` (`unverified` or `verified`). Omit unknown values. A missing source defaults to an unconfirmed edition; legacy `page` remains a printed-page hint only. Do not infer a book edition or homework assignment from a page number.

Topic fields `id`, `title`, `uk`, `sections`, and `words` are required. Also supply `description`, `page`, and `icon` (`home`, `train`, `book`, or `cards`) for complete presentation. Word fields `id`, `section`, `article`, `de`, and `uk` are required.

- IDs use lowercase Latin letters, numbers, and hyphens. **Never change a published word ID** merely to fix its spelling or translation; the ID is its progress key.
- Reuse an ID across topics only for the same word and meaning. Shared entries must agree on `de`, `uk`, `article`, `plural`, `definitionDe`, `synonyms`, and `antonyms`. Distinct meanings need different IDs, such as `stock-floor` and `stock-stick`.
- Use `"article": null` for verbs, adjectives, and phrases. Keep necessary phrase forms in `de`, such as `eine Wohnung besichtigen` or `den Müll trennen`.
- Set `"plural": true` for plural-only entries such as `die Nebenkosten`; they are excluded from the singular-gender exercise.
- `accepted` lists additional correct spellings, for example `["WG", "Wohngemeinschaft", "die WG", "die Wohngemeinschaft"]`. Synonyms are learning context, **not automatically accepted spelling answers**: contextual equivalents are not always interchangeable.
- `definitionDe` is plain German text. Use short, concrete A1–A2-oriented sentences without the target word. Do not copy dictionary definitions verbatim.
- `synonyms` and `antonyms` are arrays of `{ "de": "…", "note": "…" }`. `note` is optional Ukrainian context. Label approximate synonyms, opposite roles, spatial contrasts, and descriptive paraphrases. Do not invent opposites for concrete nouns such as Bahnhof or Balkon; use `[]`.
- `note` and `example` are optional. All strings are plain text, not HTML. The new lexical fields remain optional at runtime for older/custom topics; bundled content tests require every published word to include them.
- `legacyKey` exists only for original words and must remain unchanged. Do not add it to new topics.
- Removing a topic from the registry does not delete stored progress. Reintroducing its stable IDs restores access to the existing schedules.

The German explanations are original learner-oriented paraphrases, not certified CEFR assessments. Contextual vocabulary was checked against references including [Duden: Wohngemeinschaft](https://www.duden.de/rechtschreibung/Wohngemeinschaft), [Wiktionary: Einweihungsparty](https://de.wiktionary.org/wiki/Einweihungsparty), and [Verbraucherzentrale: Was sind Nebenkosten?](https://www.verbraucherzentrale.nrw/sites/default/files/2018-11/4-2_AB_Was_sind_Nebenkosten.pdf). These support specific lexical choices, not every entry or a legal interpretation of rental charges.

## Scheduling

The app follows spaced-repetition principles and the four ratings described in the [Anki manual](https://docs.ankiweb.net/studying.html#answer-buttons). It uses a **small custom algorithm**, not FSRS, exact SM-2, or an Anki-compatible deck format.

| Rating | New / relearning card | Review card |
| --- | --- | --- |
| Again | 1 minute | 1 minute; return to learning |
| Hard | 10 minutes | Previous interval × 1.2, at least +1 day |
| Good | 1 day | Previous interval × ease |
| Easy | 4 days | Previous interval × ease × 1.3 |

Ease starts at 2.5 and stays between 1.3 and 3.5. Intervals are capped at 365 days. Rating buttons show the actual next interval. Incorrect quiz/spelling answers allow only Again. Correct answers can be rated by difficulty. **Progress is saved when a rating is selected**, not simply when the answer is revealed.

Due cards come first, oldest due date first; new cards follow vocabulary order. The daily goal is a recommendation for **new unique primary words**, counted once on the local calendar day of their first rating. It does not cap the queue, create catch-up obligations, or limit optional practice. Counts can exceed the goal, e.g. 35/20.

`PRIMARY_MODE` is `cards-ua-de`; existing `wordId::cards-ua-de` records are used directly. The other five mode keys remain independent: `cards-de-ua`, `de-ua`, `ua-de`, `article`, and `spell`. Their attempts never raise primary coverage, consume the primary goal, or create a home-page obligation. Word suspension applies across all modes without deleting history.

Ordinary learning snapshots due and new IDs in a stable pass, divided into portions of at most 20 words. Full-topic practice includes future-due words, labels these as additional practice, and excludes suspended IDs. A new portion resumes the saved cursor instead of rebuilding the list. Difficult IDs remain available on the topic and in portion summaries; retrying them is optional and never blocks the remaining pass.

The early/due condition is captured when a card opens and checked again after a pause. Successful early practice increments attempts but does not increase ease, interval, or due date. An early failure is recorded and follows Again. The unchanged interval formula applies to new and genuinely due cards. Merely revealing an answer changes no schedule. Space reveals; 1–4 self-rate only after reveal and outside controls/input fields.

## Progress and recovery

- Shared general metrics: **processed** = active unique IDs with a primary rating; **new** = active IDs without one; **due** = active primary schedules due now; **long interval** = primary interval ≥21 days; **suspended** is separate. Due and long-interval counts can overlap. Coverage bars show processed/active, never a knowledge score.
- Oral ratings are self-assessments of recall before reveal, not pronunciation, writing, spontaneous speaking, CEFR, or DTZ assessments. Recognizing the answer only after reveal should be rated Again.
- Storage keeps the existing `deutsch-trainer:v2` key and uses additive **schema version 3**. `cards`, `suspended`, `settings.newPerDay`, `history`, and `legacyStats` remain. New fields are `run` (stable IDs, cursor, difficult IDs and scope), `practice` (per-day/per-mode attempts and early attempts), card `earlyReviews`, and optional last-primary-scope/onboarding settings.
- Valid v2 records are validated before migration; the exact original JSON is retained under `deutsch-trainer:v2:before-v3` before the first v3 write. Migration is idempotent. A backup-write/quota failure keeps the usable old state in memory and does not overwrite the original.
- Legacy `busbahn-progress` remains untouched and seeds only `cards-de-ua` conservatively. Positive scores 1–2 schedule one day, scores 3–4 seven days. Neither legacy mode results nor aggregate daily activity are reclassified as primary recall.
- Old `history` is displayed as legacy aggregate activity; `practice` tracks the new per-mode daily statistics. Existing primary-card review counts remain usable as primary lifetime attempts.
- Backups accept v2 and v3. Import validates before writing, keeps the newest per-card `updatedAt`, unions suspensions, keeps larger daily histories without summing repeated imports, and preserves the current goal. A backup run is restored only when newer than the current run and compatible with the merged primary schedules. It cannot rewind newer work.
- Restoration validates topic/section membership and skips removed/suspended IDs while retaining the corresponding completed position. If a pass cannot be resumed, a fresh portion remains available without deleting ratings.
- Changes in another tab terminate an active session. Rating also re-reads storage and checks both the card snapshot and run cursor before writing, rejecting stale work. Browser local storage is not transactional: use one study tab per device.
- Unreadable data is not overwritten; a recovery download is available. Blocked storage or quota errors show a warning and preserve usable in-memory state where possible. Export backups before clearing browser data or changing origins.
- There are no accounts, analytics, backend, automatic vault integration, or cross-device synchronization. TTS depends on device voices and may require internet. The text exercise remains usable without speech.

## Structure

```text
data/topics.json       Topic registry
data/topics/*.json     Vocabulary and lexical learning context
src/content.js         Content loading/validation and answer handling
src/scheduler.js       Review scheduling, primary counters and resumable passes
src/storage.js         Versioned persistence, migration, run/history backup merging
src/presentation.js    Accessible badges and escaped lexical-context markup
src/app.js             Navigation, views and learning sessions
src/styles.css         Responsive interface
scripts/build.mjs      Validation and static build
scripts/sw-template.js Offline cache template
sw.js                  Generated service worker; commit after building
tests/*.test.js        Content, scheduling, persistence and offline tests
AGENTS.md              Repository conventions, including English documentation
```
