import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { collectionRatingSummary, collectionRatings } from '$lib/server/db/domain.schema';

export type RatingSummary = { avgRating: number; ratingCount: number };

/** Upsert-on-composite-PK — rating again just replaces your previous one, same shape as review_state. */
export async function rateCollection(collectionId: string, userId: string, rating: number): Promise<void> {
	if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Rating must be 1-5');
	await db
		.insert(collectionRatings)
		.values({ collectionId, userId, rating })
		.onConflictDoUpdate({ target: [collectionRatings.collectionId, collectionRatings.userId], set: { rating } });
}

export async function removeRating(collectionId: string, userId: string): Promise<void> {
	await db
		.delete(collectionRatings)
		.where(and(eq(collectionRatings.collectionId, collectionId), eq(collectionRatings.userId, userId)));
}

export async function getMyRating(collectionId: string, userId: string): Promise<number | null> {
	const [row] = await db
		.select({ rating: collectionRatings.rating })
		.from(collectionRatings)
		.where(and(eq(collectionRatings.collectionId, collectionId), eq(collectionRatings.userId, userId)))
		.limit(1);
	return row?.rating ?? null;
}

/** One collection's rating summary, or null if nobody's rated it yet. */
export async function getRatingSummary(collectionId: string): Promise<RatingSummary | null> {
	const [row] = await db
		.select({ avgRating: collectionRatingSummary.avgRating, ratingCount: collectionRatingSummary.ratingCount })
		.from(collectionRatingSummary)
		.where(eq(collectionRatingSummary.collectionId, collectionId))
		.limit(1);
	return row ?? null;
}

/** Many collections at once (the public-collections listing), keyed by collection id. */
export async function getRatingSummaries(collectionIds: string[]): Promise<Map<string, RatingSummary>> {
	const map = new Map<string, RatingSummary>();
	if (collectionIds.length === 0) return map;

	const rows = await db
		.select({
			collectionId: collectionRatingSummary.collectionId,
			avgRating: collectionRatingSummary.avgRating,
			ratingCount: collectionRatingSummary.ratingCount
		})
		.from(collectionRatingSummary)
		.where(inArray(collectionRatingSummary.collectionId, collectionIds));

	for (const row of rows) {
		map.set(row.collectionId, { avgRating: row.avgRating, ratingCount: row.ratingCount });
	}
	return map;
}
