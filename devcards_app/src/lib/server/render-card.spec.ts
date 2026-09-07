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

	test('basic: renders LaTeX/KaTeX math, and DOMPurify does not strip it', async () => {
		// Regression test: rehype-katex's output leans on MathML tags and lots
		// of inline `style="..."` attributes — easy for a sanitizer allowlist
		// to quietly eat. Assert on the actual output rather than trusting
		// that DOMPurify's defaults cover it.
		const rendered = await renderCard('basic', {
			front: 'Pythagorean theorem: $a^2+b^2=c^2$',
			back: '$$\\int_0^\\infty e^{-x}\\,dx = 1$$'
		});
		expect(rendered.kind).toBe('basic');
		if (rendered.kind !== 'basic') throw new Error('unreachable');
		expect(rendered.frontHtml).toContain('class="katex"');
		expect(rendered.backHtml).toContain('class="katex"');
		// The two things DOMPurify defaults are most likely to have quietly
		// eaten: KaTeX's positioning relies on inline style=, and
		// rehype-katex's default output includes a MathML <math> tree
		// alongside the HTML rendering.
		expect(rendered.frontHtml).toMatch(/style="[^"]/);
		expect(rendered.frontHtml).toContain('<math');
	});

	test('basic: renders a fenced code block with the configured catppuccin-latte Shiki theme', async () => {
		// Regression test for a real carta-md 4.11.2 bug: a single-string
		// `theme` silently loads garbage colors instead of the real theme
		// (traced to loadHighlighter()'s single-theme branch). markdown.ts
		// works around it with a same-name DualTheme — assert on catppuccin-
		// latte's actual editor.background (#eff1f5), not a guess, so a
		// regression back to the broken path (which renders a generic dark
		// background instead) would fail this test.
		const rendered = await renderCard('basic', {
			front: '```js\nconst x = 1;\n```',
			back: 'x'
		});
		expect(rendered.kind).toBe('basic');
		if (rendered.kind !== 'basic') throw new Error('unreachable');
		expect(rendered.frontHtml).toContain('class="shiki');
		expect(rendered.frontHtml).toContain('background-color:#eff1f5');
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
