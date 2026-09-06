import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { attachments, ATTACHMENT_MIME_TYPES, ATTACHMENT_MAX_BYTES } from '$lib/server/db/domain.schema';

export { ATTACHMENT_MIME_TYPES, ATTACHMENT_MAX_BYTES };

export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number];

function isAllowedMimeType(mimeType: string): mimeType is AttachmentMimeType {
	return (ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Validates and stores an uploaded image, deduping by content hash per-owner
 * (re-pasting the same screenshot into a second card reuses the existing
 * row instead of storing the bytes twice — see the unique index on
 * (owner_id, sha256) in domain.schema.ts).
 *
 * Returns the attachment id, or a reason string if the file was rejected —
 * never throws for a bad upload, since a rejected file is an expected,
 * routine outcome here (wrong type, too big), not a server error.
 */
export async function saveAttachment(
	ownerId: string,
	file: File
): Promise<{ id: string } | { error: 'unsupported_type' | 'too_large' }> {
	if (!isAllowedMimeType(file.type)) return { error: 'unsupported_type' };
	if (file.size <= 0 || file.size > ATTACHMENT_MAX_BYTES) return { error: 'too_large' };

	const data = Buffer.from(await file.arrayBuffer());
	const sha256 = createHash('sha256').update(data).digest('hex');

	const [existing] = await db
		.select({ id: attachments.id })
		.from(attachments)
		.where(and(eq(attachments.ownerId, ownerId), eq(attachments.sha256, sha256)))
		.limit(1);
	if (existing) return { id: existing.id };

	const [inserted] = await db
		.insert(attachments)
		.values({ ownerId, mimeType: file.type, byteSize: data.byteLength, sha256, data })
		.returning({ id: attachments.id });
	return { id: inserted.id };
}

export type StoredAttachment = { mimeType: string; sha256: string; data: Buffer };

export async function getAttachment(id: string): Promise<StoredAttachment | undefined> {
	const [row] = await db
		.select({ mimeType: attachments.mimeType, sha256: attachments.sha256, data: attachments.data })
		.from(attachments)
		.where(eq(attachments.id, id))
		.limit(1);
	return row;
}
