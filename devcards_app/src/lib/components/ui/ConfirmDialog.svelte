<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { cn } from './utils';

	let {
		trigger,
		triggerClass,
		title,
		description,
		formId,
		confirmLabel = 'Удалить',
		cancelLabel = 'Отмена',
		destructive = true
	}: {
		trigger: Snippet;
		triggerClass?: string;
		title: string;
		/** A snippet, not a string — callers build dynamic text (counts, warnings) themselves; this component doesn't need to know their shape. */
		description: Snippet;
		/** The id of the real <form> (with its own use:enhance/action) that Confirm should submit. AlertDialog.Portal moves Content
		 * (and the Action button inside it) out to document.body, so the button can't rely on DOM nesting to reach the form —
		 * the HTML `form` attribute targets it by id instead, no JS wiring needed. */
		formId: string;
		confirmLabel?: string;
		cancelLabel?: string;
		/** Red confirm button — both current call sites (delete collection/card) are destructive; flip to false for a non-destructive confirmation if one ever comes up. */
		destructive?: boolean;
	} = $props();

	// Not exposed as bindable: nothing outside this component needs to
	// control it, and closing it here (in the confirm button's own click
	// handler) is enough to avoid it staying open after the real form
	// submission — an uncontrolled bits-ui default open=false wouldn't reset
	// itself once we close it manually.
	let open = $state(false);
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Trigger class={triggerClass}>{@render trigger()}</AlertDialog.Trigger>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-6 shadow-lg"
		>
			<AlertDialog.Title class="text-lg font-semibold text-gray-900">{title}</AlertDialog.Title>
			<AlertDialog.Description class="mt-2 text-sm text-gray-600">
				{@render description()}
			</AlertDialog.Description>
			<div class="mt-6 flex justify-end gap-2">
				<AlertDialog.Cancel
					class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
				>
					{cancelLabel}
				</AlertDialog.Cancel>
				<AlertDialog.Action
					type="submit"
					form={formId}
					onclick={() => (open = false)}
					class={cn(
						'rounded-md px-3 py-1.5 text-sm text-white',
						destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
					)}
				>
					{confirmLabel}
				</AlertDialog.Action>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
