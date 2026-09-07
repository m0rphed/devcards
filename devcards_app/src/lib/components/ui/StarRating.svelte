<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { RatingGroup } from 'bits-ui';
	import { Star } from '@lucide/svelte';

	let {
		value,
		rateAction,
		unrateAction
	}: {
		/** null = not rated by this user yet. */
		value: number | null;
		rateAction: string;
		unrateAction: string;
	} = $props();

	// RatingGroup.Root renders its own hidden <input name="rating"> for form
	// submission when `name` is set — no manual hidden-input wiring needed.
	// Auto-submit on click (matching the previous per-star <form> behavior)
	// via onValueChange + requestSubmit() on the form this is nested inside.
	//
	// `value` MUST be bound (bind:value), not passed as a one-way prop:
	// bits-ui treats a plain (unbound) `value` as externally-controlled and
	// snaps back to it right after a click, since nothing here would ever
	// update it otherwise — confirmed the hard way (every click submitted 0,
	// not the clicked star, until this became bind:value).
	// untrack(): a one-time snapshot to seed local state, not meant to track
	// later prop changes.
	let ratingValue = $state(untrack(() => value ?? 0));
	let formEl: HTMLFormElement;
</script>

<div class="flex items-center gap-1">
	<form bind:this={formEl} method="post" action={rateAction} use:enhance>
		<RatingGroup.Root
			bind:value={ratingValue}
			max={5}
			name="rating"
			aria-label="Оценка"
			aria-valuetext={(v, max) => `${v} из ${max}`}
			onValueChange={async () => {
				// bits-ui's own hidden input reflects `ratingValue` via a normal
				// Svelte effect, which flushes on a microtask — reading it via
				// requestSubmit() in this same synchronous callback caught the
				// DOM *before* that update landed (every click submitted the
				// old value). `tick()` waits for pending updates to flush first.
				await tick();
				formEl.requestSubmit();
			}}
			class="flex items-center gap-1"
		>
			{#snippet children({ items })}
				{#each items as item (item.index)}
					<!-- bits-ui models the whole group as a single role="slider" on
					     Root, not N separate interactive items — Item itself is
					     role="presentation", so no per-item aria-label belongs here. -->
					<RatingGroup.Item index={item.index} data-testid="star-{item.index}" class="cursor-pointer">
						{#snippet children({ state })}
							<Star
								class="size-5 {state === 'active' ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}"
								fill={state === 'active' ? 'currentColor' : 'none'}
								aria-hidden="true"
							/>
						{/snippet}
					</RatingGroup.Item>
				{/each}
			{/snippet}
		</RatingGroup.Root>
	</form>
	{#if value}
		<form method="post" action={unrateAction} use:enhance>
			<button class="text-xs text-gray-500 hover:underline">Убрать оценку</button>
		</form>
	{/if}
</div>
