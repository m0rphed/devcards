import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QuizCardView from './QuizCardView.svelte';
import type { StudyCard } from '$lib/server/srs';
import type { RenderedCard } from '$lib/server/render-card';

describe('QuizCardView (basic) — typed-answer step', () => {
	const card: StudyCard = { id: 'card-1', type: 'basic', content: { front: 'Q', back: 'A' } };
	const rendered: RenderedCard = { kind: 'basic', frontHtml: '<p>Q</p>', backHtml: '<p>A</p>' };

	test('lets you type an answer before revealing — regression test for the "can\'t answer" gap', async () => {
		const screen = render(QuizCardView, { card, rendered, current: 1, total: 5 });

		// Must be able to commit to an answer before seeing it — this is the
		// whole point of a *test*, unlike silent-recall /study mode.
		const input = screen.getByPlaceholder('Впиши свой ответ перед тем как посмотреть правильный...');
		await expect.element(input).toBeVisible();
		await input.fill('моя попытка');

		expect(screen.getByRole('button', { name: 'Верно' }).query()).toBeNull();

		await screen.getByRole('button', { name: 'Показать ответ' }).click();

		// Front/back visibility itself is Flashcard's job — both faces are
		// *always* in the DOM by design (see its own tests, which check this
		// with a real pixel-level screenshot, not just DOM presence/
		// toBeVisible(), neither of which reflects actual 3D backface
		// culling). What QuizCardView owns is that revealing unlocks grading.
		await expect.element(screen.getByText('моя попытка')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Верно', exact: true })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Неверно' })).toBeVisible();
	});

	test('shows the question count', async () => {
		const screen = render(QuizCardView, { card, rendered, current: 3, total: 8 });
		await expect.element(screen.getByText('Вопрос 3 из 8')).toBeVisible();
	});

	test('dragging/tapping the card before submitting an answer cannot jump straight to the answer', async () => {
		// Regression test for Flashcard's disableFlip gate — the whole point of
		// a test (vs /study's silent self-recall) is committing to an answer
		// first, so a stray drag/tap on the card must not bypass it. Can't
		// assert this via getByText('A').query() being null any more — both
		// faces are *always* in the DOM (Flashcard's dual-face technique), so
		// that would pass even if the gate were broken. Assert on the thing
		// this component actually owns instead: grading only unlocks once the
		// typed-answer form is submitted.
		const screen = render(QuizCardView, { card, rendered, current: 1, total: 5 });

		await screen.getByText('Q').click();
		const el = screen.container.querySelector('.flashcard-wrapper')!;
		el.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, pointerId: 1, button: 0, bubbles: true }));
		el.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 0, pointerId: 1, bubbles: true }));
		el.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 0, pointerId: 1, bubbles: true }));

		expect(screen.getByRole('button', { name: 'Верно', exact: true }).query()).toBeNull();
		expect(screen.getByRole('button', { name: 'Неверно' }).query()).toBeNull();
		await expect.element(screen.getByPlaceholder('Впиши свой ответ перед тем как посмотреть правильный...')).toBeVisible();
	});
});

describe('QuizCardView (multiple_choice) — no typed-answer step needed', () => {
	const card: StudyCard = {
		id: 'card-2',
		type: 'multiple_choice',
		content: { question: 'Pick one', options: ['Alpha', 'Beta'], correct_index: 0 }
	};
	const rendered: RenderedCard = {
		kind: 'multiple_choice',
		questionHtml: '<p>Pick one</p>',
		options: ['Alpha', 'Beta'],
		correctIndex: 0
	};

	test('renders one button per option, answering directly (no reveal step)', async () => {
		const screen = render(QuizCardView, { card, rendered, current: 1, total: 5 });

		await expect.element(screen.getByText('Pick one')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Alpha' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Beta' })).toBeVisible();
		expect(screen.getByRole('button', { name: 'Показать ответ' }).query()).toBeNull();
	});
});
