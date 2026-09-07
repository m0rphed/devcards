// Shared between the DB enum (domain.schema.ts), server-side form parsing
// (card-content.ts), and client UI (CardForm's swatch picker, the
// collection card list, StudyCardView/QuizCardView's accent border) — one
// source of truth for "what colors exist" so none of those can drift apart.
export const CARD_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export function isCardColor(value: unknown): value is CardColor {
	return typeof value === 'string' && (CARD_COLORS as readonly string[]).includes(value);
}

/** Tailwind classes as literal strings (not built from a template) so the JIT compiler can actually find them. */
export const CARD_COLOR_META: Record<CardColor, { label: string; dot: string; accent: string }> = {
	red: { label: 'Красный', dot: 'bg-red-400', accent: 'border-l-red-400' },
	orange: { label: 'Оранжевый', dot: 'bg-orange-400', accent: 'border-l-orange-400' },
	yellow: { label: 'Жёлтый', dot: 'bg-yellow-400', accent: 'border-l-yellow-400' },
	green: { label: 'Зелёный', dot: 'bg-green-400', accent: 'border-l-green-400' },
	blue: { label: 'Синий', dot: 'bg-blue-400', accent: 'border-l-blue-400' },
	purple: { label: 'Фиолетовый', dot: 'bg-purple-400', accent: 'border-l-purple-400' }
};
