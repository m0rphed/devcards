import { describe, expect, test } from 'vitest';
import { parseTagNames } from './tags';

describe('parseTagNames', () => {
	test('splits on commas and trims whitespace', () => {
		expect(parseTagNames('go,  concurrency ,channels')).toEqual(['go', 'concurrency', 'channels']);
	});

	test('drops empty entries', () => {
		expect(parseTagNames('go, , , concurrency')).toEqual(['go', 'concurrency']);
	});

	test('dedupes case-insensitively, keeping the first-seen casing', () => {
		expect(parseTagNames('Go, go, GO, javascript')).toEqual(['Go', 'javascript']);
	});

	test('empty input yields no tags', () => {
		expect(parseTagNames('')).toEqual([]);
		expect(parseTagNames('   ')).toEqual([]);
	});
});
