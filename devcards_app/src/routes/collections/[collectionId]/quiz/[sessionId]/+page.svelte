<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import QuizCardView from '$lib/components/QuizCardView.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="flex flex-col gap-4">
	<a href="/collections/{data.collection.id}" class="flex w-fit items-center gap-1 text-sm text-blue-600 hover:underline">
		<ArrowLeft class="size-4" aria-hidden="true" /> {data.collection.title}
	</a>

	{#key data.loadKey}
		<QuizCardView
			card={data.card}
			rendered={data.rendered}
			current={data.answeredSoFar + 1}
			total={data.session.totalQuestions}
		/>
	{/key}
</div>
