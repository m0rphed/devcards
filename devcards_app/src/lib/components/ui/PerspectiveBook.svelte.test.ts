import { describe, expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import PerspectiveBook from './PerspectiveBook.svelte';

function textSnippet(text: string) {
	return createRawSnippet(() => ({
		render: () => `<span>${text}</span>`
	}));
}

describe('PerspectiveBook', () => {
	test('renders its cover content', async () => {
		const screen = render(PerspectiveBook, { children: textSnippet('Go — вопросы для проверки') });
		await expect.element(screen.getByText('Go — вопросы для проверки')).toBeVisible();
	});

	test('textured=false renders no texture overlay; textured=true does', async () => {
		const plain = render(PerspectiveBook, { children: textSnippet('Cover'), textured: false });
		expect(plain.container.querySelector('[style*="perspective-book-textured"]')).toBeNull();

		const textured = render(PerspectiveBook, { children: textSnippet('Cover'), textured: true });
		expect(textured.container.querySelector('[style*="perspective-book-textured"]')).not.toBeNull();
	});

	test('a custom class overrides the default cover color classes entirely', async () => {
		const screen = render(PerspectiveBook, { children: textSnippet('Cover'), class: 'bg-[#cd0000] text-white' });
		const cover = screen.container.querySelector('.bg-\\[\\#cd0000\\]');
		expect(cover).not.toBeNull();
		expect(cover?.className).not.toContain('bg-neutral-100');
	});
});
