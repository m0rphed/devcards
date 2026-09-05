import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { collections, collectionAccess } from '$lib/server/db/domain.schema';

export type CollectionRole = 'owner' | 'editor' | 'viewer';

export type CollectionAccessResult =
	| { collection: typeof collections.$inferSelect; role: CollectionRole }
	| { collection: undefined; role: null };

/**
 * Resolves what (if anything) a user is allowed to do with a collection:
 * - owner: created it
 * - editor: explicit collection_access grant with role 'editor'
 * - viewer: collection is public, or explicit grant with role 'viewer'
 * - null: collection doesn't exist, or user has no access at all (private,
 *   not shared with them) — callers should treat this as a 404, not a 403,
 *   to avoid leaking whether a private collection id exists.
 */
export async function getCollectionAccess(
	collectionId: string,
	userId: string | undefined
): Promise<CollectionAccessResult> {
	const [collection] = await db
		.select()
		.from(collections)
		.where(eq(collections.id, collectionId))
		.limit(1);

	if (!collection) return { collection: undefined, role: null };

	if (userId && collection.ownerId === userId) {
		return { collection, role: 'owner' };
	}

	if (userId) {
		const [grant] = await db
			.select()
			.from(collectionAccess)
			.where(and(eq(collectionAccess.collectionId, collectionId), eq(collectionAccess.userId, userId)))
			.limit(1);

		if (grant) return { collection, role: grant.role };
	}

	if (collection.isPublic) return { collection, role: 'viewer' };

	return { collection: undefined, role: null };
}

export function canEdit(role: CollectionRole | null): boolean {
	return role === 'owner' || role === 'editor';
}
