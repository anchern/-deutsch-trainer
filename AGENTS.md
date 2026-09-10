# Project conventions

- Write project documentation, pull request titles/descriptions, and commit messages in English.
- Keep the learner interface in Ukrainian and vocabulary content in German with Ukrainian translations.
- Keep the app static and device-local; do not add a backend or runtime dependencies without a concrete requirement.
- Preserve published word IDs and existing progress. Exercise modes keep independent schedules.
- Use simple A1–A2 German definitions without the target word. Mark contextual synonyms/opposites clearly; do not invent antonyms for words without a natural opposite.
- After source or vocabulary changes, run `npm test` and `npm run build`; commit the regenerated `sw.js`.
