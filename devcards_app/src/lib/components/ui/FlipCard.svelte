<script lang="ts">
	import { Spring } from 'svelte/motion';
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';

	let {
		flipped = $bindable(false),
		front,
		back,
		onSkip,
		disabled = false,
		stiffness = 0.25,
		damping = 0.9
	}: {
		flipped?: boolean;
		front: Snippet;
		back: Snippet;
		/** Swipe the card up to move on without answering — omit to disable the gesture entirely. */
		onSkip?: () => void;
		/** Ignores pointer/click entirely — `flipped` can still be changed programmatically (e.g. quiz mode gating the flip behind an explicit "commit your answer first" step). */
		disabled?: boolean;
		/** Tune the flip's spring feel (see rotationSpring below) — snappier/springier or slower/heavier. */
		stiffness?: number;
		damping?: number;
	} = $props();

	let dragging = $state(false);
	let axis: 'x' | 'y' | null = null;
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

	// Drives the visible rotation AND, via .current, which face is shown.
	// This used to be a plain $derived fed into a CSS `transition: transform`
	// — which only animates the *visual* transform. A plain reactive value
	// jumps straight from 0 to 180 the instant you click; the front/back
	// swap (keyed off that value crossing 90) swapped in the back face
	// immediately too, well before the CSS animation had visually caught
	// up — so the back face rendered upside down for most of the
	// transition, only self-correcting right at the end (net visual
	// rotation = css-progress-so-far + the back face's own 180°
	// counter-rotation). Routing the swap through a real animated value
	// (this spring) keeps content and visual rotation permanently in sync,
	// exactly like a live drag already did (there, every intermediate
	// degree was a real reactive update, not just a CSS-interpolated one).
	// untrack(): a one-time construction-time snapshot — Spring's own
	// stiffness/damping fields are meant to be tuned live if ever needed,
	// not re-derived from these props on every change.
	const rotationSpring = new Spring(0, untrack(() => ({ stiffness, damping })));
	const offsetYSpring = new Spring(0, { stiffness: 0.3, damping: 0.85 });

	$effect(() => {
		// Only steer the spring from `flipped` when not actively dragging —
		// mid-drag we're setting rotationSpring directly, frame by frame.
		if (!dragging) rotationSpring.target = flipped ? 180 : 0;
	});

	const showingBack = $derived(rotationSpring.current > 90);

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
			const base = flipped ? 180 : 0;
			// instant: true — track the pointer 1:1 while dragging, no spring
			// lag; the spring's actual physics only kick in once you let go
			// (see onPointerUp), same split real drag-to-dismiss UIs use.
			rotationSpring.set(clamp(base + dx * FLIP_SENSITIVITY, 0, 180), { instant: true });
		} else if (onSkip) {
			// Only upward movement drives anything — there's nowhere for
			// "drag down" to go semantically, so it's just inert.
			dragOffsetY = Math.min(0, dy);
			offsetYSpring.set(dragOffsetY, { instant: true });
		}
	}

	function settle() {
		dragging = false;
		pointerId = null;
		axis = null;
		dragOffsetY = 0;
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		const elapsedMs = Math.max(performance.now() - startTime, 1);
		const committedAxis = axis;
		const finalRotation = rotationSpring.current;
		const finalOffsetY = dragOffsetY;
		settle();

		if (committedAxis === 'x') {
			flipped = finalRotation > 90;
			// Set explicitly rather than relying solely on the $effect above:
			// if this drag ended up back where it started (flipped didn't
			// actually change value), that effect never re-fires, and the
			// spring would otherwise sit stranded at whatever mid-drag angle
			// it was released at instead of settling back to 0/180.
			rotationSpring.target = flipped ? 180 : 0;
		} else if (committedAxis === 'y' && onSkip) {
			const velocity = Math.abs(finalOffsetY) / elapsedMs;
			if (-finalOffsetY > SKIP_DISTANCE || velocity > SKIP_VELOCITY) {
				flying = true;
				// Let the fly-off transition (see .flying below) actually play
				// before telling the parent to swap in the next card out from
				// under it.
				setTimeout(() => onSkip(), 220);
				return;
			}
			offsetYSpring.target = 0;
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
	style:--rotate="{rotationSpring.current}deg"
	style:--offset-y="{offsetYSpring.current}px"
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
		/* No CSS transition here — rotationSpring/offsetYSpring already
		   animate .current frame by frame; a transition on top of that
		   would smooth already-smooth motion into a laggy mush. */
		transform: translateY(var(--offset-y)) rotateY(var(--rotate));
	}
	.flying .flip-card {
		/* The one place that *does* want a plain CSS transition: this is a
		   one-shot committed exit, not a settle-into-place motion a spring
		   models well. */
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
