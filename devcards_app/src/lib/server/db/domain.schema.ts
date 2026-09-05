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
	primaryKey,
	check
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { citext, tsvector } from './custom-types';

// Hand-written domain schema for devcards. See ../../../../phase01.schema_design.md
// for the full rationale behind every table/index/type choice below.
//
// `users` / session & token storage are NOT redefined here — better-auth already
// owns `user`, `session`, `account`, `verification` (see ./auth.schema.ts, generated
// via `npm run auth:schema`). Every FK to "a user" below points at `user.id`.

export const collectionRole = pgEnum('collection_role', ['viewer', 'editor']);
export const cardType = pgEnum('card_type', ['basic', 'cloze', 'multiple_choice']);

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
			.where(sql`${table.isPublic} = true`)
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

export const cards = pgTable(
	'cards',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		collectionId: uuid('collection_id')
			.notNull()
			.references(() => collections.id, { onDelete: 'cascade' }),
		type: cardType('type').notNull(),
		content: jsonb('content').notNull().$type<CardContent>(),
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
