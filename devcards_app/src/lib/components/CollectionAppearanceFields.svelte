<script lang="ts">
	// Shared by the create-collection form (/collections) and the collection
	// settings form ([collectionId]) — same "one thin wrapper per concrete
	// use case" reasoning as the ui/ components, just at the form-fields
	// level since this specific pair of pickers is genuinely used twice.
	// Deliberately not a <form> itself — embeds into whichever form is
	// already there, contributing two RadioGroups (name="color"/"icon") to
	// its submission.
	import { untrack } from 'svelte';
	import { RadioGroup } from 'bits-ui';
	import { COLLECTION_COLORS, COLLECTION_COLOR_META, isCollectionColor } from '$lib/collection-colors';
	import { COLLECTION_ICONS, COLLECTION_ICON_META, isCollectionIcon } from '$lib/collection-icons';

	let { initialColor = null, initialIcon = null }: { initialColor?: string | null; initialIcon?: string | null } =
		$props();

	const uid = $props.id();

	// 'none' sentinel — same reasoning as CardForm's color picker: an
	// empty-string RadioGroup value reads as "nothing selected", 'none'
	// round-trips through the form unambiguously.
	let color = $state(untrack(() => (isCollectionColor(initialColor) ? initialColor : 'none')));
	let icon = $state(untrack(() => (isCollectionIcon(initialIcon) ? initialIcon : 'none')));
</script>

<div class="text-sm">
	<span id="{uid}-color-label">Цвет обложки</span>
	<!-- The mt spacing below the label lives on this inner div, not
	     RadioGroup.Root — a `display: contents` element generates no box of
	     its own, so margin/padding set on it is silently inert. -->
	<RadioGroup.Root bind:value={color} name="color" aria-labelledby="{uid}-color-label" class="contents">
		<div class="mt-2 flex flex-wrap items-center gap-2">
			<RadioGroup.Item
				value="none"
				aria-label="Без цвета"
				class="size-6 shrink-0 rounded-full border-2 border-dashed border-gray-300 bg-white transition-transform active:scale-95 data-[state=checked]:ring-2 data-[state=checked]:ring-gray-400 data-[state=checked]:ring-offset-2"
			/>
			{#each COLLECTION_COLORS as c}
				<RadioGroup.Item
					value={c}
					aria-label={COLLECTION_COLOR_META[c].label}
					class="size-6 shrink-0 rounded-full transition-transform active:scale-95 data-[state=checked]:ring-2 data-[state=checked]:ring-offset-2"
					style="background-color:{COLLECTION_COLOR_META[c].hex}; --tw-ring-color:{COLLECTION_COLOR_META[c].hex}"
				/>
			{/each}
		</div>
	</RadioGroup.Root>
</div>

<div class="text-sm">
	<span id="{uid}-icon-label">Иконка технологии</span>
	<RadioGroup.Root bind:value={icon} name="icon" aria-labelledby="{uid}-icon-label" class="contents">
		<div class="mt-2 grid grid-cols-8 gap-2 sm:grid-cols-10">
			<RadioGroup.Item
				value="none"
				aria-label="Без иконки"
				class="flex size-8 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400 transition-transform active:scale-95 data-[state=checked]:ring-2 data-[state=checked]:ring-gray-400"
			>
				—
			</RadioGroup.Item>
			{#each COLLECTION_ICONS as i}
				<RadioGroup.Item
					value={i}
					aria-label={COLLECTION_ICON_META[i].label}
					title={COLLECTION_ICON_META[i].label}
					class="flex size-8 shrink-0 items-center justify-center rounded border border-gray-200 p-1 transition-transform active:scale-95 data-[state=checked]:ring-2 data-[state=checked]:ring-blue-500"
				>
					<img src={COLLECTION_ICON_META[i].src} alt="" class="size-full" />
				</RadioGroup.Item>
			{/each}
		</div>
	</RadioGroup.Root>
</div>
