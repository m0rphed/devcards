import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cards, collections } from '$lib/server/db/domain.schema';
import { user } from '$lib/server/db/auth.schema';
import { getRatingSummaries, type RatingSummary } from '$lib/server/ratings';

export type PublicProfile = {
	id: string;
	name: string;
	image: string | null;
	memberSince: Date;
};

// Email is deliberately excluded — it's in the same `user` row, but nothing
// makes it okay to publish just because it's technically available.
export async function getPublicProfile(userId: string): Promise<PublicProfile | undefined> {
	const [row] = await db
		.select({ id: user.id, name: user.name, image: user.image, memberSince: user.createdAt })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	return row;
}

export type ProfileCollection = {
	id: string;
	title: string;
	description: string | null;
	cardCount: number;
	rating: RatingSummary | null;
};

/** This user's public collections only — never their private or merely-shared-with-others ones. */
export async function getPublicCollectionsByOwner(userId: string): Promise<ProfileCollection[]> {
	const rows = await db
		.select({
			id: collections.id,
			title: collections.title,
			description: collections.description,
			cardCount: count(cards.id)
		})
		.from(collections)
		.leftJoin(cards, eq(cards.collectionId, collections.id))
		.where(and(eq(collections.ownerId, userId), eq(collections.isPublic, true)))
		.groupBy(collections.id)
		.orderBy(desc(collections.createdAt));

	const ratings = await getRatingSummaries(rows.map((r) => r.id));
	return rows.map((r) => ({ ...r, rating: ratings.get(r.id) ?? null }));
}
