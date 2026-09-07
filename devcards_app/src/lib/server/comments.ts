import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { collectionComments } from '$lib/server/db/domain.schema';
import { user } from '$lib/server/db/auth.schema';

export type CollectionComment = {
	id: string;
	body: string;
	createdAt: Date;
	authorId: string;
	authorName: string;
	authorImage: string | null;
};

// Flat (no threading) — see phase02.social_features.md's list of deliberate
// simplifications.
export async function listComments(collectionId: string): Promise<CollectionComment[]> {
	const rows = await db
		.select({
			id: collectionComments.id,
			body: collectionComments.body,
			createdAt: collectionComments.createdAt,
			authorId: user.id,
			authorName: user.name,
			authorImage: user.image
		})
		.from(collectionComments)
		.innerJoin(user, eq(collectionComments.authorId, user.id))
		.where(eq(collectionComments.collectionId, collectionId))
		.orderBy(desc(collectionComments.createdAt));
	return rows;
}

export async function addComment(collectionId: string, authorId: string, body: string): Promise<void> {
	const trimmed = body.trim();
	if (!trimmed) throw new Error('Comment body is empty');
	await db.insert(collectionComments).values({ collectionId, authorId, body: trimmed });
}

/** Only the comment's own author or the collection's owner may remove it — checked by the caller (route layer), same division as everywhere else. */
export async function deleteComment(commentId: string): Promise<void> {
	await db.delete(collectionComments).where(eq(collectionComments.id, commentId));
}

export async function getComment(commentId: string) {
	const [row] = await db.select().from(collectionComments).where(eq(collectionComments.id, commentId)).limit(1);
	return row;
}
