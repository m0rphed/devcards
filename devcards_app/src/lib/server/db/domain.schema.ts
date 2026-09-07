import { sql } from 'drizzle-orm';
import {
	pgTable,
	pgEnum,
	uuid,
	text,
	boolean,
	timestamp,
	jsonb,
	real,
	integer,
	index,
	uniqueIndex,
	primaryKey,
	check,
	pgView,
	bigint,
	smallint,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { citext, tsvector, bytea } from './custom-types';
import { CARD_COLORS } from '$lib/card-colors';
import { COLLECTION_COLORS } from '$lib/collection-colors';
import type { CollectionIcon } from '$lib/collection-icons';

// Attachments (card images) allow-listed here and in
// $lib/server/attachments.ts — keep both in sync if this ever changes.
export const ATTACHMENT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

// Hand-written domain schema for devcards. See ../../../../phase01.schema_design.md
// for the full rationale behind every table/index/type choice below.
//
// `users` / session & token storage are NOT redefined here — better-auth already
// owns `user`, `session`, `account`, `verification` (see ./auth.schema.ts, generated
// via `npm run auth:schema`). Every FK to "a user" below points at `user.id`.

export const collectionRole = pgEnum('collection_role', ['viewer', 'editor']);
export const cardType = pgEnum('card_type', ['basic', 'cloze', 'multiple_choice']);
// Values come from $lib/card-colors (the client-facing swatch picker/accent
// styling reads the same list) so the DB constraint and the UI can't drift.
export const cardColor = pgEnum('card_color', [...CARD_COLORS]);
// Separate enum from card_color on purpose — collections get the bigger
// 16-color palette (see $lib/collection-colors.ts), and the two shouldn't
// accidentally end up sharing/expanding one enum meant for a different UI.
export const collectionColor = pgEnum('collection_color', [...COLLECTION_COLORS]);

// Shape of `cards.content`, keyed by `cards.type`. Field names are snake_case
// on purpose — they must match the JSON keys referenced by the CHECK
// constraint and the search_vector expression below (raw jsonb, no
// camelCase mapping layer).
export type CardContent =
	| { front: string; back: string }
	| { text: string }
	| { question: string; options: string[]; correct_index: number };

export const collections = pgTable(
	'collections',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		isPublic: boolean('is_public').notNull().default(false),
		// Cosmetic "book cover" identity for the /collections shelf view — both
		// nullable, null means "no cover styling" (the plain list view is
		// unaffected either way). `icon` has no DB enum on purpose: the
		// curated devicon list (collection-icons.ts) is expected to grow
		// without a migration each time, unlike the fixed 16-color palette.
		color: collectionColor('color'),
		icon: text('icon').$type<CollectionIcon>(),
		// STORED generated column, same construction as cards.searchVector —
		// backs cross-collection search (collection-search.ts), which cards
		// already had (card-search.ts) but collections themselves didn't.
		searchVector: tsvector('search_vector').generatedAlwaysAs(
			sql`to_tsvector('russian', coalesce("title", '') || ' ' || coalesce("description", ''))`
		),
		// Set once, at fork time (see $lib/server/collections.ts's forkCollection)
		// — never on a plain collection. `SET NULL`, deliberately unlike every
		// other FK in this file: a fork must stay fully usable even after its
		// source is deleted, so losing only this provenance breadcrumb is the
		// intended degradation, not a bug (see phase02.social_features.md).
		forkedFromCollectionId: uuid('forked_from_collection_id').references((): AnyPgColumn => collections.id, {
			onDelete: 'set null'
		}),
		// Snapshot of the source's `updated_at` at fork time — compared against
		// its *current* updated_at to answer "has the original changed since I
		// forked it". See the cards_touch_collection trigger (custom migration)
		// for why editing a card now updates this column at all.
		forkedFromUpdatedAt: timestamp('forked_from_updated_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('collections_owner_idx').on(table.ownerId),
		// Partial index: only public collections need to be scanned for the
		// "browse public collections" feed — private ones (the majority) never
		// touch this index.
		index('collections_public_idx')
			.on(table.createdAt)
			.where(sql`${table.isPublic} = true`),
		index('collections_search_idx').using('gin', table.searchVector)
	]
);

export const collectionAccess = pgTable(
	'collection_access',
	{
		collectionId: uuid('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: collectionRole('role').notNull(),
		grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.collectionId, table.userId] }),
		// PK is (collection_id, user_id) — indexes lookups starting from
		// collection_id. "collections shared WITH me" filters by user_id first,
		// which needs its own index or it's a full scan.
		index('collection_access_user_idx').on(table.userId)
	]
);

