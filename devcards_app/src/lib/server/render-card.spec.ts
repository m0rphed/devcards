import { describe, expect, test } from 'vitest';
import { renderCard } from './render-card';

describe('renderCard', () => {
	test('basic: renders markdown and sanitizes both fields', async () => {
		const rendered = await renderCard('basic', {
			front: 'What is **bold**?',
			// blank line before "safe text": otherwise CommonMark treats it as
			// part of the same raw-HTML block as <script>, not a separate
			// paragraph — that's a markdown parsing rule, not a sanitizer bug
			back: '<script>window.__xss = true;</script>\n\nsafe text'
		});
		expect(rendered.kind).toBe('basic');
		if (rendered.kind !== 'basic') throw new Error('unreachable');
		expect(rendered.frontHtml).toContain('<strong>bold</strong>');
		expect(rendered.backHtml).not.toContain('<script>');
		expect(rendered.backHtml).toContain('safe text');
	});

	test('cloze: masked hides the answer, revealed shows it', async () => {
		const rendered = await renderCard('cloze', { text: 'горутины дешевле, чем {{c1::потоки ОС}}' });
		expect(rendered.kind).toBe('cloze');
		if (rendered.kind !== 'cloze') throw new Error('unreachable');
		expect(rendered.maskedHtml).toContain('[...]');
		expect(rendered.maskedHtml).not.toContain('потоки ОС');
		expect(rendered.revealedHtml).toContain('потоки ОС');
		expect(rendered.revealedHtml).not.toContain('[...]');
	});

	test('multiple_choice: renders the question, passes options through as-is', async () => {
		const rendered = await renderCard('multiple_choice', {
			question: 'Pick one',
			options: ['A', 'B', 'C'],
			correct_index: 2
		});
		expect(rendered.kind).toBe('multiple_choice');
		if (rendered.kind !== 'multiple_choice') throw new Error('unreachable');
		expect(rendered.questionHtml).toContain('Pick one');
		expect(rendered.options).toEqual(['A', 'B', 'C']);
		expect(rendered.correctIndex).toBe(2);
	});
});
