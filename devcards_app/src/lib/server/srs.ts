import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import { fsrs, type Grade } from 'ts-fsrs';
import { db } from '$lib/server/db';
import { cards, reviewState, type CardContent } from '$lib/server/db/domain.schema';
import { fromFsrsCard, toFsrsCard } from '$lib/server/fsrs-mapping';

// One scheduler instance, default parameters (FSRS-6 weights bundled with the
// library, 90% request retention). Swap for generatorParameters({...}) later
// if we ever want to tune retention/interval caps.
const f = fsrs();

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
