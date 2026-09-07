<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import StudyCardView from '$lib/components/StudyCardView.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="flex flex-col gap-4">
	<a href="/collections/{data.collection.id}" class="flex w-fit items-center gap-1 text-sm text-blue-600 hover:underline">
		<ArrowLeft class="size-4" aria-hidden="true" /> {data.collection.title}
	</a>

	{#if data.card === null}
		<div class="rounded-md border border-gray-200 p-8 text-center">
			<p class="text-lg font-medium">Всё повторено 🎉</p>
			<p class="mt-1 text-sm text-gray-500">Новых карточек к показу пока нет.</p>
		</div>

		{#if data.activity.length > 0}
			{@const totalReviews = data.activity.reduce((sum, d) => sum + d.reviews, 0)}
			{@const totalCorrect = data.activity.reduce((sum, d) => sum + d.correct, 0)}
			<div class="rounded-md border border-gray-200 p-4 text-sm text-gray-600">
				<p class="font-medium text-gray-800">За последние 7 дней</p>
				<p class="mt-1">
					{totalReviews} повторени{totalReviews === 1 ? 'е' : totalReviews < 5 ? 'я' : 'й'}, из них верно
					{Math.round((totalCorrect / totalReviews) * 100)}%
				</p>
			</div>
		{/if}
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
