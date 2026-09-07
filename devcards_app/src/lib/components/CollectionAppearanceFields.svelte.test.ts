import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CollectionAppearanceFields from './CollectionAppearanceFields.svelte';

describe('CollectionAppearanceFields', () => {
	test('defaults to "no color"/"no icon" checked, and picking swatches switches to them', async () => {
		const screen = render(CollectionAppearanceFields);

		await expect.element(screen.getByRole('radio', { name: 'Без цвета' })).toHaveAttribute('data-state', 'checked');
		await expect.element(screen.getByRole('radio', { name: 'Без иконки' })).toHaveAttribute('data-state', 'checked');

		// exact: true — "Синий" is a substring of "Ярко-синий", so a non-exact
		// match would ambiguously resolve to both swatches.
		await screen.getByRole('radio', { name: 'Синий', exact: true }).click();
		await expect.element(screen.getByRole('radio', { name: 'Без цвета' })).toHaveAttribute('data-state', 'unchecked');
		await expect.element(screen.getByRole('radio', { name: 'Синий', exact: true })).toHaveAttribute(
			'data-state',
			'checked'
		);

		await screen.getByRole('radio', { name: 'Rust' }).click();
		await expect.element(screen.getByRole('radio', { name: 'Без иконки' })).toHaveAttribute('data-state', 'unchecked');
		await expect.element(screen.getByRole('radio', { name: 'Rust' })).toHaveAttribute('data-state', 'checked');
	});

	test('initialColor/initialIcon seed the matching swatches as checked', async () => {
		const screen = render(CollectionAppearanceFields, { initialColor: 'brightGreen', initialIcon: 'python' });

		await expect.element(screen.getByRole('radio', { name: 'Ярко-зелёный' })).toHaveAttribute('data-state', 'checked');
		await expect.element(screen.getByRole('radio', { name: 'Python' })).toHaveAttribute('data-state', 'checked');
		await expect.element(screen.getByRole('radio', { name: 'Без цвета' })).toHaveAttribute('data-state', 'unchecked');
	});
});
