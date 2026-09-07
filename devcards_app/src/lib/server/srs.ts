import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import { fsrs, type Grade } from 'ts-fsrs';
import { db } from '$lib/server/db';
import { cards, reviewLog, reviewState, type CardContent } from '$lib/server/db/domain.schema';
import { fromFsrsCard, fsrsStateToDb, gradeToDb, toFsrsCard } from '$lib/server/fsrs-mapping';

// One scheduler instance, default parameters (FSRS-6 weights bundled with the
// library, 90% request retention). Swap for generatorParameters({...}) later
// if we ever want to tune retention/interval caps.
const f = fsrs();

export type StudyCard = {
	id: string;
	type: 'basic' | 'cloze' | 'multiple_choice';
	content: CardContent;
};

/**
 * Next card due for this user in this collection (new cards count as due
 * immediately), plus how many are left.
 *
 * `excludeIds` backs the study UI's "swipe up to skip" gesture (see
 * FlipCard.svelte / StudyCardView.svelte): skipping only reorders this
 * session, it never actually shrinks the queue, so `remaining` is always
 * computed from the *full* due set, and if every remaining due card has
 * already been skipped, the exclusion is ignored rather than ending the
 * session early — skipped cards come back around instead of vanishing.
 */
export async function getNextDueCard(
	collectionId: string,
	userId: string,
	excludeIds: string[] = []
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

	const excludeSet = new Set(excludeIds);
	const { card } = rows.find((r) => !excludeSet.has(r.card.id)) ?? rows[0];
	return { card: { id: card.id, type: card.type, content: card.content }, remaining: rows.length };
}

/**
 * Grades one card for this user: persists the new current FSRS state
 * (review_state, as before) *and* appends a row to review_log recording how
 * this specific review went — state/due/stability/difficulty as they stood
 * going into it, not the (now-current) values coming out. Both writes share
 * one transaction: a review that's in the visible schedule but missing from
 * the history (or vice versa) would be a worse bug than losing the review
 * entirely.
 */
export async function gradeCard(userId: string, cardId: string, rating: Grade): Promise<void> {
	const [existing] = await db
		.select()
		.from(reviewState)
		.where(and(eq(reviewState.userId, userId), eq(reviewState.cardId, cardId)))
		.limit(1);

	const current = toFsrsCard(existing);
	const now = new Date();
	const { card: next, log } = f.next(current, now, rating);

	await db.transaction(async (tx) => {
		await tx.insert(reviewLog).values({
			userId,
			cardId,
			rating: gradeToDb(rating),
			stateBefore: fsrsStateToDb(log.state),
			dueBefore: log.due,
			stabilityBefore: log.stability,
			difficultyBefore: log.difficulty,
			scheduledDays: log.scheduled_days,
			reviewedAt: log.review
		});

		await tx
			.insert(reviewState)
			.values({ userId, cardId, ...fromFsrsCard(next) })
			.onConflictDoUpdate({
				target: [reviewState.userId, reviewState.cardId],
				set: fromFsrsCard(next)
			});
	});
}
