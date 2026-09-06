import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CardForm from './CardForm.svelte';

function settleCartaPreviewDebounce() {
	return new Promise((resolve) => setTimeout(resolve, 350));
}

describe('CardForm — basic type has two simultaneous editors (front + back)', () => {
	test('clicking Bold in the front editor only affects front, never back', async () => {
		// Regression test: Carta instances used to be shared across editor
		// widgets, so the *second*-mounted editor (back) silently stole the
		// first's (front) toolbar/caret targeting.
		const screen = render(CardForm, { formAction: '?/createCard' });

		const front = screen.getByLabelText('Лицевая сторона (markdown)');
		const back = screen.getByLabelText('Обратная сторона (markdown)');
		const boldButtons = screen.getByRole('button', { name: 'Bold' });

		await front.click();
		await boldButtons.nth(0).click();

		expect((front.element() as HTMLTextAreaElement).value).toContain('**');
		expect((back.element() as HTMLTextAreaElement).value).toBe('');

		// carta-md's preview pane re-renders on a 300ms debounce; let it settle
		// before the test unmounts the component, or it throws an unhandled
		// rejection trying to write into a torn-down DOM node.
		await settleCartaPreviewDebounce();
	});

	test('clicking Bold in the back editor only affects back, never front', async () => {
		const screen = render(CardForm, { formAction: '?/createCard' });

		const front = screen.getByLabelText('Лицевая сторона (markdown)');
		const back = screen.getByLabelText('Обратная сторона (markdown)');
		const boldButtons = screen.getByRole('button', { name: 'Bold' });

		await back.click();
		await boldButtons.nth(1).click();

		expect((back.element() as HTMLTextAreaElement).value).toContain('**');
		expect((front.element() as HTMLTextAreaElement).value).toBe('');

		await settleCartaPreviewDebounce();
	});
});
