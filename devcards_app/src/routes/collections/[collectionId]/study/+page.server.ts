import { error, fail, redirect } from '@sveltejs/kit';
import type { Grade } from 'ts-fsrs';
import { getCollectionAccess } from '$lib/server/authz';
import { requireUser } from '$lib/server/require-user';
import { getNextDueCard, gradeCard } from '$lib/server/srs';
import { renderCard } from '$lib/server/render-card';
import { getReviewActivity } from '$lib/server/stats';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const currentUser = requireUser(event);
	const { collectionId } = event.params;

	const { collection, role } = await getCollectionAccess(collectionId, currentUser.id);
	if (!collection || role === null) error(404, 'Коллекция не найдена');

	const next = await getNextDueCard(collectionId, currentUser.id);
	const rendered = next.card ? await renderCard(next.card.type, next.card.content) : null;
	// Only needed for the "all done" screen, but cheap enough (one indexed
	// view scan, at most 7 rows) to just always fetch — not worth a second
	// round trip only to show a loading state for it in the rare case.
	const activity = await getReviewActivity(currentUser.id, 7);
	// "Again" can bring the very same card back up immediately (short learning
	// step) — a random key per load forces the reveal state to reset even when
	// data.card.id is unchanged from the previous card shown.
	return { collection, ...next, rendered, activity, loadKey: crypto.randomUUID() };
};

export const actions: Actions = {
	grade: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role === null) error(404, 'Коллекция не найдена');

		const formData = await event.request.formData();
		const cardId = formData.get('cardId')?.toString();
		const rating = Number(formData.get('rating'));
		if (!cardId || ![1, 2, 3, 4].includes(rating)) {
			return fail(400, { message: 'Некорректная оценка' });
		}

		await gradeCard(currentUser.id, cardId, rating as Grade);
		redirect(303, `/collections/${collectionId}/study`);
	}
};
