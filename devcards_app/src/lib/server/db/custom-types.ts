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
