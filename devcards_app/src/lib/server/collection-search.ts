import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { collections } from '$lib/server/db/domain.schema';
import { user as userTable } from '$lib/server/db/auth.schema';

/**
 * Public collections owned by someone else, optionally filtered by
 * full-text query — same construction as card-search.ts's
 * listCollectionCards, applied one level up (across collections
 * themselves, by title/description, instead of within one collection's
 * cards). `query` goes through `websearch_to_tsquery` against the
 * generated `search_vector` column, ranked by `ts_rank`; with no query,
 * falls back to newest-first (the previous, only-ever behavior).
 */
export async function searchPublicCollections(excludeOwnerId: string, query?: string) {
	const rank = query
		? sql<number>`ts_rank(${collections.searchVector}, websearch_to_tsquery('russian', ${query}))`
		: sql<number>`0`;

	const rows = await db
		.select({ collection: collections, ownerName: userTable.name, ownerImage: userTable.image, rank })
		.from(collections)
		.innerJoin(userTable, eq(collections.ownerId, userTable.id))
		.where(
			and(
				eq(collections.isPublic, true),
				ne(collections.ownerId, excludeOwnerId),
				query ? sql`${collections.searchVector} @@ websearch_to_tsquery('russian', ${query})` : undefined
			)
		)
		.orderBy(query ? desc(rank) : desc(collections.createdAt))
		.limit(50);

	return rows.map((r) => ({ collection: r.collection, ownerName: r.ownerName, ownerImage: r.ownerImage }));
}
