import { describe, expect, test } from 'vitest';
import { parseCollectionColor, parseCollectionIcon } from './collections';

function formData(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [key, value] of Object.entries(entries)) fd.set(key, value);
	return fd;
}

describe('parseCollectionColor', () => {
	test('accepts a known preset', () => {
		expect(parseCollectionColor(formData({ color: 'brightRed' }))).toBe('brightRed');
	});

	test('treats the "no color" sentinel as null', () => {
		expect(parseCollectionColor(formData({ color: 'none' }))).toBeNull();
	});

	test('treats a missing or unrecognized value as null (not an error)', () => {
		expect(parseCollectionColor(formData({}))).toBeNull();
		expect(parseCollectionColor(formData({ color: 'not-a-real-color' }))).toBeNull();
	});
});

describe('parseCollectionIcon', () => {
	test('accepts a known preset', () => {
		expect(parseCollectionIcon(formData({ icon: 'svelte' }))).toBe('svelte');
	});

	test('treats the "no icon" sentinel as null', () => {
		expect(parseCollectionIcon(formData({ icon: 'none' }))).toBeNull();
	});

	test('treats a missing or unrecognized value as null (not an error)', () => {
		expect(parseCollectionIcon(formData({}))).toBeNull();
		expect(parseCollectionIcon(formData({ icon: 'not-a-real-icon' }))).toBeNull();
	});
});
