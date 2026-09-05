import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/domain.schema';
import { getCollectionAccess } from '$lib/server/authz';
import { requireUser } from '$lib/server/require-user';
import { getAnsweredCount, getNextQuizCard, getSession, submitAnswer } from '$lib/server/quiz';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const currentUser = requireUser(event);
	const { collectionId, sessionId } = event.params;

	const { collection, role } = await getCollectionAccess(collectionId, currentUser.id);
	if (!collection || role === null) error(404, 'Коллекция не найдена');

	const session = await getSession(sessionId, currentUser.id);
	if (!session || session.collectionId !== collectionId) error(404, 'Сессия теста не найдена');
	if (session.finishedAt) redirect(302, `/collections/${collectionId}/quiz/${sessionId}/results`);

	const card = await getNextQuizCard(sessionId, collectionId);
	if (!card) redirect(302, `/collections/${collectionId}/quiz/${sessionId}/results`);

	const answeredSoFar = await getAnsweredCount(sessionId);

	// Fresh key per load: a card can't repeat within one quiz session (unlike
	// SRS "Again"), but keeping the same pattern as /study keeps this immune
	// to the same class of stale-local-state bug either way.
	return { collection, session, card, answeredSoFar, loadKey: crypto.randomUUID() };
};

export const actions: Actions = {
	answer: async (event) => {
		const currentUser = requireUser(event);
		const { collectionId, sessionId } = event.params;
		const { role } = await getCollectionAccess(collectionId, currentUser.id);
		if (role === null) error(404, 'Коллекция не найдена');

		const session = await getSession(sessionId, currentUser.id);
		if (!session || session.finishedAt) error(400, 'Сессия уже завершена');

		const formData = await event.request.formData();
		const cardId = formData.get('cardId')?.toString();
		if (!cardId) return fail(400, { message: 'cardId обязателен' });

		// Re-fetch the real card server-side — never trust client-echoed
		// correctness for the auto-graded type.
		const [card] = await db.select().from(cards).where(eq(cards.id, cardId)).limit(1);
		if (!card) return fail(400, { message: 'Карточка не найдена' });

		let givenAnswer: unknown;
		let isCorrect: boolean;

		if (card.type === 'multiple_choice') {
			const selectedIndex = Number(formData.get('selectedIndex'));
			const content = card.content as { correct_index: number };
			givenAnswer = { selected_index: selectedIndex };
			isCorrect = selectedIndex === content.correct_index;
		} else {
			// basic/cloze have no structured answer to auto-grade — the
			// student self-reports, same self-assessment idea as SRS review.
			const selfReported = formData.get('selfReported') === 'correct';
			givenAnswer = { self_reported_correct: selfReported };
			isCorrect = selfReported;
		}

		await submitAnswer(sessionId, cardId, givenAnswer, isCorrect);
		redirect(303, `/collections/${collectionId}/quiz/${sessionId}`);
	}
};
