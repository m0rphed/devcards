<script lang="ts">
	import { Avatar } from 'bits-ui';
	import { cn } from './utils';

	let {
		src,
		name,
		size = 'sm',
		class: className
	}: {
		src?: string | null;
		/** Used for the fallback initial — also the alt text when the image loads. */
		name: string;
		/** Matches the three pixel sizes already in use across the app (owner rows, comment authors, profile headers) — a pure refactor keeps them exact. */
		size?: 'xs' | 'sm' | 'lg';
		class?: string;
	} = $props();

	const sizeClasses = { xs: 'size-4 text-[8px]', sm: 'size-5 text-[10px]', lg: 'size-16 text-xl' };
	const initial = $derived(name?.[0]?.toUpperCase() ?? '?');
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
	     broken URL alike, unlike the hand-rolled {#if src}...{:else}...{/if}
	     this replaces, which only covered "no src at all". -->
	<Avatar.Fallback>{initial}</Avatar.Fallback>
</Avatar.Root>
