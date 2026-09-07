<script lang="ts">
	import { Spring } from 'svelte/motion';
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import { createFlashcardFlip, type FlashcardFlip, type FlipDirection, type FlipState } from './useFlashcard.svelte';

	let {
		front,
		back,
		flipHook,
		flipDirection = 'ltr',
		manualFlip = false,
		disableFlip = false,
		onSkip,
		onFlip,
		stiffness = 0.25,
		damping = 0.9
	}: {
		front: Snippet;
		back: Snippet;
		/** Bring your own flip state (e.g. to reset several cards from a parent) — omit to let this component own it. */
		flipHook?: FlashcardFlip;
		flipDirection?: FlipDirection;
		manualFlip?: boolean;
		disableFlip?: boolean;
		/** Swipe up to move on without answering — omit to disable the gesture entirely. Only meaningful alongside a horizontal flipDirection (ltr/rtl); see isHorizontal below. */
		onSkip?: () => void;
		onFlip?: (state: FlipState) => void;
		/** Tune the flip's spring feel. */
		stiffness?: number;
		damping?: number;
	} = $props();

	// untrack(): flipHook/flipDirection/etc are construction-time inputs to
	// the hook, not meant to reactively reconstruct it on every prop change.
	const hook: FlashcardFlip = untrack(
		() => flipHook ?? createFlashcardFlip({ flipDirection, manualFlip, disableFlip, onFlip })
	);

	// --- Structural technique ported from react-quizlet-flashcard
	// (https://github.com/ABSanthosh/react-quizlet-flashcard) — this is the
	// part that actually matters and was the whole point of porting rather
	// than continuing to patch a from-scratch version: BOTH faces are
	// always in the DOM (not conditionally swapped), .flashcard itself
	// declares `transform-style: preserve-3d`, and each face has
	// `backface-visibility: hidden`. With preserve-3d present, the browser
	// correctly composes the face's own fixed counter-rotation with the
	// parent's live rotation into one real 3D space, so whichever face is
	// actually facing the viewer at any given moment is the one shown —
	// no JS "which face is showing" bookkeeping needed at all. (The
	// from-scratch version's bugs were exactly downstream of not having
	// this: content swapped on a plain reactive value instead of an
	// animated one, and then, once that was fixed, the shown face still got
	// hidden outright because its rotation was evaluated in an isolated,
	// un-composed 3D context — preserve-3d is the missing piece both times.)
	//
	// What's genuinely different from the reference: it flips as a single
	// discrete jump (a CSS class toggle, `transition: transform 0.45s`).
	// This app wanted the flip to track a live drag like turning a real
	// page, which needs the rotation itself to be a continuous, readable
	// value — so it's driven by a Spring instead, applied as an actual
	// `transform` string rather than the reference's `data-flip`/`data-dir`
	// attribute-selected `!important` rules.

	const isHorizontal = $derived(hook.flipDirection === 'ltr' || hook.flipDirection === 'rtl');
	const rotateAxis = $derived(isHorizontal ? 'Y' : 'X');
	const sign = $derived(hook.flipDirection === 'rtl' || hook.flipDirection === 'tb' ? -1 : 1);

	// 0 = front showing, 1 = back — continuous so a live drag can track the
	// pointer, unlike the reference's plain front/back toggle.
	const progress = new Spring(untrack(() => (hook.state === 'back' ? 1 : 0)), untrack(() => ({ stiffness, damping })));
	const offsetYSpring = new Spring(0, { stiffness: 0.3, damping: 0.85 });

	let dragging = $state(false);
	let axis: 'flip' | 'skip' | null = null;
	let flying = $state(false); // true while the post-skip fly-off transition plays
	let startX = 0;
	let startY = 0;
	let startTime = 0;
	let pointerId: number | null = null;
	let root: HTMLDivElement;
	let frontEl: HTMLDivElement;
	let backEl: HTMLDivElement;

	// Unlike the reference's fixed-size cards (it expects the caller to size
	// .flashcard-wrapper explicitly), this app's card content is arbitrary
	// rendered markdown of unpredictable height — and the back face is
	// absolutely positioned (needed so it doesn't drag the wrapper's own
	// height along when it happens to be taller than the front), so nothing
	// else would size the wrapper to fit it. Measure both faces live and
	// keep the wrapper tall enough for whichever is bigger.
	let frontHeight = $state(0);
	let backHeight = $state(0);
	const minHeight = $derived(Math.max(frontHeight, backHeight));

	$effect(() => {
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
				if (entry.target === frontEl) frontHeight = height;
				else if (entry.target === backEl) backHeight = height;
			}
		});
		observer.observe(frontEl);
		observer.observe(backEl);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!dragging) progress.target = hook.state === 'back' ? 1 : 0;
	});

	function clamp(n: number, lo: number, hi: number) {
		return Math.min(hi, Math.max(lo, n));
	}

	const AXIS_DEADZONE = 6; // px before an axis is committed to
	const SKIP_DISTANCE = 90; // px of upward drag that commits a skip outright
	const SKIP_VELOCITY = 0.5; // px/ms — a fast flick commits even short of SKIP_DISTANCE

	function onPointerDown(e: PointerEvent) {
		if (flying || hook.disableFlip || hook.manualFlip || e.button !== 0) return;
		dragging = true;
		axis = null;
		startX = e.clientX;
		startY = e.clientY;
		startTime = performance.now();
		pointerId = e.pointerId;
		root.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (axis === null) {
			if (Math.abs(dx) < AXIS_DEADZONE && Math.abs(dy) < AXIS_DEADZONE) return;
			axis = Math.abs(dx) > Math.abs(dy) ? 'flip' : 'skip';
		}

		if (axis === 'flip' && isHorizontal) {
			const base = hook.state === 'back' ? 1 : 0;
			progress.set(clamp(base + dx / 300, 0, 1), { instant: true });
		} else if (axis === 'skip' && onSkip) {
			// Only upward movement drives anything — there's nowhere for
			// "drag down" to go semantically, so it's just inert.
			offsetYSpring.set(Math.min(0, dy), { instant: true });
		}
	}

	function settle() {
		dragging = false;
		pointerId = null;
		axis = null;
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		const elapsedMs = Math.max(performance.now() - startTime, 1);
		const committedAxis = axis;
		const finalProgress = progress.current;
		const finalOffsetY = offsetYSpring.current;
		settle();

		if (committedAxis === 'flip') {
			hook.flip(finalProgress > 0.5 ? 'back' : 'front');
			// Explicit rather than relying solely on the $effect above: if
			// this drag ended up back where it started (state didn't
			// actually change), that effect never re-fires, and the spring
			// would otherwise sit stranded mid-drag instead of settling.
			progress.target = hook.state === 'back' ? 1 : 0;
		} else if (committedAxis === 'skip' && onSkip) {
			const velocity = Math.abs(finalOffsetY) / elapsedMs;
			if (-finalOffsetY > SKIP_DISTANCE || velocity > SKIP_VELOCITY) {
				flying = true;
				setTimeout(() => onSkip(), 220);
				return;
			}
			offsetYSpring.target = 0;
		}
	}

	function onClick() {
		if (hook.disableFlip || hook.manualFlip || axis !== null) return; // a real drag already resolved on pointerup
		hook.flip();
	}
