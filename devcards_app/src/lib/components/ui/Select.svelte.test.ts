import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Select from './Select.svelte';

const OPTIONS = [
	{ value: 'viewer', label: 'viewer' },
	{ value: 'editor', label: 'editor' }
];

describe('Select', () => {
	test('shows the current value on the trigger, and picking an option updates it', async () => {
		const screen = render(Select, { value: 'viewer', options: OPTIONS });

		// Select.Trigger renders as a plain <button> — its accessible name via
		// getByRole('button', { name }) doesn't reliably match here (same
		// finding as CardForm's type-Select test), so target by text.
		await expect.element(screen.getByText('viewer')).toBeVisible();

		await screen.getByText('viewer').click();
		await screen.getByRole('option', { name: 'editor' }).click();

		await expect.element(screen.getByText('editor')).toBeVisible();
	});

	test('name prop renders a hidden input carrying the value for form submission', async () => {
		const screen = render(Select, { value: 'editor', options: OPTIONS, name: 'role' });
		const hidden = screen.container.querySelector('input[name="role"]') as HTMLInputElement;
		expect(hidden).not.toBeNull();
		expect(hidden.value).toBe('editor');
	});
});
