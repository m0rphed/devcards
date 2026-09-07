import type { CardContent } from '$lib/server/db/domain.schema';
import { isCardColor, type CardColor } from '$lib/card-colors';

/** Missing/unrecognized (e.g. the picker's "no color" option) both mean "no tint". */
export function parseCardColor(formData: FormData): CardColor | null {
	const raw = formData.get('color')?.toString();
	return isCardColor(raw) ? raw : null;
}

export type ParsedCard =
	| { ok: true; type: 'basic' | 'cloze' | 'multiple_choice'; content: CardContent }
	| { ok: false; message: string };

/** Shared by the create-card and update-card actions so both validate identically. */
export function parseCardContent(formData: FormData): ParsedCard {
	const type = formData.get('type')?.toString();

	if (type === 'basic') {
		const front = formData.get('front')?.toString().trim() ?? '';
		const back = formData.get('back')?.toString().trim() ?? '';
		if (!front || !back) return { ok: false, message: 'Заполни лицевую и обратную стороны' };
		return { ok: true, type, content: { front, back } };
	}

	if (type === 'cloze') {
		const text = formData.get('text')?.toString().trim() ?? '';
		if (!text) return { ok: false, message: 'Заполни текст с пропуском' };
		return { ok: true, type, content: { text } };
	}

	if (type === 'multiple_choice') {
		const question = formData.get('question')?.toString().trim() ?? '';
		const options = formData
			.getAll('options')
			.map((o) => o.toString().trim())
			.filter(Boolean);
		const correctIndex = Number(formData.get('correct_index'));

		if (!question || options.length < 2) {
			return { ok: false, message: 'Заполни вопрос и минимум 2 варианта ответа' };
		}
		if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
			return { ok: false, message: 'Отметь правильный вариант ответа' };
		}
		return { ok: true, type, content: { question, options, correct_index: correctIndex } };
	}

	return { ok: false, message: 'Некорректный тип карточки' };
}
