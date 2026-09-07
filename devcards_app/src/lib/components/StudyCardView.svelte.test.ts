import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StudyCardView from './StudyCardView.svelte';
import type { StudyCard } from '$lib/server/srs';
import type { RenderedCard } from '$lib/server/render-card';

const basicCard: StudyCard = { id: 'card-1', type: 'basic', content: { front: 'Front text', back: 'Back text' } };
const basicRendered: RenderedCard = {
	kind: 'basic',
	frontHtml: '<p>Front text</p>',
	backHtml: '<p>Back text</p>'
};

describe('StudyCardView (basic)', () => {
	test('shows "Показать ответ" until clicked, then the grade buttons', async () => {
		// Front/back content visibility itself is Flashcard's job, already
		// covered (with a real pixel-level check, not just DOM presence —
		// both faces are *always* in the DOM by design, see Flashcard's own
		// tests) by its own test suite. What StudyCardView owns is which
		// controls show at which point.
		const screen = render(StudyCardView, { card: basicCard, rendered: basicRendered, remaining: 3 });

		await expect.element(screen.getByRole('button', { name: 'Показать ответ' })).toBeVisible();
		expect(screen.getByRole('button', { name: 'Again' }).query()).toBeNull();

		await screen.getByRole('button', { name: 'Показать ответ' }).click();

		expect(screen.getByRole('button', { name: 'Показать ответ' }).query()).toBeNull();
		await expect.element(screen.getByRole('button', { name: 'Again' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Easy' })).toBeVisible();
	});

	test('shows the remaining-cards count', async () => {
		const screen = render(StudyCardView, { card: basicCard, rendered: basicRendered, remaining: 7 });
		await expect.element(screen.getByText('Осталось карточек: 7')).toBeVisible();
	});

	test('"Пропустить" only appears when onSkip is given, and calls it', async () => {
		const noSkip = render(StudyCardView, { card: basicCard, rendered: basicRendered, remaining: 1 });
		expect(noSkip.getByText('Пропустить →').query()).toBeNull();

		const onSkip = vi.fn();
		const screen = render(StudyCardView, { card: basicCard, rendered: basicRendered, remaining: 1, onSkip });
		await screen.getByText('Пропустить →').click();
		expect(onSkip).toHaveBeenCalledOnce();
	});
});

describe('StudyCardView (cloze)', () => {
	const clozeCard: StudyCard = { id: 'card-2', type: 'cloze', content: { text: 'sky is {{c1::blue}}' } };
	const clozeRendered: RenderedCard = {
		kind: 'cloze',
		maskedHtml: '<p>sky is [...]</p>',
		revealedHtml: '<p>sky is blue</p>'
	};

	test('shows "Показать ответ" until clicked, then the grade buttons', async () => {
		const screen = render(StudyCardView, { card: clozeCard, rendered: clozeRendered, remaining: 1 });

		await expect.element(screen.getByRole('button', { name: 'Показать ответ' })).toBeVisible();

		await screen.getByRole('button', { name: 'Показать ответ' }).click();

		expect(screen.getByRole('button', { name: 'Показать ответ' }).query()).toBeNull();
		await expect.element(screen.getByRole('button', { name: 'Again' })).toBeVisible();
	});
});

describe('StudyCardView (multiple_choice)', () => {
	const mcCard: StudyCard = {
		id: 'card-3',
		type: 'multiple_choice',
		content: { question: 'Pick one', options: ['A', 'B'], correct_index: 1 }
	};
	const mcRendered: RenderedCard = {
		kind: 'multiple_choice',
		questionHtml: '<p>Pick one</p>',
		options: ['A', 'B'],
		correctIndex: 1
	};

	test('reveals options with the correct one marked, only after "Показать ответ"', async () => {
		const screen = render(StudyCardView, { card: mcCard, rendered: mcRendered, remaining: 1 });

		await expect.element(screen.getByText('Pick one')).toBeVisible();
		expect(screen.getByText('A').query()).toBeNull();

		await screen.getByRole('button', { name: 'Показать ответ' }).click();

		// The correct/incorrect marker is now an icon (no text glyph left to
		// match), with sr-only "Верно:"/"Неверно:" carrying the same meaning
		// for assistive tech — locate each option's <li> via that text instead.
		const wrongLi = screen.getByText('Неверно:').element().closest('li');
		expect(wrongLi?.textContent).toContain('A');
		// exact: true — "Неверно:" contains "Верно:" as a substring, so a
		// non-exact match would ambiguously resolve to both spans.
		const correctLi = screen.getByText('Верно:', { exact: true }).element().closest('li');
		expect(correctLi?.textContent).toContain('B');
	});
});
