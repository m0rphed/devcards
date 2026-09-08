import { error, fail } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { requireUser } from '$lib/server/require-user';
import type { Actions, PageServerLoad } from './$types';

// Personal-only utility page, built for the "Базы данных" coursework defense
// (methodology requirement: an interface that can browse every table and
// call every stored procedure/function with user-supplied parameters). Not
// a general devcards feature — gated to a single hardcoded account, not a
// role, since there's no admin role concept anywhere else in the app.
const ADMIN_EMAIL = 'victorkhovtko@gmail.com';

function requireAdmin(event: Parameters<PageServerLoad>[0] | Parameters<NonNullable<Actions[string]>>[0]) {
	const currentUser = requireUser(event);
	if (currentUser.email !== ADMIN_EMAIL) error(403, 'Доступно только администратору');
	return currentUser;
}

/** Every base table in the public schema, with a live row count — not the
 * catalog's own (occasionally stale) estimate, a real count(*) per table. */
async function listTablesWithCounts() {
	const tableRows = await db.execute<{ table_name: string }>(sql`
		SELECT table_name FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
		ORDER BY table_name
	`);

	const tables: { name: string; rowCount: number }[] = [];
	for (const { table_name } of tableRows) {
		const rows = await db.execute<{ count: string }>(
			sql`SELECT count(*)::text AS count FROM ${sql.identifier(table_name)}`
		);
		tables.push({ name: table_name, rowCount: Number(rows[0].count) });
	}
	return tables;
}

export const load: PageServerLoad = async (event) => {
	requireAdmin(event);
	return { tables: await listTablesWithCounts() };
};

/** Runs one stored function, returning either its rows or a readable error
 * message (the function's own RAISE EXCEPTION text — every fn_* in
 * 0010_add_report_query_functions.sql validates its inputs and raises a
 * plain-language message on bad ones, matching the assignment's own example
 * of "no such user -> show an error, not a stack trace"). */
async function runFunction(query: ReturnType<typeof sql>) {
	try {
		const rows = await db.execute<Record<string, unknown>>(query);
		return { rows: [...rows], error: null };
	} catch (e) {
		return { rows: null, error: e instanceof Error ? e.message : String(e) };
	}
}

export const actions: Actions = {
	fn_user_top_struggling_tags: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const userId = data.get('userId')?.toString() ?? '';
		const days = Number(data.get('days') ?? 30);
		const minReviews = Number(data.get('minReviews') ?? 3);
		const result = await runFunction(
			sql`SELECT * FROM fn_user_top_struggling_tags(${userId}, ${days}, ${minReviews})`
		);
		return { fn: 'fn_user_top_struggling_tags', ...result };
	},

	fn_public_collections_ranking: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const limit = Number(data.get('limit') ?? 10);
		const result = await runFunction(sql`SELECT * FROM fn_public_collections_ranking(${limit})`);
		return { fn: 'fn_public_collections_ranking', ...result };
	},

	fn_review_forecast: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const userId = data.get('userId')?.toString() ?? '';
		const days = Number(data.get('days') ?? 7);
		const result = await runFunction(sql`SELECT * FROM fn_review_forecast(${userId}, ${days})`);
		return { fn: 'fn_review_forecast', ...result };
	},

	fn_daily_activity: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const userId = data.get('userId')?.toString() ?? '';
		const days = Number(data.get('days') ?? 30);
		const result = await runFunction(sql`SELECT * FROM fn_daily_activity(${userId}, ${days})`);
		return { fn: 'fn_daily_activity', ...result };
	},

	fn_public_authors_without_forks: async (event) => {
		requireAdmin(event);
		const result = await runFunction(sql`SELECT * FROM fn_public_authors_without_forks()`);
		return { fn: 'fn_public_authors_without_forks', ...result };
	},

	fn_never_reviewed_cards: async (event) => {
		requireAdmin(event);
		const data = await event.request.formData();
		const collectionId = data.get('collectionId')?.toString() ?? '';
		const result = await runFunction(sql`SELECT * FROM fn_never_reviewed_cards(${collectionId}::uuid)`);
		return { fn: 'fn_never_reviewed_cards', ...result };
	},

	fn_collection_rating_summary: async (event) => {
		requireAdmin(event);
		const result = await runFunction(sql`SELECT * FROM fn_collection_rating_summary()`);
		return { fn: 'fn_collection_rating_summary', ...result };
	}
};
