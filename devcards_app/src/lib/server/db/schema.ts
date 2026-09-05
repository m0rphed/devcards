// better-auth-owned tables (user, session, account, verification).
// Regenerate via `npm run auth:schema` — don't hand-edit auth.schema.ts.
export * from './auth.schema';

// Hand-written domain schema (collections, cards, review_state, quiz_*, ...).
export * from './domain.schema';
