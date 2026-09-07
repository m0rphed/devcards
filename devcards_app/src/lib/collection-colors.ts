// The classic 16-color ANSI/xterm terminal palette — a collection's cover
// color in the "book shelf" view. Deliberately a bigger, separate palette
// from $lib/card-colors.ts (6 presets) — collections are fewer and more
// "identity"-like than individual cards, and this is a different enum in
// the DB (collection_color vs card_color) so the two can't drift together
// by accident.
export const COLLECTION_COLORS = [
	'black',
	'red',
	'green',
	'yellow',
	'blue',
	'magenta',
	'cyan',
	'white',
	'brightBlack',
	'brightRed',
	'brightGreen',
	'brightYellow',
	'brightBlue',
	'brightMagenta',
	'brightCyan',
	'brightWhite'
] as const;
export type CollectionColor = (typeof COLLECTION_COLORS)[number];

export function isCollectionColor(value: unknown): value is CollectionColor {
	return typeof value === 'string' && (COLLECTION_COLORS as readonly string[]).includes(value);
}

/**
 * `hex` is the real xterm-default hex for that slot (used inline via
 * `style`, e.g. the swatch picker — an arbitrary runtime hex can't be a
 * Tailwind class, since Tailwind's JIT scanner only finds *literal* class
 * strings in source). `bgClass`/`textClass` are that same hex/contrast
 * choice pre-baked as literal Tailwind arbitrary-value classes instead —
 * for the PerspectiveBook cover, where a real class (not inline style) is
 * needed. Both encode the same color; keep them in sync if a hex ever
 * changes. `text` is picked by hand per swatch (not computed from a
 * contrast ratio) — light backgrounds (white/yellow/cyan/gray and their
 * bright variants) get black text, everything else gets white.
 */
export const COLLECTION_COLOR_META: Record<
	CollectionColor,
	{ label: string; hex: string; text: 'black' | 'white'; bgClass: string; textClass: string }
> = {
	black: { label: 'Чёрный', hex: '#000000', text: 'white', bgClass: 'bg-[#000000]', textClass: 'text-white' },
	red: { label: 'Красный', hex: '#cd0000', text: 'white', bgClass: 'bg-[#cd0000]', textClass: 'text-white' },
	green: { label: 'Зелёный', hex: '#00cd00', text: 'black', bgClass: 'bg-[#00cd00]', textClass: 'text-black' },
	yellow: { label: 'Жёлтый', hex: '#cdcd00', text: 'black', bgClass: 'bg-[#cdcd00]', textClass: 'text-black' },
	blue: { label: 'Синий', hex: '#0000ee', text: 'white', bgClass: 'bg-[#0000ee]', textClass: 'text-white' },
	magenta: { label: 'Пурпурный', hex: '#cd00cd', text: 'white', bgClass: 'bg-[#cd00cd]', textClass: 'text-white' },
	cyan: { label: 'Голубой', hex: '#00cdcd', text: 'black', bgClass: 'bg-[#00cdcd]', textClass: 'text-black' },
	white: { label: 'Серый', hex: '#e5e5e5', text: 'black', bgClass: 'bg-[#e5e5e5]', textClass: 'text-black' },
	brightBlack: {
		label: 'Тёмно-серый',
		hex: '#7f7f7f',
		text: 'white',
		bgClass: 'bg-[#7f7f7f]',
		textClass: 'text-white'
	},
	brightRed: { label: 'Ярко-красный', hex: '#ff0000', text: 'white', bgClass: 'bg-[#ff0000]', textClass: 'text-white' },
	brightGreen: {
		label: 'Ярко-зелёный',
		hex: '#00ff00',
		text: 'black',
		bgClass: 'bg-[#00ff00]',
		textClass: 'text-black'
	},
	brightYellow: {
		label: 'Ярко-жёлтый',
		hex: '#ffff00',
		text: 'black',
		bgClass: 'bg-[#ffff00]',
		textClass: 'text-black'
	},
	brightBlue: { label: 'Ярко-синий', hex: '#5c5cff', text: 'white', bgClass: 'bg-[#5c5cff]', textClass: 'text-white' },
	brightMagenta: {
		label: 'Ярко-пурпурный',
		hex: '#ff00ff',
		text: 'white',
		bgClass: 'bg-[#ff00ff]',
		textClass: 'text-white'
	},
	brightCyan: {
		label: 'Ярко-голубой',
		hex: '#00ffff',
		text: 'black',
		bgClass: 'bg-[#00ffff]',
		textClass: 'text-black'
	},
	brightWhite: { label: 'Белый', hex: '#ffffff', text: 'black', bgClass: 'bg-[#ffffff]', textClass: 'text-black' }
};
