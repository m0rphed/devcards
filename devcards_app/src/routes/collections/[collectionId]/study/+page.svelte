<script lang="ts">
	import StudyCardView from '$lib/components/StudyCardView.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="flex flex-col gap-4">
	<a href="/collections/{data.collection.id}" class="w-fit text-sm text-blue-600 hover:underline">
		← {data.collection.title}
	</a>

	{#if data.card === null}
		<div class="rounded-md border border-gray-200 p-8 text-center">
			<p class="text-lg font-medium">Всё повторено 🎉</p>
			<p class="mt-1 text-sm text-gray-500">Новых карточек к показу пока нет.</p>
		</div>
	{:else}
		<!-- Keyed by loadKey (not card.id): "Again" can bring the very same card
		     back up immediately, and we still need a fresh component instance
		     so its local "revealed" state resets. -->
		{#key data.loadKey}
			<!-- rendered is computed alongside card in load — non-null exactly when card is (see +page.server.ts) -->
			<StudyCardView card={data.card} rendered={data.rendered!} remaining={data.remaining} />
		{/key}
	{/if}
</div>
