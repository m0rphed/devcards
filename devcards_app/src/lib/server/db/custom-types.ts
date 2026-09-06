import { customType } from 'drizzle-orm/pg-core';

/**
 * Postgres `citext` — case-insensitive text. Used for email/tag lookups
 * without hand-rolled LOWER() everywhere. Requires `CREATE EXTENSION citext`.
 */
export const citext = customType<{ data: string }>({
	dataType() {
		return 'citext';
	}
});

/**
 * Postgres `tsvector` — only used as a generated (STORED) column via
 * `.generatedAlwaysAs(sql\`...\`)`, never written to directly from the app.
 */
export const tsvector = customType<{ data: string }>({
	dataType() {
		return 'tsvector';
	}
});

/**
 * Postgres `bytea` — raw binary storage for uploaded attachments (card
 * images). No separate extension or object-storage service needed: `bytea`
 * is built in, Postgres TOASTs large values out-of-line automatically (so
 * these rows don't bloat scans of the table itself), and `postgres-js`
 * round-trips this type as a plain Node `Buffer` with zero extra config —
 * see ../attachments.ts.
 */
export const bytea = customType<{ data: Buffer }>({
	dataType() {
		return 'bytea';
	}
});
