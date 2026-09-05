import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/domain.schema';

/**
 * Cards in one collection, optionally filtered by full-text query and/or tag.
 * `query` goes through `websearch_to_tsquery` (understands quoted phrases,
 * `-exclude`, plain "AND" spacing) against the generated `search_vector`
 * column, ranked by `ts_rank`; with no query, falls back to newest-first.
 */
export async function listCollectionCards(
	collectionId: string,
	opts: { query?: string; tag?: string } = {}
) {
	const { query, tag } = opts;
	const rank = query
		? sql<number>`ts_rank(${cards.searchVector}, websearch_to_tsquery('russian', ${query}))`
		: sql<number>`0`;

	const rows = await db
		.select({ card: cards, rank })
		.from(cards)
		.where(
			and(
				eq(cards.collectionId, collectionId),
				query ? sql`${cards.searchVector} @@ websearch_to_tsquery('russian', ${query})` : undefined,
				tag
					? sql`exists (
							select 1 from card_tags ct
							join tags t on t.id = ct.tag_id
							where ct.card_id = ${cards.id} and t.name = ${tag}
						)`
					: undefined
			)
		)
		.orderBy(query ? desc(rank) : desc(cards.createdAt));

	return rows.map((r) => r.card);
}
