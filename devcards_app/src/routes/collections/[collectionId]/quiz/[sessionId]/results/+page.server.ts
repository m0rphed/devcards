import { error } from '@sveltejs/kit';
import { getCollectionAccess } from '$lib/server/authz';
import { requireUser } from '$lib/server/require-user';
import { getSessionResults } from '$lib/server/quiz';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const currentUser = requireUser(event);
	const { collectionId, sessionId } = event.params;

	const { collection, role } = await getCollectionAccess(collectionId, currentUser.id);
	if (!collection || role === null) error(404, 'Коллекция не найдена');

	const results = await getSessionResults(sessionId, currentUser.id);
	if (!results || results.session.collectionId !== collectionId) error(404, 'Сессия не найдена');

	return { collection, ...results };
};
