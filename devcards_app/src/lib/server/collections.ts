import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cardTags, cards, collectionAccess, collections } from '$lib/server/db/domain.schema';
import { isCollectionColor, type CollectionColor } from '$lib/collection-colors';
import { isCollectionIcon, type CollectionIcon } from '$lib/collection-icons';

/** Shared by the create/update collection actions, same "none sentinel" idea as parseCardColor. */
export function parseCollectionColor(formData: FormData): CollectionColor | null {
	const raw = formData.get('color')?.toString();
	return isCollectionColor(raw) ? raw : null;
}

export function parseCollectionIcon(formData: FormData): CollectionIcon | null {
	const raw = formData.get('icon')?.toString();
	return isCollectionIcon(raw) ? raw : null;
}

/**
 * "By value" — a full independent copy: new collection (owned by
 * `newOwnerId`), new card rows (new ids, same type/content), tags relinked
 * to the same (global, citext) tag rows. From here on it's a completely
 * ordinary collection — no ongoing sync with the source, ever (see
 * phase02.social_features.md: forking is one-time, not a subscription).
 *
 * Deliberately does NOT check whether the caller may view `sourceId` —
 * that's the route layer's job (getCollectionAccess), same division as
 * every other function here.
 */
export async function forkCollection(sourceId: string, newOwnerId: string): Promise<{ id: string }> {
	const [source] = await db.select().from(collections).where(eq(collections.id, sourceId)).limit(1);
	if (!source) throw new Error('Source collection not found');

	const sourceCards = await db.select().from(cards).where(eq(cards.collectionId, sourceId));

	const newCollectionId = crypto.randomUUID();
	// Old id -> new id, decided up front (rather than relying on a
	// .returning() row order matching input order) so card_tags can be
	// relinked afterwards without a second round trip per card.
	const idMap = new Map(sourceCards.map((c) => [c.id, crypto.randomUUID()]));

	await db.transaction(async (tx) => {
		await tx.insert(collections).values({
			id: newCollectionId,
			ownerId: newOwnerId,
			title: source.title,
			description: source.description,
			// Forks start private — copying someone's content doesn't imply you
			// want to immediately republish it under your name.
			isPublic: false,
			color: source.color,
			icon: source.icon,
			forkedFromCollectionId: source.id,
			forkedFromUpdatedAt: source.updatedAt
		});

		if (sourceCards.length > 0) {
			await tx.insert(cards).values(
				sourceCards.map((c) => ({
					id: idMap.get(c.id),
					collectionId: newCollectionId,
					type: c.type,
					content: c.content,
					color: c.color
				}))
			);

			const sourceTagLinks = await tx
				.select()
				.from(cardTags)
				.where(
					inArray(
						cardTags.cardId,
						sourceCards.map((c) => c.id)
					)
				);
			if (sourceTagLinks.length > 0) {
				await tx.insert(cardTags).values(
					sourceTagLinks.map((link) => ({
						// idMap is guaranteed to have every cardId here: sourceTagLinks
						// only ever references cards we just queried it by.
						cardId: idMap.get(link.cardId)!,
						tagId: link.tagId
					}))
				);
			}
		}
	});

	return { id: newCollectionId };
}

/**
 * "By reference" — self-service viewer access to a public collection. Same
 * `collection_access` row `revokeAccess` (owner-granted sharing) already
 * uses; the query that builds "shared with me" doesn't care who granted it.
 */
export async function subscribeToPublicCollection(collectionId: string, userId: string): Promise<void> {
	const [collection] = await db.select().from(collections).where(eq(collections.id, collectionId)).limit(1);
	if (!collection?.isPublic) throw new Error('Collection is not public');
	if (collection.ownerId === userId) return; // owners already have full access

	await db
		.insert(collectionAccess)
		.values({ collectionId, userId, role: 'viewer' })
		.onConflictDoNothing({ target: [collectionAccess.collectionId, collectionAccess.userId] });
}

/**
 * Leaving a collection — works the same whether the access was self-granted
 * (subscribe, above) or given to you by the owner (share). Doesn't touch
 * review_state/review_log/quiz history: your record of having studied a
 * card doesn't depend on whether you currently have access to its
 * collection (re-subscribing later picks up right where you left off).
 */
export async function leaveCollection(collectionId: string, userId: string): Promise<void> {
	await db
		.delete(collectionAccess)
		.where(and(eq(collectionAccess.collectionId, collectionId), eq(collectionAccess.userId, userId)));
}
