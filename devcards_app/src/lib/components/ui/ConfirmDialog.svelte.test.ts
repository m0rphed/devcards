import { describe, expect, test } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'vitest-browser-svelte';
import ConfirmDialog from './ConfirmDialog.svelte';

function textSnippet(text: string) {
	return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

describe('ConfirmDialog', () => {
	// Regression test for the trickiest part of this component: AlertDialog.Portal
	// moves Content (and its Action button) to document.body, outside the real
	// <form> it's meant to submit — the `form={formId}` HTML attribute is what
	// bridges that gap. Verify it actually submits, not just that it compiles.
	test('Confirm submits the external form referenced by formId; Cancel does not', async () => {
		document.body.insertAdjacentHTML(
			'afterbegin',
			'<form id="test-target-form"></form>'
		);
		const form = document.getElementById('test-target-form') as HTMLFormElement;
		let submitCount = 0;
		form.addEventListener('submit', (e) => {
			e.preventDefault(); // don't actually navigate the test page
			submitCount++;
		});

		const screen = render(ConfirmDialog, {
			formId: 'test-target-form',
			title: 'Удалить карточку?',
			// Distinct trigger vs confirm labels — deliberately not both
			// "Удалить" as the real app does, so queries below are unambiguous.
			confirmLabel: 'Подтвердить',
			trigger: textSnippet('Открыть диалог'),
			description: textSnippet('Это необратимо.')
		});

		await screen.getByRole('button', { name: 'Открыть диалог' }).click();
		await expect.element(screen.getByText('Удалить карточку?')).toBeVisible();

		await screen.getByRole('button', { name: 'Отмена' }).click();
		expect(submitCount).toBe(0);
		expect(screen.getByText('Удалить карточку?').query()).toBeNull();

		await screen.getByRole('button', { name: 'Открыть диалог' }).click();
		await screen.getByRole('button', { name: 'Подтвердить' }).click();
		expect(submitCount).toBe(1);

		form.remove();
	});
});
