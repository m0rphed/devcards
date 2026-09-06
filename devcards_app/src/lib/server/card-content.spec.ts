import { describe, expect, test } from 'vitest';
import { parseCardContent } from './card-content';

function formData(entries: Record<string, string | string[]>): FormData {
	const fd = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
	}
	return fd;
}

describe('parseCardContent', () => {
	test('basic: accepts front + back', () => {
		const result = parseCardContent(formData({ type: 'basic', front: 'Q', back: 'A' }));
		expect(result).toEqual({ ok: true, type: 'basic', content: { front: 'Q', back: 'A' } });
	});

	test('basic: rejects missing back', () => {
		const result = parseCardContent(formData({ type: 'basic', front: 'Q', back: '' }));
		expect(result.ok).toBe(false);
	});

	test('cloze: accepts non-empty text', () => {
		const result = parseCardContent(formData({ type: 'cloze', text: 'горутины — {{c1::легковесные}}' }));
		expect(result).toEqual({ ok: true, type: 'cloze', content: { text: 'горутины — {{c1::легковесные}}' } });
	});

	test('cloze: rejects blank text (whitespace-only)', () => {
		const result = parseCardContent(formData({ type: 'cloze', text: '   ' }));
		expect(result.ok).toBe(false);
	});

	test('multiple_choice: accepts question + 2+ options + valid correct_index', () => {
		const result = parseCardContent(
			formData({ type: 'multiple_choice', question: 'Q?', options: ['A', 'B', 'C'], correct_index: '1' })
		);
		expect(result).toEqual({
			ok: true,
			type: 'multiple_choice',
			content: { question: 'Q?', options: ['A', 'B', 'C'], correct_index: 1 }
		});
	});

	test('multiple_choice: rejects fewer than 2 non-empty options', () => {
		const result = parseCardContent(
			formData({ type: 'multiple_choice', question: 'Q?', options: ['A', ''], correct_index: '0' })
		);
		expect(result.ok).toBe(false);
	});

	test('multiple_choice: rejects correct_index out of range', () => {
		const result = parseCardContent(
			formData({ type: 'multiple_choice', question: 'Q?', options: ['A', 'B'], correct_index: '5' })
		);
		expect(result.ok).toBe(false);
	});

	test('multiple_choice: rejects a non-integer correct_index', () => {
		const result = parseCardContent(
			formData({ type: 'multiple_choice', question: 'Q?', options: ['A', 'B'], correct_index: 'not-a-number' })
		);
		expect(result.ok).toBe(false);
	});

	test('rejects an unknown type', () => {
		const result = parseCardContent(formData({ type: 'essay' }));
		expect(result.ok).toBe(false);
	});
});