</script>

<!-- Deliberately not role="button"/tabindex: card content is arbitrary
     rendered markdown that can itself contain interactive elements (links),
     and nesting those inside another interactive/focusable element is a
     real ARIA violation, not just a lint nag. This div is a pointer/mouse
     enhancement layer only — the caller's explicit "Показать ответ" button
     is the real keyboard/screen-reader-accessible way to flip. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={root}
	class="flashcard-wrapper"
	class:flying
	class:flashcard-wrapper--disabled={hook.disableFlip}
	style:min-height="{minHeight}px"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={settle}
	onclick={onClick}
>
	<div
		class="flashcard"
		style:transform="translateY({flying ? -140 : offsetYSpring.current}{flying
			? '%'
			: 'px'}) rotate{rotateAxis}({sign * 180 * progress.current}deg)"
	>
		<div bind:this={frontEl} class="flashcard__face flashcard__front">
			{@render front()}
		</div>
		<div
			bind:this={backEl}
			class="flashcard__face flashcard__back"
			style:transform="rotate{rotateAxis}({sign * 180}deg)"
		>
			{@render back()}
		</div>
	</div>
</div>

<style>
	.flashcard-wrapper {
		position: relative;
		perspective: 1400px;
		cursor: pointer;
		/* We handle both drag axes ourselves via pointer events — don't let
		   the browser's own touch scrolling/panning fight the gesture. */
		touch-action: none;
		user-select: none;
	}
	.flashcard-wrapper--disabled {
		cursor: default;
	}
	.flashcard {
		position: relative;
		width: 100%;
		/* The one structural property the from-scratch version was missing
		   both times — without it, a face's own counter-rotation is
		   evaluated in isolation from this element's rotation instead of
		   composed with it in one real 3D space. */
		transform-style: preserve-3d;
	}
	.flying .flashcard {
		/* The inline transform (see the template) switches to a fixed
		   fly-away value the instant `flying` becomes true — this transition
		   is what actually animates that jump instead of snapping to it. */
		transition:
			transform 0.22s ease-in,
			opacity 0.22s ease-in;
		opacity: 0;
	}
	.flashcard__face {
		backface-visibility: hidden;
	}
	.flashcard__back {
		position: absolute;
		inset: 0;
	}
</style>
