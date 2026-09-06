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
 * Async and uses `carta.render()`, not the sync `renderSSR()`: renderSSR is
 * documented to always skip syntax highlighting (that's the whole reason it
 * can be sync — Shiki's tokenizer setup is inherently async), so code blocks
 * would come out as plain unstyled <pre> otherwise.
 *
 * Cloze is the one type where the actual text differs between masked and
 * revealed (the `{{c1::answer}}` span itself changes) — rather than shipping
 * raw markdown + a client-side renderer just for that, we render both
 * variants up front; everything else only ever needs one render per field.
 */
export async function renderCard(type: string, content: CardContent): Promise<RenderedCard> {
	if (type === 'cloze') {
		const c = content as { text: string };
		const [maskedHtml, revealedHtml] = await Promise.all([
			carta.render(maskCloze(c.text, false)),
			carta.render(maskCloze(c.text, true))
		]);
		return { kind: 'cloze', maskedHtml, revealedHtml };
	}

	if (type === 'multiple_choice') {
		const c = content as { question: string; options: string[]; correct_index: number };
		return {
			kind: 'multiple_choice',
			questionHtml: await carta.render(c.question),
			options: c.options,
			correctIndex: c.correct_index
		};
	}

	const c = content as { front: string; back: string };
	const [frontHtml, backHtml] = await Promise.all([carta.render(c.front), carta.render(c.back)]);
	return { kind: 'basic', frontHtml, backHtml };
}
