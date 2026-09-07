// The classic 16-color ANSI/xterm terminal palette — a collection's cover
// color in the "book shelf" view. Deliberately a bigger, separate palette
// from $lib/card-colors.ts (6 presets) — collections are fewer and more
// "identity"-like than individual cards, and this is a different enum in
// the DB (collection_color vs card_color) so the two can't drift together
// by accident.
import { pickReadableTextClass } from './contrast-text';

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
 * strings in source). `bgClass` is that same hex pre-baked as a literal
 * Tailwind arbitrary-value class instead — for contexts that need a real
 * class rather than inline style (PerspectiveBook covers, tinted list
 * rows). `textClass` is computed via WCAG contrast (contrast-text.ts), not
 * hand-picked — it's still JIT-safe despite being a function call: both of
 * its possible return strings appear literally in that file's own source,
 * which is all Tailwind's static scanner needs to generate them.
 */
function colorMeta(label: string, hex: string, bgClass: string) {
	return { label, hex, bgClass, textClass: pickReadableTextClass(hex) };
}

export const COLLECTION_COLOR_META: Record<
	CollectionColor,
	{ label: string; hex: string; bgClass: string; textClass: 'text-white' | 'text-black' }
> = {
	black: colorMeta('Чёрный', '#000000', 'bg-[#000000]'),
	red: colorMeta('Красный', '#cd0000', 'bg-[#cd0000]'),
	green: colorMeta('Зелёный', '#00cd00', 'bg-[#00cd00]'),
	yellow: colorMeta('Жёлтый', '#cdcd00', 'bg-[#cdcd00]'),
	blue: colorMeta('Синий', '#0000ee', 'bg-[#0000ee]'),
	magenta: colorMeta('Пурпурный', '#cd00cd', 'bg-[#cd00cd]'),
	cyan: colorMeta('Голубой', '#00cdcd', 'bg-[#00cdcd]'),
	white: colorMeta('Серый', '#e5e5e5', 'bg-[#e5e5e5]'),
	brightBlack: colorMeta('Тёмно-серый', '#7f7f7f', 'bg-[#7f7f7f]'),
	brightRed: colorMeta('Ярко-красный', '#ff0000', 'bg-[#ff0000]'),
	brightGreen: colorMeta('Ярко-зелёный', '#00ff00', 'bg-[#00ff00]'),
	brightYellow: colorMeta('Ярко-жёлтый', '#ffff00', 'bg-[#ffff00]'),
	brightBlue: colorMeta('Ярко-синий', '#5c5cff', 'bg-[#5c5cff]'),
	brightMagenta: colorMeta('Ярко-пурпурный', '#ff00ff', 'bg-[#ff00ff]'),
	brightCyan: colorMeta('Ярко-голубой', '#00ffff', 'bg-[#00ffff]'),
	brightWhite: colorMeta('Белый', '#ffffff', 'bg-[#ffffff]')
};
