import { describe, expect, test } from 'vitest';
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
	test('shows the front, hides the back, until "Показать ответ" is clicked', async () => {
		const screen = render(StudyCardView, { card: basicCard, rendered: basicRendered, remaining: 3 });

		await expect.element(screen.getByText('Front text')).toBeVisible();
		expect(screen.getByText('Back text').query()).toBeNull();
		expect(screen.getByText('Again').query()).toBeNull();

		await screen.getByRole('button', { name: 'Показать ответ' }).click();

		await expect.element(screen.getByText('Back text')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Again' })).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Easy' })).toBeVisible();
	});

	test('shows the remaining-cards count', async () => {
		const screen = render(StudyCardView, { card: basicCard, rendered: basicRendered, remaining: 7 });
		await expect.element(screen.getByText('Осталось карточек: 7')).toBeVisible();
	});
});

describe('StudyCardView (cloze)', () => {
	const clozeCard: StudyCard = { id: 'card-2', type: 'cloze', content: { text: 'sky is {{c1::blue}}' } };
	const clozeRendered: RenderedCard = {
		kind: 'cloze',
		maskedHtml: '<p>sky is [...]</p>',
		revealedHtml: '<p>sky is blue</p>'
	};

	test('masks the answer until revealed', async () => {
		const screen = render(StudyCardView, { card: clozeCard, rendered: clozeRendered, remaining: 1 });

		await expect.element(screen.getByText('sky is [...]')).toBeVisible();
		expect(screen.getByText('sky is blue').query()).toBeNull();

		await screen.getByRole('button', { name: 'Показать ответ' }).click();

		await expect.element(screen.getByText('sky is blue')).toBeVisible();
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

		// "A"/"B" alone are ambiguous (substring of "Again"/button labels etc.) —
		// match the whole list-item text instead: "—" for the wrong option,
		// "✓" for the correct one (index 1 -> "B").
		await expect.element(screen.getByText('— A')).toBeVisible();
		await expect.element(screen.getByText('✓ B')).toBeVisible();
	});
});
