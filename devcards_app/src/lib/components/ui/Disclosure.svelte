<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		trigger,
		triggerClass = 'text-sm text-blue-600 hover:underline',
		children
	}: {
		open?: boolean;
		/** Gets the current open state, since every current call site's trigger text depends on it ("Настройки" vs "Скрыть настройки"). */
		trigger: Snippet<[boolean]>;
		triggerClass?: string;
		children: Snippet;
	} = $props();
</script>

<Collapsible.Root bind:open>
	<Collapsible.Trigger class={triggerClass}>
		{@render trigger(open)}
	</Collapsible.Trigger>
	<Collapsible.Content>
		<div class="mt-4">
			{@render children()}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