// Flat (no threading) comments on a collection — visible/postable by anyone
// who can currently view it (owner, explicit share, or public), same rule
// `getCollectionAccess` already uses elsewhere; not restricted to
// subscribers only.
export const collectionComments = pgTable(
	'collection_comments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		collectionId: uuid('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		authorId: text('author_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('collection_comments_collection_idx').on(table.collectionId, table.createdAt)]
);

// One row per (collection, user) — same upsert-on-composite-PK shape as
// review_state: rating a collection again just replaces your previous one.
export const collectionRatings = pgTable(
	'collection_ratings',
	{
		collectionId: uuid('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		rating: smallint('rating').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		primaryKey({ columns: [table.collectionId, table.userId] }),
		check('collection_ratings_rating_check', sql`${table.rating} BETWEEN 1 AND 5`)
	]
);

// Aggregate per collection — a plain VIEW, not a function like
// collection_progress: unlike "what's due for *this* user", an average
// rating isn't parameterized by who's asking, so it can be computed once
// and joined straight into the public-collections listing.
export const collectionRatingSummary = pgView('collection_rating_summary', {
	collectionId: uuid('collection_id').notNull(),
	avgRating: real('avg_rating').notNull(),
	ratingCount: bigint('rating_count', { mode: 'number' }).notNull()
}).as(sql`
	select ${collectionRatings.collectionId} as collection_id,
		-- avg() over smallint naturally comes back as numeric, which
		-- postgres-js returns as a string (no precision loss) — cast to
		-- match the real() builder above so it round-trips as an actual
		-- number, same reasoning as review_activity_daily's explicit
		-- column builders (see the comment there).
		avg(${collectionRatings.rating})::real as avg_rating,
		count(*) as rating_count
	from ${collectionRatings}
	group by ${collectionRatings.collectionId}
`);

export const cards = pgTable(
	'cards',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		collectionId: uuid('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		type: cardType('type').notNull(),
		content: jsonb('content').notNull().$type<CardContent>(),
		// Purely cosmetic, orthogonal to `type`/`content` (hence no CHECK
		// entanglement below) — null means "no tint", the pre-existing look.
		color: cardColor('color'),
		// STORED generated column: recomputed by Postgres on every INSERT/UPDATE,
		// nothing in the app layer has to remember to keep it in sync.
		searchVector: tsvector('search_vector').generatedAlwaysAs(sql`to_tsvector('russian',
			CASE "type"
				WHEN 'basic' THEN coalesce("content" ->> 'front', '') || ' ' || coalesce("content" ->> 'back', '')
				WHEN 'cloze' THEN coalesce("content" ->> 'text', '')
				WHEN 'multiple_choice' THEN coalesce("content" ->> 'question', '')
				ELSE ''
			END
		)`),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('cards_collection_idx').on(table.collectionId),
		index('cards_search_idx').using('gin', table.searchVector),
		// Ties `content`'s required keys to `type` — CHECK spanning two columns
		// of the same row.
		check(
			'cards_content_shape_check',
			sql`(${table.type} = 'basic' AND ${table.content} ?& array['front', 'back'])
				OR (${table.type} = 'cloze' AND ${table.content} ? 'text')
				OR (${table.type} = 'multiple_choice' AND ${table.content} ?& array['question', 'options', 'correct_index'])`
		)
	]
);

export const tags = pgTable('tags', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: citext('name').notNull().unique()
});

export const cardTags = pgTable(
	'card_tags',
	{
		cardId: uuid('card_id')
			.notNull()
			.references(() => cards.id, { onDelete: 'cascade' }),
		tagId: uuid('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.cardId, table.tagId] }),
		// Reverse lookup "all cards with tag X" — PK alone only serves
		// "all tags of card X".
		index('card_tags_tag_idx').on(table.tagId)
	]
);

// FSRS's own state machine (New -> Learning/Relearning -> Review), independent of
// card_type. See $lib/server/srs.ts for the mapping to/from ts-fsrs's Card type.
export const fsrsState = pgEnum('fsrs_state', ['new', 'learning', 'review', 'relearning']);

export const reviewState = pgTable(
	'review_state',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		cardId: uuid('card_id')
			.notNull()
			.references(() => cards.id, { onDelete: 'cascade' }),
		// Mirrors ts-fsrs's `Card` 1:1 (minus `elapsed_days`, which the library
		// always recomputes from `due`/`lastReview` and never trusts from input).
		state: fsrsState('state').notNull().default('new'),
		due: timestamp('due', { withTimezone: true }).defaultNow().notNull(),
		stability: real('stability').notNull().default(0),
		difficulty: real('difficulty').notNull().default(0),
		scheduledDays: integer('scheduled_days').notNull().default(0),
		learningSteps: integer('learning_steps').notNull().default(0),
		reps: integer('reps').notNull().default(0),
		lapses: integer('lapses').notNull().default(0),
		lastReview: timestamp('last_review', { withTimezone: true })
	},
	(table) => [
		// PK on (user_id, card_id), not just card_id: a public collection is
		// studied by many users, each with their own independent progress on
		// the same card.
		primaryKey({ columns: [table.userId, table.cardId] }),
		// The single hottest query in the app: "what's due for this user right
		// now" — WHERE user_id = ? AND due <= now(). Without this composite
		// index it's a full table scan on every review session opened.
		index('review_state_due_idx').on(table.userId, table.due)
	]
);

// ts-fsrs's Rating (minus Manual, which the app never sends — see Grade in
// srs.ts). Kept as its own enum rather than a raw 1-4 smallint for the same
// reason fsrs_state is an enum and not a raw 0-3 int: a `rating = 'good'` row
// is self-documenting in `psql`/pgAdmin without cross-referencing ts-fsrs's
// source, an int matching an external library's internal numbering isn't.
export const reviewRating = pgEnum('review_rating', ['again', 'hard', 'good', 'easy']);

// One row per FSRS grading event, append-only, never updated — the history
// `review_state` doesn't keep (every grade overwrites it with the new
// current state). Same role here as quiz_attempts plays for quiz mode:
// quiz mode already got this right (session + per-answer history); SRS
// study mode didn't, until now.
//
// The *_before columns are the review's ts-fsrs `ReviewLog.state` /
// `.due` / `.stability` / `.difficulty` — the card's state going INTO this
// review, not the (already-current, in review_state) state coming out of
// it. That's what lets a query answer "how did this review play out" (was
// it overdue? how stable was it before this grade?) without needing the
// *next* row in the same card's history.
export const reviewLog = pgTable(
	'review_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		cardId: uuid('card_id')
			.notNull()
			.references(() => cards.id, { onDelete: 'cascade' }),
		rating: reviewRating('rating').notNull(),
		stateBefore: fsrsState('state_before').notNull(),
		dueBefore: timestamp('due_before', { withTimezone: true }).notNull(),
		stabilityBefore: real('stability_before').notNull(),
		difficultyBefore: real('difficulty_before').notNull(),
		scheduledDays: integer('scheduled_days').notNull(),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull()
	},
	(table) => [
		// "my review history, most recent first" / feeds review_activity_daily.
		index('review_log_user_reviewed_idx').on(table.userId, table.reviewedAt),
		// "this card's full review history".
		index('review_log_card_idx').on(table.cardId, table.reviewedAt)
	]
);

