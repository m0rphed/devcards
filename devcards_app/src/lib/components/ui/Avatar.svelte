<script lang="ts">
	import { Avatar } from 'bits-ui';
	import { cn } from './utils';
	import FallbackAvatar from './FallbackAvatar.svelte';

	let {
		src,
		name,
		size = 'sm',
		class: className
	}: {
		src?: string | null;
		/** Seeds the generative fallback avatar — also the alt text when the image loads. */
		name: string;
		/** Matches the three pixel sizes already in use across the app (owner rows, comment authors, profile headers) — a pure refactor keeps them exact. */
		size?: 'xs' | 'sm' | 'lg';
		class?: string;
	} = $props();

	const sizeClasses = { xs: 'size-4 text-[8px]', sm: 'size-5 text-[10px]', lg: 'size-16 text-xl' };
	// Real px, matching the size-4/size-5/size-16 Tailwind classes above (at
	// the default 16px root) — FallbackAvatar draws to an actual canvas, so
	// it needs a real pixel size, not a class.
	const sizePx = { xs: 16, sm: 20, lg: 64 };
</script>

<Avatar.Root
	class={cn(
		'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 font-medium text-gray-500',
		sizeClasses[size],
		className
	)}
>
	{#if src}
		<Avatar.Image {src} alt={name} class="h-full w-full object-cover" />
	{/if}
	<!-- bits-ui hides this once the image finishes loading (data-status
	     tracks loading/loaded/error) — shown for no src, a slow load, and a
	     broken URL alike. -->
	<Avatar.Fallback>
		<FallbackAvatar {name} size={sizePx[size]} />
	</Avatar.Fallback>
</Avatar.Root>
