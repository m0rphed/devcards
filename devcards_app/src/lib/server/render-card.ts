import { carta } from '$lib/markdown';
import type { CardContent } from '$lib/server/db/domain.schema';

const CLOZE_PATTERN = /\{\{c\d+::(.*?)\}\}/g;

function maskCloze(text: string, reveal: boolean): string {
	return text.replace(CLOZE_PATTERN, (_, answer: string) => (reveal ? answer : '[...]'));
}

export type RenderedCard =
	| { kind: 'basic'; frontHtml: string; backHtml: string }
	| { kind: 'cloze'; maskedHtml: string; revealedHtml: string }
	| { kind: 'multiple_choice'; questionHtml: string; options: string[]; correctIndex: number };

/**
 * Pre-renders a card's markdown fields to sanitized HTML, server-side, once —
 * study/quiz views then just toggle *visibility* of already-rendered HTML
 * (no client-side markdown processing anywhere outside the editor itself).
 *
 * Cloze is the one type where the actual text differs between masked and
 * revealed (the `{{c1::answer}}` span itself changes) — rather than shipping
 * raw markdown + a client-side renderer just for that, we render both
 * variants up front; everything else only ever needs one render per field.
 */
export function renderCard(type: string, content: CardContent): RenderedCard {
	if (type === 'cloze') {
		const c = content as { text: string };
		return {
			kind: 'cloze',
			maskedHtml: carta.renderSSR(maskCloze(c.text, false)),
			revealedHtml: carta.renderSSR(maskCloze(c.text, true))
		};
	}

	if (type === 'multiple_choice') {
		const c = content as { question: string; options: string[]; correct_index: number };
		return {
			kind: 'multiple_choice',
			questionHtml: carta.renderSSR(c.question),
			options: c.options,
			correctIndex: c.correct_index
		};
	}

	const c = content as { front: string; back: string };
	return { kind: 'basic', frontHtml: carta.renderSSR(c.front), backHtml: carta.renderSSR(c.back) };
}
