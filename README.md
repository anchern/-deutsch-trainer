# Deutsch Trainer

A static German–Ukrainian vocabulary trainer with independent exercise schedules, topic-based learning, and device-local progress. Host it on GitHub Pages or any static hosting service. No accounts, backend, database, or browser runtime dependencies are required.

Project documentation, pull request titles/descriptions, and commit messages are written in **English**. The learner interface remains Ukrainian; learning content uses German and Ukrainian. See `AGENTS.md` for contributor conventions.

## Features

- **Mit Bus und Bahn:** all 45 original entries from page 76, including article explanations.
- **Unsere neue Wohnung:** all 49 entries from page 84, with Ukrainian translations and examples for all 12 verbs.
- **Auf dem Amt:** all 50 main entries from page 92, plus 11 parenthetical terms for addresses, marital status, and gender. Family pairs follow the existing paired-word format; all 13 verbs include examples.
- **153 unique words** across 155 topic entries. Shared words such as Stadtzentrum and warten keep the same identifier and progress.
- Study a topic, a section, or all topics together. Choose from six visible formats: flashcards in both directions, multiple choice in both directions, articles, and spelling.
- Blue count badges show new cards available **today** under the daily limit. Amber badges show cards **due now**. Tooltips also show the total number of unseen cards. Each direction of flashcards has its own badges.
- Topic and home review totals include **every exercise format**. They count scheduled reviews, so the same word can contribute more than once when due in different formats. The banner also reports the number of unique due words and opens a format with work available.
- Counts refresh at ten-second intervals and when the page regains focus or visibility. Active cards are never interrupted. Section filters, article eligibility, pauses, and per-mode daily limits are respected.
- All published words have short A1–A2-oriented German definitions that avoid the target word, plus synonym and antonym lists where applicable. Contextual, descriptive, regional, and approximate equivalents are explicitly labelled. Empty lists state that no natural direct equivalent/opposite is provided.
- Word explanations are available after revealing/judging an answer and in the dictionary. They do not reveal answers before a learner responds.
- Session completion offers **return to the current topic**, preserving its section and exercise format, as well as continue and all-topics actions.
- Local progress, automatic legacy migration, JSON backup/import, word suspension, German speech using device voices, and offline support after the first successful load.

## Run and validate

Requires Node.js 22 or newer. There are no dependencies, so `npm install` is unnecessary.

```sh
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. Use `npm run dev` to serve source files while editing. Set `PORT` to use a different local port. The included server is for local development, not production hosting.

Vocabulary is loaded using `fetch`, so opening `index.html` through `file://` is not supported. Use a static HTTP server. Service workers need HTTPS or localhost. If an offline copy is already active, build the update, reload once to let the browser discover it, close all tabs for the app, and reopen it. During development, the service worker can instead be unregistered through browser developer tools.

Tests cover content integrity, shared IDs, simple definitions, safe lexical metadata rendering, review intervals, cross-mode totals, daily budgets, suspension, legacy migration, backup validation/merge, and offline cache isolation.

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

Overdue cards come first, oldest due date first. Future reviews are excluded until due. New cards follow vocabulary order within a limit of 5, 10, 20, or 50 per local calendar day. This limit spans topics but is separate for each exercise mode. A session contains at most 20 cards. After a failed answer, the card is available in a later session once its minute has passed.

Card keys are `wordId::mode`. The six independent modes are `cards-de-ua`, `cards-ua-de`, `de-ua`, `ua-de`, `article`, and `spell`. Knowing an article does not hide a word in the spelling exercise. Word suspension applies across all formats and can be reversed in the dictionary.

Home/topic mastery counts unique words with an interval of at least 21 days in **at least one** format. Mode-specific counts measure that mode only. The progress page explicitly labels its separate default-flashcard mastery metric. The dictionary's due filter and due labels include all formats.

## Progress and recovery

- State is stored in `localStorage['deutsch-trainer:v2']`: schema version, cards, suspended words, settings, daily review counts, and legacy statistics.
- Legacy `busbahn-progress` positive scores seed only `cards-de-ua`: scores 1–2 schedule a review in one day; scores 3–4 in seven days. Other formats start fresh because the old state mixed skills. Original data is retained.
- Unreadable stored data is not automatically overwritten. The interface offers a recovery download. Blocked storage or quota errors produce a warning and keep usable state in memory where possible.
- Import validates before writing, keeps the newest `updatedAt` per card, unions pauses, and keeps the larger daily history instead of adding duplicate counts. The current daily limit is preserved. This prevents repeated-import inflation but is not an exact merge of independent histories from multiple devices.
- Changes in another tab terminate an open study session and load the new state. Browser storage is not transactional: study in one tab per device.
- Private browsing, browser cleanup, storage eviction, and changing origins may remove or hide progress. Download periodic backups.

## Structure

```text
data/topics.json       Topic registry
data/topics/*.json     Vocabulary and lexical learning context
src/content.js         Content loading/validation and answer handling
src/scheduler.js       Review scheduling, queues and cross-mode counters
src/storage.js         Versioned persistence, migration and backup merging
src/presentation.js    Accessible badges and escaped lexical-context markup
src/app.js             Navigation, views and learning sessions
src/styles.css         Responsive interface
scripts/build.mjs      Validation and static build
scripts/sw-template.js Offline cache template
sw.js                  Generated service worker; commit after building
tests/*.test.js        Content, scheduling, persistence and offline tests
AGENTS.md              Repository conventions, including English documentation
```
