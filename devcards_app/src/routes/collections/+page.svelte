<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
	let showCreate = $state(false);
</script>

<div class="flex flex-col gap-8">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-semibold">Мои коллекции</h1>
		<button
			type="button"
			class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
			onclick={() => (showCreate = !showCreate)}
		>
			{showCreate ? 'Отмена' : '+ Новая коллекция'}
		</button>
	</div>

	{#if showCreate}
		<form method="post" action="?/create" use:enhance class="flex flex-col gap-3 rounded-md border border-gray-200 p-4">
			<label class="block text-sm">
				Название
				<input name="title" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
			</label>
			<label class="block text-sm">
				Описание
				<textarea name="description" rows="2" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
				></textarea>
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" name="isPublic" class="rounded border-gray-300" />
				Публичная (видна всем)
			</label>
			{#if form?.message}
				<p class="text-sm text-red-600">{form.message}</p>
			{/if}
			<button class="w-fit rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">
				Создать
			</button>
		</form>
	{/if}

	{#if data.mine.length === 0}
		<p class="text-sm text-gray-500">Пока нет своих коллекций — создай первую.</p>
	{:else}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each data.mine as c (c.id)}
				<li class="rounded-md border border-gray-200 p-4 hover:border-gray-300">
					<a href="/collections/{c.id}" class="font-medium text-gray-900">{c.title}</a>
					{#if c.isPublic}
						<span class="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">публичная</span>
					{/if}
					{#if c.description}
						<p class="mt-1 text-sm text-gray-500">{c.description}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.shared.length > 0}
		<div>
			<h2 class="mb-3 text-lg font-semibold">Расшарено со мной</h2>
			<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each data.shared as { collection, role } (collection.id)}
					<li class="rounded-md border border-gray-200 p-4 hover:border-gray-300">
						<a href="/collections/{collection.id}" class="font-medium text-gray-900">{collection.title}</a>
						<span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{role}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div>
		<h2 class="mb-3 text-lg font-semibold">Публичные коллекции</h2>
		{#if data.publicOnes.length === 0}
			<p class="text-sm text-gray-500">Пока нет ни одной публичной коллекции от других пользователей.</p>
		{:else}
			<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each data.publicOnes as c (c.id)}
					<li class="rounded-md border border-gray-200 p-4 hover:border-gray-300">
						<a href="/collections/{c.id}" class="font-medium text-gray-900">{c.title}</a>
						{#if c.description}
							<p class="mt-1 text-sm text-gray-500">{c.description}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
