import { describe, expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import Disclosure from './Disclosure.svelte';

function textSnippet(text: string) {
	return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

describe('Disclosure', () => {
	test('starts closed, opens on trigger click, content becomes visible', async () => {
		const screen = render(Disclosure, {
			trigger: textSnippet('Настройки'),
			children: textSnippet('Скрытое содержимое')
		});

		// Collapsible.Content stays in the DOM even closed (bits-ui defaults
		// to hiding it via the browser's native hidden="until-found", not by
		// not rendering it at all) — assert on visibility, not presence.
		await expect.element(screen.getByText('Скрытое содержимое')).not.toBeVisible();

		await screen.getByRole('button', { name: 'Настройки' }).click();
		await expect.element(screen.getByText('Скрытое содержимое')).toBeVisible();
	});

	test('open prop starts it open', async () => {
		const screen = render(Disclosure, {
			open: true,
			trigger: textSnippet('Настройки'),
			children: textSnippet('Уже открыто')
		});
		await expect.element(screen.getByText('Уже открыто')).toBeVisible();
	});
});
