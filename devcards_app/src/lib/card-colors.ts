// Shared between the DB enum (domain.schema.ts), server-side form parsing
// (card-content.ts), and client UI (CardForm's swatch picker, the
// collection card list, StudyCardView/QuizCardView's accent border) — one
// source of truth for "what colors exist" so none of those can drift apart.
export const CARD_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export function isCardColor(value: unknown): value is CardColor {
	return typeof value === 'string' && (CARD_COLORS as readonly string[]).includes(value);
}

/**
 * Tailwind classes as literal strings (not built from a template) so the
 * JIT compiler can actually find them. `bg` is the *-100 tier deliberately —
 * unlike collection colors (an arbitrary 16-hex palette needing a computed
 * contrast text color, see contrast-text.ts), card colors are ordinary
 * named Tailwind hues, and Tailwind's own light tiers (50/100) are
 * specifically designed to stay readable with a fixed dark body-text color
 * — no per-color contrast computation needed here at all.
 */
export const CARD_COLOR_META: Record<CardColor, { label: string; dot: string; accent: string; bg: string; ring: string }> = {
	// `ring` is the swatch picker's own-hue selection halo (CardForm.svelte)
	// — a color-matched ring-offset-2 ring, the same idea as the
	// sv-animations "color-selector" spell's inset+outset halo, just done as
	// plain Tailwind utilities instead of a computed inline box-shadow (no
	// raw color value needed, since these are already Tailwind classes).
	red: { label: 'Красный', dot: 'bg-red-400', accent: 'border-l-red-400', bg: 'bg-red-100', ring: 'ring-red-400' },
	orange: {
		label: 'Оранжевый',
		dot: 'bg-orange-400',
		accent: 'border-l-orange-400',
		bg: 'bg-orange-100',
		ring: 'ring-orange-400'
	},
	yellow: {
		label: 'Жёлтый',
		dot: 'bg-yellow-400',
		accent: 'border-l-yellow-400',
		bg: 'bg-yellow-100',
		ring: 'ring-yellow-400'
	},
	green: {
		label: 'Зелёный',
		dot: 'bg-green-400',
		accent: 'border-l-green-400',
		bg: 'bg-green-100',
		ring: 'ring-green-400'
	},
	blue: { label: 'Синий', dot: 'bg-blue-400', accent: 'border-l-blue-400', bg: 'bg-blue-100', ring: 'ring-blue-400' },
	purple: {
		label: 'Фиолетовый',
		dot: 'bg-purple-400',
		accent: 'border-l-purple-400',
		bg: 'bg-purple-100',
		ring: 'ring-purple-400'
	}
};
