<script lang="ts">
	import { Select } from 'bits-ui';
	import { Check, ChevronDown } from '@lucide/svelte';
	import { cn } from './utils';

	let {
		value = $bindable(),
		options,
		name,
		id,
		class: className
	}: {
		value: string;
		options: { value: string; label: string }[];
		name?: string;
		id?: string;
		class?: string;
	} = $props();

	const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? '');
</script>

<Select.Root type="single" bind:value {name} items={options}>
	<Select.Trigger
		{id}
		class={cn(
			'flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm',
			className
		)}
	>
		{selectedLabel}
		<ChevronDown class="size-4 text-gray-400" aria-hidden="true" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			sideOffset={4}
			class="z-50 w-[var(--bits-select-anchor-width)] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
		>
			<Select.Viewport>
				{#each options as option (option.value)}
					<Select.Item
						value={option.value}
						label={option.label}
						class="flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm data-highlighted:bg-gray-100"
					>
						{#snippet children({ selected })}
							{option.label}
							{#if selected}<Check class="size-4 text-blue-600" aria-hidden="true" />{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
