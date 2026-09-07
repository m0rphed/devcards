// Standard mechanism for "should this go on light or dark text": WCAG 2.x
// relative luminance + contrast ratio (the same formula the W3C contrast
// guidelines, and every accessibility linter, are built on) — rather than
// hand-picking per swatch, which is exactly the kind of judgment call
// that's easy to get subtly wrong at scale (16 arbitrary hex values here).
// Returns literal Tailwind classes (not built from a template): the two
// possible return strings appear verbatim in this file's own source, so
// Tailwind's JIT scanner generates both utility classes regardless of the
// fact that the actual choice happens at runtime.

function srgbChannelToLinear(channel255: number): number {
	const c = channel255 / 255;
	return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white) of a `#rrggbb` hex color. */
export function relativeLuminance(hex: string): number {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

/** WCAG contrast ratio between two relative luminances — always >= 1. */
export function contrastRatio(luminanceA: number, luminanceB: number): number {
	const lighter = Math.max(luminanceA, luminanceB);
	const darker = Math.min(luminanceA, luminanceB);
	return (lighter + 0.05) / (darker + 0.05);
}

/** Whichever of black/white text has the higher WCAG contrast ratio against `hex`. */
export function pickReadableTextClass(hex: string): 'text-white' | 'text-black' {
	const bg = relativeLuminance(hex);
	const contrastWithWhite = contrastRatio(bg, 1);
	const contrastWithBlack = contrastRatio(bg, 0);
	return contrastWithWhite >= contrastWithBlack ? 'text-white' : 'text-black';
}
