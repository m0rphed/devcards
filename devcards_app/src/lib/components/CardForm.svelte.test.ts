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

describe('CardForm — type Select switches which fields show', () => {
	test('picking "Пропуск в тексте" swaps front/back for the cloze textarea', async () => {
		const screen = render(CardForm, { formAction: '?/createCard' });

		await expect.element(screen.getByLabelText('Лицевая сторона (markdown)')).toBeVisible();
		// Mounting front/back schedules their own initial debounced preview
		// render (fires once on mount regardless of typing) — switching type
		// below unmounts both, so let that settle first or it throws trying
		// to write into a torn-down node mid-test, not just at the end.
		await settleCartaPreviewDebounce();

		// Select.Trigger renders as a plain <button> (implicit role "button",
		// not "combobox" — that ARIA role belongs to a different internal
		// search-input element this non-searchable single-select never
		// renders). getByRole('button', { name }) fails to match it — its
		// accessible-name computation apparently trips over the chevron <svg>
		// child despite it being aria-hidden (confirmed: getByRole('button')
		// with no name filter finds it fine; getByText on the exact same
		// label does too) — so target it by text instead.
		await screen.getByText('Вопрос/ответ').click();
		await screen.getByRole('option', { name: 'Пропуск в тексте' }).click();

		await expect.element(screen.getByLabelText(/Текст с пропуском/)).toBeVisible();
		expect(screen.getByLabelText('Лицевая сторона (markdown)').query()).toBeNull();

		await settleCartaPreviewDebounce();
	});
});

describe('CardForm — multiple_choice correct-answer RadioGroup', () => {
	test('picking an option checks it and unchecks the previous one, both stay part of one group', async () => {
		const screen = render(CardForm, { formAction: '?/createCard', initialType: 'multiple_choice' });

		// Scoped by name, not plain getByRole('radio') — the card-color
		// swatch picker (added alongside this test) is a separate RadioGroup
		// earlier in the DOM, and it's also made of role="radio" elements;
		// an unscoped query would silently pick those up by index instead.
		const radios = screen.getByRole('radio', { name: /^Отметить вариант/ });
		await expect.element(radios.nth(0)).toHaveAttribute('data-state', 'checked');
		await expect.element(radios.nth(1)).toHaveAttribute('data-state', 'unchecked');

		await radios.nth(1).click();

		await expect.element(radios.nth(0)).toHaveAttribute('data-state', 'unchecked');
		await expect.element(radios.nth(1)).toHaveAttribute('data-state', 'checked');

		await settleCartaPreviewDebounce();
	});

	test('removing an option before the checked one keeps the same option checked', async () => {
		const screen = render(CardForm, {
			formAction: '?/createCard',
			initialType: 'multiple_choice',
			initialContent: { question: 'Q', options: ['A', 'B', 'C'], correct_index: 2 }
		});

		const radios = screen.getByRole('radio', { name: /^Отметить вариант/ });
		await expect.element(radios.nth(2)).toHaveAttribute('data-state', 'checked');

		// Removing option A (index 0) shifts B/C up by one; correctIndex only
		// self-corrects when it would otherwise point past the end of the
		// list (removeOption's actual guard), so C staying checked here is
		// what's actually being asserted, not "always tracks the same label".
		await screen.getByRole('button', { name: 'Удалить вариант 1' }).click();
		await expect.element(radios.nth(1)).toHaveAttribute('data-state', 'checked');

		await settleCartaPreviewDebounce();
	});
});

describe('CardForm — card-color swatch picker', () => {
	test('defaults to "no color" checked, and picking a swatch switches to it', async () => {
		const screen = render(CardForm, { formAction: '?/createCard' });

		await expect.element(screen.getByRole('radio', { name: 'Без цвета' })).toHaveAttribute('data-state', 'checked');
		await expect.element(screen.getByRole('radio', { name: 'Синий' })).toHaveAttribute('data-state', 'unchecked');

		await screen.getByRole('radio', { name: 'Синий' }).click();

		await expect.element(screen.getByRole('radio', { name: 'Без цвета' })).toHaveAttribute('data-state', 'unchecked');
		await expect.element(screen.getByRole('radio', { name: 'Синий' })).toHaveAttribute('data-state', 'checked');

		await settleCartaPreviewDebounce();
	});

	test('initialColor seeds the matching swatch as checked', async () => {
		const screen = render(CardForm, { formAction: '?/createCard', initialColor: 'green' });

		await expect.element(screen.getByRole('radio', { name: 'Зелёный' })).toHaveAttribute('data-state', 'checked');
		await expect.element(screen.getByRole('radio', { name: 'Без цвета' })).toHaveAttribute('data-state', 'unchecked');

		await settleCartaPreviewDebounce();
	});
});
