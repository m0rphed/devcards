import { createEmptyCard, type Card, type Grade, type State } from 'ts-fsrs';
import type { reviewState } from '$lib/server/db/domain.schema';

// Pure DB <-> ts-fsrs Card mapping, deliberately split out of srs.ts: no
// `$lib/server/db` import here (which needs DATABASE_URL just to load), so
// this stays trivially unit-testable — see fsrs-mapping.spec.ts.

export const DB_STATES = ['new', 'learning', 'review', 'relearning'] as const;
export type DbState = (typeof DB_STATES)[number];

export function dbStateToFsrs(state: DbState): State {
	return DB_STATES.indexOf(state) as State;
}

export function fsrsStateToDb(state: State): DbState {
	return DB_STATES[state];
}

// ts-fsrs's Grade (Rating minus Manual) is 1-4 — Again=1..Easy=4 — so index
// by grade - 1, same offset-by-one idea as fsrsStateToDb's array lookup.
export const DB_RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type DbRating = (typeof DB_RATINGS)[number];

export function gradeToDb(grade: Grade): DbRating {
	return DB_RATINGS[grade - 1];
}

export type ReviewStateRow = typeof reviewState.$inferSelect;

/** Reconstructs a ts-fsrs `Card` from our row, or a brand-new one if the user never studied this card. */
export function toFsrsCard(row: ReviewStateRow | undefined): Card {
	if (!row) return createEmptyCard(new Date());

	return {
		due: row.due,
		stability: row.stability,
		difficulty: row.difficulty,
		elapsed_days: 0, // always recomputed by the library from due/last_review — never trusted from input
		scheduled_days: row.scheduledDays,
		learning_steps: row.learningSteps,
		reps: row.reps,
		lapses: row.lapses,
		state: dbStateToFsrs(row.state),
		last_review: row.lastReview ?? undefined
	};
}

export function fromFsrsCard(card: Card) {
	return {
		state: fsrsStateToDb(card.state),
		due: card.due,
		stability: card.stability,
		difficulty: card.difficulty,
		scheduledDays: card.scheduled_days,
		learningSteps: card.learning_steps,
		reps: card.reps,
		lapses: card.lapses,
		lastReview: card.last_review ?? null
	};
}
