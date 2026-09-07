import { describe, expect, test } from 'vitest';
import { contrastRatio, pickReadableTextClass, relativeLuminance } from './contrast-text';

describe('relativeLuminance', () => {
	test('black is 0, white is 1', () => {
		expect(relativeLuminance('#000000')).toBe(0);
		expect(relativeLuminance('#ffffff')).toBe(1);
	});
});

describe('contrastRatio', () => {
	test('black vs white is the maximum possible ratio, 21:1', () => {
		expect(contrastRatio(0, 1)).toBeCloseTo(21, 0);
	});

	test('a color against itself is 1:1 (no contrast)', () => {
		expect(contrastRatio(0.5, 0.5)).toBeCloseTo(1, 5);
	});

	test('is symmetric — argument order does not matter', () => {
		expect(contrastRatio(0.2, 0.8)).toBeCloseTo(contrastRatio(0.8, 0.2), 10);
	});
});

describe('pickReadableTextClass', () => {
	test('white background -> black text, black background -> white text', () => {
		expect(pickReadableTextClass('#ffffff')).toBe('text-black');
		expect(pickReadableTextClass('#000000')).toBe('text-white');
	});

	test('a dark, saturated color (xterm red) -> white text', () => {
		expect(pickReadableTextClass('#cd0000')).toBe('text-white');
	});

	test('a light, saturated color (bright yellow) -> black text', () => {
		expect(pickReadableTextClass('#ffff00')).toBe('text-black');
	});
});
