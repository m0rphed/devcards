import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Avatar from './Avatar.svelte';

describe('Avatar', () => {
	test('no src -> shows the fallback initial, not nothing (the bug this replaces)', async () => {
		const screen = render(Avatar, { src: null, name: 'Виктор' });
		await expect.element(screen.getByText('В')).toBeVisible();
		expect(screen.container.querySelector('img')).toBeNull();
	});

	test('with src -> renders the image', async () => {
		const screen = render(Avatar, { src: '/attachments/some-id', name: 'Виктор' });
		expect(screen.container.querySelector('img')).not.toBeNull();
	});
});
