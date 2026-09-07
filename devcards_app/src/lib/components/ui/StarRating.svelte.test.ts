import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StarRating from './StarRating.svelte';

describe('StarRating', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('clicking a star calls requestSubmit() with that rating in the form data', async () => {
		// Spy on requestSubmit itself rather than letting a real 'submit' event
		// fire: this component's form carries use:enhance, which — with no
		// real SvelteKit route behind "?/rate" in an isolated component test —
		// tries to apply a fetch response to page state that doesn't exist
		// here and throws an unhandled rejection. What this test actually
		// owns is "did the component ask to submit the right data", not
		// SvelteKit's own progressive-enhancement plumbing.
		let submittedRating: string | null = null;
		vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(function (this: HTMLFormElement) {
			submittedRating = new FormData(this).get('rating') as string | null;
		});

		const screen = render(StarRating, { value: null, rateAction: '?/rate', unrateAction: '?/unrate' });

		// RatingGroup.Item is intentionally role="presentation" (bits-ui models
		// the *group* as a single role="slider", not N separate interactive
		// items — confirmed in bits-ui's source), so it's not queryable via
		// getByRole — use a test id instead. Also needs a real Playwright
		// click (proper element-relative pointer coordinates), not a raw DOM
		// .click(): bits-ui computes the rating from the click's position
		// relative to the item's bounding rect, and a synthetic DOM click
		// event's clientX/Y default to 0, which resolved to rating 0 here.
		await screen.getByTestId('star-3').click(); // 0-indexed -> the 4th star
		expect(submittedRating).toBe('4');
	});

	test('shows "Убрать оценку" only once rated', async () => {
		const unrated = render(StarRating, { value: null, rateAction: '?/rate', unrateAction: '?/unrate' });
		expect(unrated.getByText('Убрать оценку').query()).toBeNull();

		const rated = render(StarRating, { value: 3, rateAction: '?/rate', unrateAction: '?/unrate' });
		await expect.element(rated.getByText('Убрать оценку')).toBeVisible();
	});
});
