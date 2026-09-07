<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import CardForm from '$lib/components/CardForm.svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<div class="flex flex-col gap-4">
	<a href="/collections/{data.collection.id}" class="flex w-fit items-center gap-1 text-sm text-blue-600 hover:underline">
		<ArrowLeft class="size-4" aria-hidden="true" /> {data.collection.title}
	</a>
	<h1 class="text-xl font-semibold">Изменить карточку</h1>

	<div class="rounded-md border border-gray-200 p-4">
		<CardForm
			formAction="?/update"
			initialType={data.card.type}
			initialContent={data.card.content}
			initialTags={data.tagNames}
			submitLabel="Сохранить"
		/>
	</div>
</div>
