import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Avatar from './Avatar.svelte';

async function decodePng(base64: string): Promise<Uint8ClampedArray> {
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
	return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

function countDistinctColors(pixels: Uint8ClampedArray): number {
	const seen = new Set<string>();
	for (let i = 0; i < pixels.length; i += 4) seen.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
	return seen.size;
}

describe('Avatar', () => {
	test('no src -> shows the generative fallback canvas, not nothing (the bug this replaces)', async () => {
		const screen = render(Avatar, { src: null, name: 'Виктор' });
		expect(screen.container.querySelector('canvas')).not.toBeNull();
		expect(screen.container.querySelector('img')).toBeNull();
	});

	test('with src -> renders the image', async () => {
		const screen = render(Avatar, { src: '/attachments/some-id', name: 'Виктор' });
		expect(screen.container.querySelector('img')).not.toBeNull();
	});

	test('regression: the fallback canvas actually paints a gradient, not a blank/solid square', async () => {
		// DOM presence alone ("a <canvas> exists") wouldn't catch one that
		// mounted but never actually drew anything (e.g. a silently-failed
		// WebGL context with no working 2D fallback) — a real screenshot is
		// the only check that reflects actual pixels, same reasoning as
		// Flashcard.svelte.test.ts's flagship test. A flat/blank canvas has
		// exactly one distinct color; the generative blobs' soft radial
		// gradients always produce many.
		const screen = render(Avatar, { src: null, name: 'Виктор', size: 'lg' });
		await new Promise((r) => setTimeout(r, 50));

		const shot = (await screen.getByRole('img', { name: 'Виктор' }).screenshot({ base64: true })) as unknown as {
			base64: string;
		};
		const distinctColors = countDistinctColors(await decodePng(shot.base64));
		expect(distinctColors).toBeGreaterThan(20);
	});

	test('different names produce visibly different fallback avatars', async () => {
		const a = render(Avatar, { src: null, name: 'Alice', size: 'lg' });
		await new Promise((r) => setTimeout(r, 50));
		const aShot = (await a.getByRole('img', { name: 'Alice' }).screenshot({ base64: true })) as unknown as {
			base64: string;
		};

		const b = render(Avatar, { src: null, name: 'Bob', size: 'lg' });
		await new Promise((r) => setTimeout(r, 50));
		const bShot = (await b.getByRole('img', { name: 'Bob' }).screenshot({ base64: true })) as unknown as {
			base64: string;
		};

		const [aPixels, bPixels] = await Promise.all([decodePng(aShot.base64), decodePng(bShot.base64)]);
		expect(aPixels).not.toEqual(bPixels);
	});
});
