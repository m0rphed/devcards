import { and, countDistinct, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cards, reviewActivityDaily, reviewLog, reviewState } from '$lib/server/db/domain.schema';
import type { DbRating, DbState } from '$lib/server/fsrs-mapping';

export type CollectionProgress = { state: DbState; cardCount: number; dueCount: number };

/**
 * Per-state card counts (+ how many of each are due right now) for a
 * collection, from this user's point of view. Backed by the
 * `collection_progress` PL/pgSQL function (drizzle/0003_*.sql) rather than
 * an equivalent query built here: it's the same aggregation
 * getNextDueCard() (srs.ts) implicitly relies on for queue order, named
 * once in SQL so both stay in agreement about what "due" means.
 */
export async function getCollectionProgress(
	collectionId: string,
	userId: string
): Promise<CollectionProgress[]> {
	const result = await db.execute<{ state: DbState; card_count: string; due_count: string }>(
		sql`SELECT * FROM collection_progress(${collectionId}, ${userId})`
	);
	return result.map((row) => ({
		state: row.state,
		cardCount: Number(row.card_count),
		dueCount: Number(row.due_count)
	}));
}

export type DailyActivity = { day: Date; reviews: number; correct: number; incorrect: number };

/** This user's review activity for the last `days` days, oldest first — feeds a small activity/streak widget. */
export async function getReviewActivity(userId: string, days: number): Promise<DailyActivity[]> {
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	const rows = await db
		.select({
			day: reviewActivityDaily.day,
			reviews: reviewActivityDaily.reviews,
			correct: reviewActivityDaily.correct,
			incorrect: reviewActivityDaily.incorrect
		})
		.from(reviewActivityDaily)
		.where(and(eq(reviewActivityDaily.userId, userId), gte(reviewActivityDaily.day, since)))
		.orderBy(desc(reviewActivityDaily.day));

	return rows.map((r) => ({
		day: r.day,
		reviews: Number(r.reviews),
		correct: Number(r.correct),
		incorrect: Number(r.incorrect)
	}));
}

export type GradeDistribution = { rating: DbRating; count: number };

/**
 * All-time count of each grading outcome across every collection this user
 * studies — feeds the profile page's grade-distribution chart. `review_log`
 * is append-only (see domain.schema.ts), so this is a plain GROUP BY over
 * its existing `(user_id, reviewed_at)` index — no new schema needed.
 */
export async function getGradeDistribution(userId: string): Promise<GradeDistribution[]> {
	const rows = await db
		.select({ rating: reviewLog.rating, count: sql<number>`count(*)::int` })
		.from(reviewLog)
		.where(eq(reviewLog.userId, userId))
		.groupBy(reviewLog.rating);
	return rows;
}

export type FsrsStateDistribution = { state: DbState; count: number };

/**
 * How many cards currently sit in each FSRS state, across every collection
 * — only among cards this user has reviewed at least once (a `review_state`
 * row only exists once a card's been graded). Deliberately does NOT also
 * report a "new, never studied" bucket: that would require enumerating
 * every card in every collection this user can access (owned + shared +
 * public) rather than a plain query against one table, for a number that's
 * less interesting than the studied-cards breakdown anyway.
 */
export async function getFsrsStateDistribution(userId: string): Promise<FsrsStateDistribution[]> {
	const rows = await db
		.select({ state: reviewState.state, count: sql<number>`count(*)::int` })
		.from(reviewState)
		.where(eq(reviewState.userId, userId))
		.groupBy(reviewState.state);
	return rows;
}

/**
 * Consecutive most-recent days with at least one review, walking back from
 * today. Pure function over getReviewActivity's own result — no separate
 * query, no streak column anywhere. Today having no activity yet doesn't
 * break the streak (you might still study before midnight); yesterday
 * having none does.
 */
export function computeStudyStreak(activity: DailyActivity[]): number {
	const dayKey = (d: Date) => d.toISOString().slice(0, 10);
	const daysWithReviews = new Set(activity.filter((a) => a.reviews > 0).map((a) => dayKey(a.day)));

	const cursor = new Date();
	if (!daysWithReviews.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);

	let streak = 0;
	while (daysWithReviews.has(dayKey(cursor))) {
		streak++;
		cursor.setUTCDate(cursor.getUTCDate() - 1);
	}
	return streak;
}

/** correct / (correct + incorrect) across the given activity window, as a 0-100 integer percentage — null with zero reviews (nothing to divide). */
export function computeRetentionRate(activity: DailyActivity[]): number | null {
	const correct = activity.reduce((sum, a) => sum + a.correct, 0);
	const incorrect = activity.reduce((sum, a) => sum + a.incorrect, 0);
	const total = correct + incorrect;
	return total === 0 ? null : Math.round((correct / total) * 100);
}

export type DeletionImpact = { cardCount: number; studierCount: number };

/**
 * What actually disappears if this collection is deleted right now — for
 * the confirmation prompt, not for the delete itself (CASCADE handles the
 * real removal, see phase02.social_features.md's "we keep CASCADE, just
 * warn" decision). `studierCount` excludes `excludeUserId` (normally the
 * person about to click delete) — the number that matters for a warning is
 * *other* people's progress about to vanish, not the owner's own.
 */
export async function getCollectionDeletionImpact(
	collectionId: string,
	excludeUserId: string
): Promise<DeletionImpact> {
	const [row] = await db
		.select({
			cardCount: countDistinct(cards.id),
			studierCount: countDistinct(reviewState.userId)
		})
		.from(cards)
		.leftJoin(reviewState, and(eq(reviewState.cardId, cards.id), ne(reviewState.userId, excludeUserId)))
		.where(eq(cards.collectionId, collectionId));
	return row;
}

/** Same idea, batched for every card in a collection at once — one query, not one per card in the list. */
export async function getCardDeletionImpacts(
	cardIds: string[],
	excludeUserId: string
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (cardIds.length === 0) return map;

	const rows = await db
		.select({ cardId: reviewState.cardId, studierCount: countDistinct(reviewState.userId) })
		.from(reviewState)
		.where(and(inArray(reviewState.cardId, cardIds), ne(reviewState.userId, excludeUserId)))
		.groupBy(reviewState.cardId);

	for (const row of rows) map.set(row.cardId, row.studierCount);
	return map;
}
