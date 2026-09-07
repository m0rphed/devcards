<script lang="ts">
	// Ported near-verbatim from the "fallback-avatar" spell
	// (github.com/SikandarJODD/animations) — a seeded WebGL "aurora blob"
	// canvas, deterministic from `name` alone, with a Canvas2D fallback for
	// browsers/contexts without WebGL. Replaces Avatar.svelte's plain
	// uppercase-letter fallback for every user with no uploaded image.
	import { browser } from '$app/environment';
	import { cn } from './utils';
	import { onMount } from 'svelte';
	import type { ClassValue, HTMLAttributes } from 'svelte/elements';

	import type { Uniforms } from './fallback-avatar-utils';
	import { computeUniforms } from './fallback-avatar-utils';
	import { renderFallback2D, renderWebGLToCanvas } from './fallback-avatar-webgl';

	type Props = Omit<HTMLAttributes<HTMLCanvasElement>, 'class' | 'children' | 'width' | 'height'> & {
		name: string;
		size?: number;
		animated?: boolean;
		class?: ClassValue;
		style?: string;
	};

	let { name, size = 32, animated = true, class: className, style, ...restProps }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);

	let rafId: number | null = null;
	let isHovering = false;
	let animationTime = 0;
	let hoverStartTimestamp: number | null = null;
	let uniformsCache: Uniforms | null = null;
	let shouldUse2DFallback = false;

	const rootStyle = $derived(
		[style ? String(style) : '', 'display: block', `width: ${size}px`, `height: ${size}px`].filter(Boolean).join('; ')
	);

	function getUniforms() {
		if (!uniformsCache) {
			uniformsCache = computeUniforms(name);
		}

		return uniformsCache;
	}

	// The canvas bitmap is scaled with DPR while the CSS box stays tied to the `size` prop.
	function syncCanvasResolution() {
		if (!browser) return;

		const nextPixelSize = Math.max(1, Math.round(size * (window.devicePixelRatio || 1)));

		if (canvas) {
			canvas.width = nextPixelSize;
			canvas.height = nextPixelSize;
		}
	}

	function stopAnimation() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}

		hoverStartTimestamp = null;
	}

	function draw(time: number) {
		if (!canvas) return;

		const uniforms = getUniforms();

		if (!shouldUse2DFallback) {
			const renderedWithWebGL = renderWebGLToCanvas(canvas, uniforms, time);
			if (renderedWithWebGL) {
				return;
			}

			shouldUse2DFallback = true;
		}

		renderFallback2D(canvas, uniforms, time);
	}

	// Hover animation keeps elapsed time so leaving and re-entering continues from the last frame.
	function animate(timestamp: number) {
		if (!isHovering) {
			stopAnimation();
			return;
		}

		if (hoverStartTimestamp === null) {
			hoverStartTimestamp = timestamp - animationTime * 1000;
		}

		animationTime = (timestamp - hoverStartTimestamp) / 1000;
		draw(animationTime);
		rafId = requestAnimationFrame(animate);
	}

	function handlePointerEnter() {
		if (!animated || !canvas || isHovering) return;

		isHovering = true;
		hoverStartTimestamp = null;
		rafId = requestAnimationFrame(animate);
	}

	function handlePointerLeave() {
		if (!canvas) return;

		isHovering = false;
		stopAnimation();
		draw(animationTime);
	}

	onMount(() => {
		syncCanvasResolution();
		draw(0);

		return () => {
			isHovering = false;
			stopAnimation();
		};
	});

	$effect(() => {
		name;

		if (!browser || !canvas) return;

		uniformsCache = null;
		animationTime = 0;
		isHovering = false;
		stopAnimation();
		syncCanvasResolution();
		draw(0);
	});

	$effect(() => {
		size;

		if (!browser || !canvas) return;

		syncCanvasResolution();
		draw(animationTime);
	});

	$effect(() => {
		animated;

		if (!animated) {
			isHovering = false;
			stopAnimation();

			if (browser && canvas) {
				draw(animationTime);
			}
		}
	});
</script>

<canvas
	bind:this={canvas}
	data-slot="fallback-avatar"
	width={size}
	height={size}
	class={cn('rounded-full', className)}
	style={rootStyle}
	role="img"
	aria-label={name}
	onpointerenter={handlePointerEnter}
	onpointerleave={handlePointerLeave}
	{...restProps}
></canvas>
