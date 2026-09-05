import { sql, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cardTags, tags } from '$lib/server/db/domain.schema';

/** "Go, concurrency, Go " -> ["Go", "concurrency"] — trimmed, empty-filtered, case-insensitively deduped. */
export function parseTagNames(raw: string): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const part of raw.split(',')) {
		const name = part.trim();
		const key = name.toLowerCase();
		if (!name || seen.has(key)) continue;
		seen.add(key);
		result.push(name);
	}
	return result;
}

/**
 * Replaces a card's tag set entirely. Upserts tags by name (citext, so
 * case-insensitive) in one batched statement, then relinks card_tags.
 */
export async function setCardTags(cardId: string, tagNames: string[]): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.delete(cardTags).where(eq(cardTags.cardId, cardId));
		if (tagNames.length === 0) return;

		const upserted = await tx
			.insert(tags)
			.values(tagNames.map((name) => ({ name })))
			.onConflictDoUpdate({ target: tags.name, set: { name: sql`excluded.name` } })
			.returning();

		await tx.insert(cardTags).values(upserted.map((tag) => ({ cardId, tagId: tag.id })));
	});
}

/** Tag names for one card, e.g. for pre-filling the edit form. */
export async function getCardTagNames(cardId: string): Promise<string[]> {
	const rows = await db
		.select({ name: tags.name })
		.from(cardTags)
		.innerJoin(tags, eq(cardTags.tagId, tags.id))
		.where(eq(cardTags.cardId, cardId))
		.orderBy(tags.name);
	return rows.map((r) => r.name);
}

/** Tag names for many cards at once, grouped by card id — for a collection's card list. */
export async function getTagNamesByCard(cardIds: string[]): Promise<Map<string, string[]>> {
	const map = new Map<string, string[]>();
	if (cardIds.length === 0) return map;

	const rows = await db
		.select({ cardId: cardTags.cardId, name: tags.name })
		.from(cardTags)
		.innerJoin(tags, eq(cardTags.tagId, tags.id))
		.where(inArray(cardTags.cardId, cardIds))
		.orderBy(tags.name);

	for (const row of rows) {
		const list = map.get(row.cardId);
		if (list) list.push(row.name);
		else map.set(row.cardId, [row.name]);
	}
	return map;
}
