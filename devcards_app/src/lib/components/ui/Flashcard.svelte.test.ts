import { describe, expect, test, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import Flashcard from './Flashcard.svelte';

function textSnippet(text: string, bg = 'white') {
	return createRawSnippet(() => ({
		render: () =>
			`<div data-testid="${text}" style="width:200px;height:120px;background:${bg};box-sizing:border-box;">${text}</div>`
	}));
}

async function decodePngDominantColor(base64: string) {
	const img = new Image();
	img.src = `data:image/png;base64,${base64}`;
	await new Promise((resolve, reject) => {
		img.onload = resolve;
		img.onerror = reject;
	});
	const canvas = document.createElement('canvas');
	canvas.width = img.naturalWidth;
	canvas.height = img.naturalHeight;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(img, 0, 0);
	const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const counts: Record<string, number> = {};
	for (let i = 0; i < data.length; i += 4) {
		const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
		counts[key] = (counts[key] ?? 0) + 1;
	}
	return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]; // "r,g,b" of the most common pixel color
}

/** Dispatches a real PointerEvent sequence — exact drag distance/timing matters for this component's axis-lock and thresholds. */
function drag(el: Element, path: { x: number; y: number }[]) {
	const pointerId = 1;
	const [start, ...rest] = path;
	el.dispatchEvent(new PointerEvent('pointerdown', { clientX: start.x, clientY: start.y, pointerId, button: 0, bubbles: true }));
	for (const p of rest) el.dispatchEvent(new PointerEvent('pointermove', { clientX: p.x, clientY: p.y, pointerId, bubbles: true }));
	const last = path[path.length - 1];
	el.dispatchEvent(new PointerEvent('pointerup', { clientX: last.x, clientY: last.y, pointerId, bubbles: true }));
}

describe('Flashcard', () => {
	test('regression: the settled back face is actually painted, not just present in the DOM', async () => {
		// A real screenshot, decoded pixel-by-pixel, is the check that can't
		// be fooled by toBeVisible()/computed-style checks (neither reflects
		// actual rendering — see the DOM-cardinality test below for why this
		// alone isn't enough either): front is solid red, back is solid blue,
		// and after flipping, the dominant color must actually be blue.
		const screen = render(Flashcard, { front: textSnippet('F', 'red'), back: textSnippet('B', 'blue') });
		await new Promise((r) => setTimeout(r, 50));

		const frontShot = (await screen.getByTestId('F').screenshot({ base64: true })) as unknown as { base64: string };
		expect(await decodePngDominantColor(frontShot.base64)).toBe('255,0,0');

		await screen.getByTestId('F').click();
		await new Promise((r) => setTimeout(r, 800)); // let the settle spring finish

		const backShot = (await screen.getByTestId('B').screenshot({ base64: true })) as unknown as { base64: string };
		expect(await decodePngDominantColor(backShot.base64)).toBe('0,0,255');
	});

	test('regression: never more than one face mounted at once, mid-flip included', async () => {
		// This is the check that actually would have caught the production
		// bug the *previous* implementation shipped: a real 3D flip (both
		// faces always in the DOM, culled via backface-visibility on a
		// preserve-3d parent) rendered correctly in this test suite —
		// including the pixel-level screenshot test above, since that used
		// solid opaque backgrounds and an opaque top face simply paints over
		// whatever's underneath regardless of whether the bottom one was
		// ever actually culled. In production, on a real browser, the 3D
		// context didn't compose the way the technique assumes, and *both*
		// faces painted at once — with real (non-opaque-block) content, that
		// showed up as mirrored, overlapping text. Solid-color screenshots
		// structurally cannot detect "two things painted, one on top of the
		// other" when the top one is opaque. A DOM-cardinality check can: the
		// current implementation only ever mounts one face element, so
		// there's nothing to overlap by construction — assert that
		// invariant directly, including mid-animation (not just settled),
		// since that's exactly when the old bug's overlap was visible.
		const screen = render(Flashcard, { front: textSnippet('Front'), back: textSnippet('Back') });
		const countFaces = () => screen.container.querySelectorAll('.flashcard__face').length;

		expect(countFaces()).toBe(1);
		await screen.getByText('Front').click();
		for (let i = 0; i < 8; i++) {
			await new Promise((r) => setTimeout(r, 40)); // sample repeatedly through the settle animation
			expect(countFaces()).toBe(1);
		}
		await new Promise((r) => setTimeout(r, 500)); // let it fully settle
		expect(countFaces()).toBe(1);
	});

	test('clicking the card flips it', async () => {
		const screen = render(Flashcard, { front: textSnippet('Front'), back: textSnippet('Back') });
		await expect.element(screen.getByText('Front')).toBeVisible();

		await screen.getByText('Front').click();

		await expect.element(screen.getByText('Back')).toBeVisible();
	});

	test('dragging horizontally past the midpoint flips it (default flipDirection is ltr)', async () => {
		const screen = render(Flashcard, { front: textSnippet('Front'), back: textSnippet('Back') });
		const el = screen.container.querySelector('.flashcard-wrapper')!;

		drag(el, [
			{ x: 0, y: 0 },
			{ x: 150, y: 0 },
			{ x: 350, y: 0 }
		]);
		await expect.element(screen.getByText('Back')).toBeVisible();
	});

	test('a vertical drag past the distance threshold triggers onSkip, a short one does not', async () => {
		const onSkip = vi.fn();
		const screen = render(Flashcard, { front: textSnippet('Front'), back: textSnippet('Back'), onSkip });
		const el = screen.container.querySelector('.flashcard-wrapper')!;

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
		await vi.waitFor(() => expect(onSkip).toHaveBeenCalledTimes(1));
	});

	test('disableFlip ignores both click and drag', async () => {
		const screen = render(Flashcard, { front: textSnippet('Front'), back: textSnippet('Back'), disableFlip: true });
		const el = screen.container.querySelector('.flashcard-wrapper')!;

		await screen.getByText('Front').click();
		drag(el, [
			{ x: 0, y: 0 },
			{ x: 350, y: 0 }
		]);
		await expect.element(screen.getByText('Front')).toBeVisible();
	});

	test('manualFlip ignores click/drag but an externally-driven flipHook still works', async () => {
		const { createFlashcardFlip } = await import('./useFlashcard.svelte');
		const hook = createFlashcardFlip({ manualFlip: true });
		const screen = render(Flashcard, { front: textSnippet('Front'), back: textSnippet('Back'), flipHook: hook });

		await screen.getByText('Front').click();
		await expect.element(screen.getByText('Front')).toBeVisible();

		hook.flip();
		await expect.element(screen.getByText('Back')).toBeVisible();
	});
});
