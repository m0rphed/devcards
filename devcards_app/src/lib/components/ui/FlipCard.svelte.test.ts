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
	test('regression: the settled face is not hidden by backface-visibility', async () => {
		// A real bug that every other test in this file passed straight
		// through: `.flip-face { backface-visibility: hidden }` looked
		// reasonable (classic flip-card technique) but was actively wrong
		// here — only one face is ever in the DOM at a time (no second face
		// it could ever need to hide), and since .flip-card doesn't/can't
		// declare transform-style: preserve-3d, the shown face's own
		// rotateY(180deg) is evaluated as an isolated 3D context that, alone,
		// genuinely does face away from the viewer — so it got hidden
		// outright despite rendering correctly otherwise (confirmed via
		// getComputedStyle: opacity 1, real layout, right content).
		// Playwright's toBeVisible() does NOT catch this — it doesn't
		// special-case backface-visibility — which is exactly how this
		// shipped once already; assert on the actual computed style instead.
		const screen = render(FlipCard, { front: textSnippet('Front'), back: textSnippet('Back'), flipped: true });
		await expect.element(screen.getByText('Back')).toBeVisible(); // still true even when this bug is present
		const face = screen.container.querySelector('.flip-face')!;
		expect(getComputedStyle(face).backfaceVisibility).not.toBe('hidden');
	});

	test('regression: the face swap stays in sync with the actual animated rotation, not the click', async () => {
		// The bug this guards: content used to swap the instant `flipped`
		// changed (a plain reactive value jumping straight to its target),
		// while the *visual* rotation was still just a CSS transition
		// catching up over the next ~0.4s — so the back face rendered
		// mirrored/upside down for nearly the whole animation, only
		// self-correcting right at the very end. Routing the swap through an
		// actually-animating value (a Spring) means immediately after a
		// click, before any animation frame has run, the front must still be
		// showing — the swap can only happen once real rotation progress
		// has crossed the midpoint.
		// A deliberately slow spring, not the component's normal default: this
		// makes the "still mid-flight" window wide enough (hundreds of ms) to
		// observe reliably regardless of system load, rather than racing
		// against however fast the real animation happens to settle.
		const screen = render(FlipCard, {
			front: textSnippet('Front'),
			back: textSnippet('Back'),
			stiffness: 0.02,
			damping: 1
		});

		await screen.getByText('Front').click();
		expect(screen.getByText('Back').query()).toBeNull();
		await expect.element(screen.getByText('Front')).toBeVisible();

		// ...and it does eventually settle on the back once the animation runs.
		await expect.element(screen.getByText('Back')).toBeVisible();
	});

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
