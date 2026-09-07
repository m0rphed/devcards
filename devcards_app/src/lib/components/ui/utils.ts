import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class lists the standard way: clsx for conditional/array
 * inputs, tailwind-merge to resolve genuinely conflicting utilities (e.g. a
 * wrapper's default `bg-blue-600` vs a caller-supplied `bg-red-600`) by a
 * fixed last-wins rule, rather than whichever happens to load later in the
 * CSS. Used by the ui/ wrapper components so a future per-instance `class`
 * override behaves predictably.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
