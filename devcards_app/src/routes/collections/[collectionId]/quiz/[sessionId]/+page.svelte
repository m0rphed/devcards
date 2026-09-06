<script lang="ts">
	import QuizCardView from '$lib/components/QuizCardView.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="flex flex-col gap-4">
	<a href="/collections/{data.collection.id}" class="w-fit text-sm text-blue-600 hover:underline">
		← {data.collection.title}
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
