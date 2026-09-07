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

	// --- Rendering technique ---
	// This app originally ported react-quizlet-flashcard's real 3D flip
	// (both faces always in the DOM, rotated on a `transform-style:
	// preserve-3d` parent, culled via `backface-visibility: hidden`). That
	// technique broke in production *twice* with the classic real-3D-gone-
	// wrong signature: mirrored, overlapping text — both faces painting at
	// once because the browser flattened the 3D context instead of composing
	// it the way the reference (and every textbook writeup of the technique)
	// assumes. It looked right in headless Chromium both times, which is
	// exactly the trap: `backface-visibility`/`preserve-3d` interaction is
	// notoriously inconsistent across real engines and even real Chrome
	// builds depending on ancestor properties, and there is no way to assert
	// against that from a test — the whole point of that CSS is to do
	// something JS can't observe.
	//
	// So this drops real 3D entirely. Only ONE face is ever in the DOM at a
	// time — there is nothing to backface-cull because there's nothing to
	// hide. The flip illusion is a 2D squash: the card scales down to zero
	// width (or height, for a vertical flipDirection) and back up, and the
	// face is swapped at the exact zero-width instant, which is invisible.
	// Because the swap and the squash are both driven off the same spring
	// value, they can't desync the way the from-scratch version's plain
	// reactive swap + separate CSS transition did (that was the *first*
	// production bug, before the 3D one). This can't look quite as
	// "physically real" as a true rotation, but it can't mis-render, either
	// — which, after two rounds of a technically-correct-on-paper 3D
	// approach failing in the field, is worth more right now.

	const isHorizontal = $derived(hook.flipDirection === 'ltr' || hook.flipDirection === 'rtl');

	// 0 = front showing, 1 = back — continuous so a live drag can track the
	// pointer, and so content-swap and the visual squash share one clock.
	const progress = new Spring(untrack(() => (hook.state === 'back' ? 1 : 0)), untrack(() => ({ stiffness, damping })));
	const offsetYSpring = new Spring(0, { stiffness: 0.3, damping: 0.85 });

	// |cos(progress·π)|: 1 at progress 0 or 1 (flat, fully showing), 0 at
	// progress 0.5 (edge-on) — the squash curve driving the visible scale.
	const scale = $derived(Math.abs(Math.cos(progress.current * Math.PI)));
	// Which face is actually in the DOM right now — swapping at the halfway
	// point means it happens exactly when scale is ~0, i.e. invisible.
	const showingBack = $derived(progress.current >= 0.5);

	let dragging = $state(false);
	let axis: 'flip' | 'skip' | null = null;
	let flying = $state(false); // true while the post-skip fly-off transition plays
	let startX = 0;
	let startY = 0;
	let startTime = 0;
	let pointerId: number | null = null;
	let root: HTMLDivElement;

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
	style:transform="translateY({flying ? -140 : offsetYSpring.current}{flying ? '%' : 'px'})"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={settle}
	onclick={onClick}
>
	<div class="flashcard" style:transform={isHorizontal ? `scaleX(${scale})` : `scaleY(${scale})`}>
		{#if showingBack}
			<div class="flashcard__face">
				{@render back()}
			</div>
		{:else}
			<div class="flashcard__face">
				{@render front()}
			</div>
		{/if}
	</div>
</div>

<style>
	.flashcard-wrapper {
		position: relative;
		cursor: pointer;
		/* We handle both drag axes ourselves via pointer events — don't let
		   the browser's own touch scrolling/panning fight the gesture. */
		touch-action: none;
		user-select: none;
	}
	.flashcard-wrapper--disabled {
		cursor: default;
	}
	.flying .flashcard {
		transition:
			transform 0.22s ease-in,
			opacity 0.22s ease-in;
		opacity: 0;
	}
	.flashcard__face {
		/* The squash only ever fully hides content at the exact zero-width
		   instant (where the face is also swapped) — everywhere else it's a
		   partially-squeezed but otherwise fully painted, non-mirrored view
		   of whichever single face is currently mounted. */
		width: 100%;
	}
</style>
