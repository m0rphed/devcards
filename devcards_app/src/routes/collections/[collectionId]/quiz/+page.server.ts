import { error, fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/domain.schema';
import { getCollectionAccess } from '$lib/server/authz';
import { requireUser } from '$lib/server/require-user';
import { getActiveSession, listSessions, startQuizSession } from '$lib/server/quiz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const currentUser = requireUser(event);
	const { collectionId } = event.params;

	const { collection, role } = await getCollectionAccess(collectionId, currentUser.id);
	if (!collection || role === null) error(404, 'Коллекция не найдена');

	const active = await getActiveSession(collectionId, currentUser.id);
	if (active) redirect(302, `/collections/${collectionId}/quiz/${active.id}`);

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(cards)
		.where(eq(cards.collectionId, collectionId));
	const history = await listSessions(collectionId, currentUser.id);

	return { collection, cardCount: count, history };
};

export const actions: Actions = {
	start: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { collection, role } = await getCollectionAccess(collectionId, currentUser.id);
		if (!collection || role === null) error(404, 'Коллекция не найдена');

		const [{ count }] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(cards)
			.where(eq(cards.collectionId, collectionId));
		if (count === 0) return fail(400, { message: 'В коллекции нет карточек' });

		const sessionId = await startQuizSession(collectionId, currentUser.id);
		redirect(303, `/collections/${collectionId}/quiz/${sessionId}`);
	}
};