// Per-user daily review activity (count + correct/incorrect split) — an
// Anki-style activity calendar/heatmap, computed straight from review_log.
// A plain view, not materialized: at this project's scale the underlying
// table is small enough that re-aggregating on every read is cheap, and a
// plain view never goes stale (no refresh policy to think about).
//
// Declared with explicit column builders (the "manual" pgView form) rather
// than inferring them from a query builder .as(qb => ...): raw sql<T>`...`
// projections there come back as bare expressions with no real column type
// attached, so drizzle can't serialize a JS Date into a WHERE ... day >= $1
// comparison against them (confirmed the hard way — this exact query
// against the qb-inferred version threw at runtime). Real column builders
// (timestamp(), bigint()) know how to do that.
export const reviewActivityDaily = pgView('review_activity_daily', {
	userId: text('user_id').notNull(),
	day: timestamp('day', { withTimezone: true }).notNull(),
	reviews: bigint('reviews', { mode: 'number' }).notNull(),
	correct: bigint('correct', { mode: 'number' }).notNull(),
	incorrect: bigint('incorrect', { mode: 'number' }).notNull()
}).as(sql`
	select
		${reviewLog.userId} as user_id,
		date_trunc('day', ${reviewLog.reviewedAt}) as day,
		count(*) as reviews,
		count(*) filter (where ${reviewLog.rating} in ('good', 'easy')) as correct,
		count(*) filter (where ${reviewLog.rating} in ('again', 'hard')) as incorrect
	from ${reviewLog}
	group by ${reviewLog.userId}, date_trunc('day', ${reviewLog.reviewedAt})
`);

