import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import { createEmptyCard, fsrs, State, type Card, type Grade } from 'ts-fsrs';
import { db } from '$lib/server/db';
import { cards, reviewState, type CardContent } from '$lib/server/db/domain.schema';

// One scheduler instance, default parameters (FSRS-6 weights bundled with the
// library, 90% request retention). Swap for generatorParameters({...}) later
// if we ever want to tune retention/interval caps.
const f = fsrs();

const DB_STATES = ['new', 'learning', 'review', 'relearning'] as const;
type DbState = (typeof DB_STATES)[number];

function dbStateToFsrs(state: DbState): State {
	return DB_STATES.indexOf(state) as State;
}

function fsrsStateToDb(state: State): DbState {
	return DB_STATES[state];
}

type ReviewStateRow = typeof reviewState.$inferSelect;

/** Reconstructs a ts-fsrs `Card` from our row, or a brand-new one if the user never studied this card. */
function toFsrsCard(row: ReviewStateRow | undefined): Card {
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

function fromFsrsCard(card: Card) {
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

export type StudyCard = {
	id: string;
	type: 'basic' | 'cloze' | 'multiple_choice';
	content: CardContent;
};

/** Next card due for this user in this collection (new cards count as due immediately), plus how many are left. */
export async function getNextDueCard(
	collectionId: string,
	userId: string
): Promise<{ card: StudyCard; remaining: number } | { card: null; remaining: 0 }> {
	const now = new Date();

	const rows = await db
		.select({ card: cards, review: reviewState })
		.from(cards)
		.leftJoin(reviewState, and(eq(reviewState.cardId, cards.id), eq(reviewState.userId, userId)))
		.where(
			and(
				eq(cards.collectionId, collectionId),
				or(isNull(reviewState.cardId), lte(reviewState.due, now))
			)
		)
		// Due reviews (oldest-due first) before brand-new cards.
		.orderBy(asc(reviewState.due));

	if (rows.length === 0) return { card: null, remaining: 0 };

	const [{ card }] = rows;
	return { card: { id: card.id, type: card.type, content: card.content }, remaining: rows.length };
}

/** Grades one card for this user and persists the resulting FSRS state. */
export async function gradeCard(userId: string, cardId: string, rating: Grade): Promise<void> {
	const [existing] = await db
		.select()
		.from(reviewState)
		.where(and(eq(reviewState.userId, userId), eq(reviewState.cardId, cardId)))
		.limit(1);

	const current = toFsrsCard(existing);
	const { card: next } = f.next(current, new Date(), rating);

	await db
		.insert(reviewState)
		.values({ userId, cardId, ...fromFsrsCard(next) })
		.onConflictDoUpdate({
			target: [reviewState.userId, reviewState.cardId],
			set: fromFsrsCard(next)
		});
}
