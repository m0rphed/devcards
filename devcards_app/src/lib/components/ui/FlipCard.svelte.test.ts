import { describe, expect, test, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import FlipCard from './FlipCard.svelte';

function textSnippet(text: string) {
	return createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));
}

/** Dispatches a real PointerEvent sequence on an element — used instead of
 * a locator's higher-level actions so drag distance/direction/timing are
 * exact and deterministic, which this component's axis-lock and
 * distance/velocity thresholds actually depend on. */
function drag(el: Element, path: { x: number; y: number }[]) {
	const pointerId = 1;
	const [start, ...rest] = path;
	el.dispatchEvent(new PointerEvent('pointerdown', { clientX: start.x, clientY: start.y, pointerId, button: 0, bubbles: true }));
	for (const p of rest) {
		el.dispatchEvent(new PointerEvent('pointermove', { clientX: p.x, clientY: p.y, pointerId, bubbles: true }));
	}
	const last = path[path.length - 1];
	el.dispatchEvent(new PointerEvent('pointerup', { clientX: last.x, clientY: last.y, pointerId, bubbles: true }));
}

describe('FlipCard', () => {
	test('clicking the card flips it', async () => {
		const screen = render(FlipCard, { front: textSnippet('Front'), back: textSnippet('Back') });
		await expect.element(screen.getByText('Front')).toBeVisible();
		expect(screen.getByText('Back').query()).toBeNull();

		await screen.getByText('Front').click();

		await expect.element(screen.getByText('Back')).toBeVisible();
		expect(screen.getByText('Front').query()).toBeNull();
	});

	test('dragging horizontally past the midpoint flips it; short of it snaps back', async () => {
		const screen = render(FlipCard, { front: textSnippet('Front'), back: textSnippet('Back') });
		const el = screen.container.querySelector('.flip-scene')!;

		// FLIP_SENSITIVITY is 0.6deg/px — 200px clears the 90deg midpoint.
		drag(el, [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 200, y: 0 }
		]);
		await expect.element(screen.getByText('Back')).toBeVisible();

		// Drag back the other way, but not far enough to un-flip.
		drag(el, [
			{ x: 0, y: 0 },
			{ x: -20, y: 0 }
		]);
		await expect.element(screen.getByText('Back')).toBeVisible();
	});

	test('a vertical drag past the distance threshold triggers onSkip, a short one does not', async () => {
		const onSkip = vi.fn();
		const screen = render(FlipCard, { front: textSnippet('Front'), back: textSnippet('Back'), onSkip });
		const el = screen.container.querySelector('.flip-scene')!;

		drag(el, [
			{ x: 0, y: 0 },
			{ x: 0, y: -30 }
		]);
		expect(onSkip).not.toHaveBeenCalled();

		drag(el, [
			{ x: 0, y: 0 },
			{ x: 0, y: -60 },
			{ x: 0, y: -120 }
		]);
		// onSkip fires after the fly-off transition's setTimeout, not synchronously.
		await vi.waitFor(() => expect(onSkip).toHaveBeenCalledTimes(1));
	});

	test('disabled ignores both click and drag, but programmatic flipped changes still work', async () => {
		const screen = render(FlipCard, { front: textSnippet('Front'), back: textSnippet('Back'), disabled: true });
		const el = screen.container.querySelector('.flip-scene')!;

		await screen.getByText('Front').click();
		drag(el, [
			{ x: 0, y: 0 },
			{ x: 200, y: 0 }
		]);
		await expect.element(screen.getByText('Front')).toBeVisible();
	});

	test('a horizontal drag never triggers onSkip, even past the vertical distance', async () => {
		const onSkip = vi.fn();
		const screen = render(FlipCard, { front: textSnippet('Front'), back: textSnippet('Back'), onSkip });
		const el = screen.container.querySelector('.flip-scene')!;

		drag(el, [
			{ x: 0, y: 0 },
			{ x: 200, y: 0 }
		]);
		expect(onSkip).not.toHaveBeenCalled();
	});
});
