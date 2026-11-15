# Bei der Arbeit — acceptance evidence

Baseline: `0ef383696b7080f4f807e2f35b38704aea313b8d`. The existing recall model, schedules, storage schema and visual design are retained.

## Content and source

- The supplied photo matches SHA-256 `1331e93a75baec5896553a26cf82810039a40991dffbfbdccff1957f73d0aaad`. Its 40 printed vocabulary rows are represented by 44 trainer entries: 14 occupations/roles, 8 safety terms, 15 office entries and 7 dative constructions. The paired occupations contain 28 forms; all entries together contain 58 German forms.
- All 14 printed feminine occupations have their specified masculine counterpart, including Arzt/Ärztin, Koch/Köchin, Kaufmann/Kauffrau and Krankenpfleger/Krankenschwester. Pair recall explicitly requests both forms; optional spelling retains its existing one-form acceptance rule.
- All four office pairs retain both entries and explicit reciprocal spelling aliases. The four work-meeting words share a quiz-only ambiguity group; the group does not merge IDs or broaden spelling acceptance.
- Every entry has an original short German definition and explicit relation arrays. All 16 verb entries have the specified examples, translations and grammatical notes. No photo, handwritten notes or private vault paths are shipped.
- Verified source metadata refers to the list visible in the photograph. Book title/context was supplied separately; edition/year/ISBN remain unknown. The older Transport page 76 is a separate unchanged topic. See README for the lexical references.

## Automated validation

`npm test`: **62 passed, 0 failed**. `npm run build`: **passed**, 4 topics / 199 entries / 197 unique IDs, with regenerated `sw.js`. `git diff --check`: passed.

The targeted tests assert the exact ID inventory, section membership, all German forms, occupation pair rendering, 14 article-eligible nouns, all 16 examples and their key grammar, explicit aliases, significant umlauts/NFC, and rejection of `telefonieren` without `mit`, `ausdrücken`, `herunterladen`, and `hilft` as substitutes for the requested infinitives/construction.

Distractor tests use minimal controlled pools in both directions, so a second valid answer cannot escape detection through random sampling. Existing progress, suspensions, backup round trips and a stable old all-topic pass are tested with the expanded registry. The old three vocabulary JSON files, scheduler, storage module and stylesheet are byte-for-byte unchanged from baseline; no migration is introduced.

## Browser validation

All ratings below belong to an isolated disposable localhost profile; no production learner was credited with study results.

- The fourth topic and its direct hash route load; search finds `Arbeit`, `роботі` and `Bei der Arbeit`. Source details show A2.2 / lesson 8 / printed page 76, with edition unknown.
- A primary occupation card contains only the Ukrainian prompt and a request for both forms before reveal. Reveal displays both complete forms with articles and leaves the cursor unchanged until rating.
- Goal 5, all 44 entries rated Again: reload after entry 9 restores position 9/44; subsequent portions of 20 and 15 reach 44/44 and 44/5. All 44 observed answers are distinct; the last is zuschauen. Failures do not starve the remaining list.
- Mobile cards and the long Bürokaufmann/Bürokauffrau pair wrap at 320 px with scrollWidth = 320. Topic and card screenshots were captured at desktop and mobile sizes. Vertical scrolling remains available for long content.
- Dative examples appear after reveal. Actual spelling accepts gehören and decomposed-NFC zuhören, rejects hilft for helfen and bare telefonieren for telefonieren mit, and accepts Architekt alone in the optional occupation spelling exercise. The primary daily count remains 44/5 after optional practice.
- The local server was stopped, then the page was reloaded. The new topic, section filter, office card, grammatical note and example still load from the offline cache. Browser console warnings/errors: none.

The new content does not add voice recording, speech recognition, publisher audio, a language-level assessment, a second progress system, or a new storage schema. TTS uses the existing device-voice mechanism. Acoustic voice quality and unknown publication metadata are not inferred.
