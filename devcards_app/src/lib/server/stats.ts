import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { reviewActivityDaily } from '$lib/server/db/domain.schema';
import type { DbState } from '$lib/server/fsrs-mapping';

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
