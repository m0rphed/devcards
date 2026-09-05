import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/domain.schema';
import { canEdit, getCollectionAccess } from '$lib/server/authz';
import { parseCardContent } from '$lib/server/card-content';
import { requireUser } from '$lib/server/require-user';
import { getCardTagNames, parseTagNames, setCardTags } from '$lib/server/tags';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const currentUser = requireUser(event);
	const { collectionId, cardId } = event.params;

	const { collection, role } = await getCollectionAccess(collectionId, currentUser.id);
	if (!collection || !canEdit(role)) error(404, 'Не найдено');

	const [card] = await db
		.select()
		.from(cards)
		.where(and(eq(cards.id, cardId), eq(cards.collectionId, collectionId)))
		.limit(1);
	if (!card) error(404, 'Карточка не найдена');

	const tagNames = await getCardTagNames(cardId);
	return { collection, card, tagNames };
};

export const actions: Actions = {
	update: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId, cardId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (!canEdit(role)) error(403, 'Нет прав на редактирование этой коллекции');

		const formData = await event.request.formData();
		const parsed = parseCardContent(formData);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		await db
			.update(cards)
			.set({ type: parsed.type, content: parsed.content })
			.where(and(eq(cards.id, cardId), eq(cards.collectionId, collectionId)));
		await setCardTags(cardId, parseTagNames(formData.get('tags')?.toString() ?? ''));

		redirect(303, `/collections/${collectionId}`);
	}
};
