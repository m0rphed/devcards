<script lang="ts">
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	function formatDate(d: Date) {
		return new Date(d).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' });
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center gap-4">
		{#if data.profile.image}
			<img src={data.profile.image} alt="" class="h-16 w-16 rounded-full object-cover" />
		{:else}
			<div class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-xl text-gray-500">
				{data.profile.name[0]?.toUpperCase()}
			</div>
		{/if}
		<div>
			<h1 class="text-xl font-semibold">{data.profile.name}</h1>
			<p class="text-sm text-gray-500">На devcards с {formatDate(data.profile.memberSince)}</p>
		</div>
	</div>

	<div>
		<h2 class="mb-3 text-lg font-semibold">Публичные коллекции ({data.collections.length})</h2>
		{#if data.collections.length === 0}
			<p class="text-sm text-gray-500">Пока нет публичных коллекций.</p>
		{:else}
			<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each data.collections as c (c.id)}
					<li class="rounded-md border border-gray-200 p-4 hover:border-gray-300">
						<a href="/collections/{c.id}" class="font-medium text-gray-900">{c.title}</a>
						{#if c.description}
							<p class="mt-1 text-sm text-gray-500">{c.description}</p>
						{/if}
						<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
							<span>{c.cardCount} карточек</span>
							{#if c.rating}
								<span>★ {c.rating.avgRating.toFixed(1)} ({c.rating.ratingCount})</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