export const quizSessions = pgTable(
	'quiz_sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		collectionId: uuid('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
		finishedAt: timestamp('finished_at', { withTimezone: true }),
		score: integer('score'),
		totalQuestions: integer('total_questions').notNull()
	},
	(table) => [index('quiz_sessions_user_idx').on(table.userId, table.startedAt)]
);

// Images pasted/dropped/attached into card markdown (front/back/cloze/
// question text), via carta-md's attachment plugin. Not FK'd to a specific
// card: the upload happens the moment the editor sees the file — before the
// card (or even the collection) is ever saved — so the only durable link
// between an attachment and the card(s) that use it is the `/attachments/id`
// URL sitting in that card's markdown content. Simpler than trying to keep a
// reference count in sync with free-text edits, at the cost of never
// garbage-collecting attachments nobody references anymore (acceptable at
// this project's scale — see KNOWN_RISKS.md).
export const attachments = pgTable(
	'attachments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		mimeType: text('mime_type').notNull(),
		byteSize: integer('byte_size').notNull(),
		// Content hash (hex sha256), computed app-side — dedup key below, and
		// doubles as a stable ETag when serving the file.
		sha256: text('sha256').notNull(),
		data: bytea('data').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		// Re-uploading (or re-pasting) the same image — the same user dragging
		// one screenshot into two different cards — reuses the existing row
		// instead of storing identical bytes twice.
		uniqueIndex('attachments_owner_sha256_idx').on(table.ownerId, table.sha256),
		// "my attachments" / quota-style lookups.
		index('attachments_owner_idx').on(table.ownerId),
		check(
			'attachments_mime_type_check',
			sql`${table.mimeType} = ANY (ARRAY['image/png','image/jpeg','image/webp'])`
		),
		// CHECK constraints must be constant expressions — sql.raw() here, not
		// a plain `sql` template value, or drizzle-kit emits a bound `$1`
		// placeholder that Postgres rejects inside a CHECK.
		check(
			'attachments_byte_size_check',
			sql`${table.byteSize} > 0 AND ${table.byteSize} <= ${sql.raw(String(ATTACHMENT_MAX_BYTES))}`
		)
	]
);

export const quizAttempts = pgTable(
	'quiz_attempts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		quizSessionId: uuid('quiz_session_id')
			.notNull()
			.references(() => quizSessions.id, { onDelete: 'cascade' }),
		cardId: uuid('card_id')
			.notNull()
			.references(() => cards.id, { onDelete: 'cascade' }),
		// Shape depends on the card's type, same idea as cards.content.
		givenAnswer: jsonb('given_answer').notNull(),
		isCorrect: boolean('is_correct').notNull(),
		answeredAt: timestamp('answered_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [index('quiz_attempts_session_idx').on(table.quizSessionId)]
);
