// Svelte port of react-quizlet-flashcard's useFlashcard hook
// (https://github.com/ABSanthosh/react-quizlet-flashcard) — a small object
// owning "which side is showing", so a parent can optionally create one
// itself and pass it in (Flashcard.svelte's `flipHook` prop) to control the
// card from outside, exactly like the original's flipHook pattern. Nothing
// in this app actually needs that yet (every card here is one independent
// component instance), but it costs nothing to keep and matches the
// reference's real API rather than a stripped-down reinterpretation of it.

export type FlipState = 'front' | 'back';
// right-to-left / left-to-right / top-to-bottom / bottom-to-top — same
// vocabulary and axis mapping as the original.
export type FlipDirection = 'rtl' | 'ltr' | 'tb' | 'bt';

export type FlashcardFlip = {
	readonly state: FlipState;
	manualFlip: boolean;
	disableFlip: boolean;
	flipDirection: FlipDirection;
	/** Flips to the given side, or toggles if omitted. No-ops under disableFlip; no-ops (and skips onFlip) if the requested side is already showing. */
	flip(state?: FlipState): void;
	resetCardState(): void;
};

export function createFlashcardFlip(
	options: {
		manualFlip?: boolean;
		disableFlip?: boolean;
		flipDirection?: FlipDirection;
		onFlip?: (state: FlipState) => void;
	} = {}
): FlashcardFlip {
	let state = $state<FlipState>('front');
	// $state, not a plain field: quiz mode flips this live (locked while the
	// typed-answer step hasn't been submitted yet, unlocked once it has) —
	// a plain field wouldn't be reactive from Flashcard.svelte's pointer
	// handlers, which read it on every interaction.
	let manualFlip = $state(options.manualFlip ?? false);
	let disableFlip = $state(options.disableFlip ?? false);

	return {
		get state() {
			return state;
		},
		get manualFlip() {
			return manualFlip;
		},
		set manualFlip(v) {
			manualFlip = v;
		},
		get disableFlip() {
			return disableFlip;
		},
		set disableFlip(v) {
			disableFlip = v;
		},
		flipDirection: options.flipDirection ?? 'ltr',
		flip(next?: FlipState) {
			if (disableFlip) return;
			const newState = next ?? (state === 'front' ? 'back' : 'front');
			if (newState === state) return;
			state = newState;
			options.onFlip?.(newState);
		},
		resetCardState() {
			state = 'front';
		}
	};
}
