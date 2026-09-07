<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		flipped = $bindable(false),
		front,
		back,
		onSkip,
		disabled = false
	}: {
		flipped?: boolean;
		front: Snippet;
		back: Snippet;
		/** Swipe the card up to move on without answering — omit to disable the gesture entirely. */
		onSkip?: () => void;
		/** Ignores pointer/click entirely — `flipped` can still be changed programmatically (e.g. quiz mode gating the flip behind an explicit "commit your answer first" step). */
		disabled?: boolean;
	} = $props();

	// Drag state. Not $state where it doesn't need to be reactive (startX/Y,
	// pointerId, timestamps are read-only bookkeeping between pointer
	// events, never rendered) — only the values that actually drive the
	// live transform need to be.
	let dragging = $state(false);
	let axis: 'x' | 'y' | null = null;
	let dragRotation = $state(0); // deg, added to the flipped base while dragging horizontally
	let dragOffsetY = $state(0); // px, while dragging vertically (upward only — see onpointermove)
	let flying = $state(false); // true while the post-skip fly-off transition plays
	let startX = 0;
	let startY = 0;
	let startTime = 0;
	let pointerId: number | null = null;
	let root: HTMLDivElement;

	const FLIP_SENSITIVITY = 0.6; // deg of rotation per px of horizontal drag
	const AXIS_DEADZONE = 6; // px of movement before an axis is committed to — keeps a plain tap from jittering into a micro-drag
	const SKIP_DISTANCE = 90; // px of upward drag that commits a skip outright
	const SKIP_VELOCITY = 0.5; // px/ms — a fast flick commits even short of SKIP_DISTANCE

	function clamp(n: number, lo: number, hi: number) {
		return Math.min(hi, Math.max(lo, n));
	}

	// Only one face is ever in the DOM at a time (not two absolutely-positioned
	// faces with backface-visibility, the more common flip-card technique) —
	// card content is arbitrary rendered markdown of unpredictable height, and
	// that technique needs a fixed height to avoid the hidden face dictating
	// (or ignoring) the container's size. Swapping which face renders at the
	// 90° midpoint sidesteps it entirely, and rotation naturally hides the
	// swap: right at 90° the card is edge-on to the viewer.
	const baseRotation = $derived(flipped ? 180 : 0);
	const rotation = $derived(clamp(baseRotation + (dragging && axis === 'x' ? dragRotation : 0), 0, 180));
	const showingBack = $derived(rotation > 90);
	const offsetY = $derived(dragging && axis === 'y' ? dragOffsetY : 0);

	function onPointerDown(e: PointerEvent) {
		if (flying || disabled || e.button !== 0) return;
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
			axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
		}

		if (axis === 'x') {
			dragRotation = dx * FLIP_SENSITIVITY;
		} else if (onSkip) {
			// Only upward movement drives anything — there's nowhere for
			// "drag down" to go semantically, so it's just inert.
			dragOffsetY = Math.min(0, dy);
		}
	}

	function settle() {
		dragging = false;
		pointerId = null;
		axis = null;
		dragRotation = 0;
		dragOffsetY = 0;
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		const elapsedMs = Math.max(performance.now() - startTime, 1);
		const committedAxis = axis;
		const finalRotation = rotation;
		const finalOffsetY = dragOffsetY;
		settle();

		if (committedAxis === 'x') {
			flipped = finalRotation > 90;
		} else if (committedAxis === 'y' && onSkip) {
			const velocity = Math.abs(finalOffsetY) / elapsedMs;
			if (-finalOffsetY > SKIP_DISTANCE || velocity > SKIP_VELOCITY) {
				flying = true;
				// Let the fly-off transition (see .flying below) actually play
				// before telling the parent to swap in the next card out from
				// under it.
				setTimeout(() => onSkip(), 220);
			}
		}
	}

	// A tap (pointerdown+up with no committed axis) should still flip — this
	// runs via the click event rather than inside onPointerUp so it stays
	// unified with real keyboard/mouse clicks on the explicit "Показать
	// ответ" button elsewhere, not a special case only the drag handler knows.
	function onClick() {
		if (disabled || axis !== null) return; // a real drag already resolved on pointerup
		flipped = !flipped;
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
	class="flip-scene"
	class:flying
	class:flip-scene--disabled={disabled}
	style:--rotate="{rotation}deg"
	style:--offset-y="{offsetY}px"
	style:--transition={dragging ? 'none' : undefined}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={settle}
	onclick={onClick}
>
	<div class="flip-card">
		{#if showingBack}
			<div class="flip-face flip-face--back">{@render back()}</div>
		{:else}
			<div class="flip-face">{@render front()}</div>
		{/if}
	</div>
</div>

<style>
	.flip-scene {
		perspective: 1400px;
		cursor: pointer;
		/* We handle both drag axes ourselves via pointer events — don't let
		   the browser's own touch scrolling/panning fight the gesture. */
		touch-action: none;
		user-select: none;
	}
	.flip-scene--disabled {
		cursor: default;
	}
	.flip-card {
		transform: translateY(var(--offset-y)) rotateY(var(--rotate));
		transition: var(--transition, transform 0.4s cubic-bezier(0.22, 0.9, 0.24, 1));
	}
	.flying .flip-card {
		transition:
			transform 0.22s ease-in,
			opacity 0.22s ease-in;
		transform: translateY(-140%) rotateY(var(--rotate));
		opacity: 0;
	}
	.flip-face {
		backface-visibility: hidden;
	}
	/* Un-mirrors the back face's content: the outer .flip-card is already at
	   ~180° when this renders, which would otherwise show the content
	   reversed. */
	.flip-face--back {
		transform: rotateY(180deg);
	}
</style>
