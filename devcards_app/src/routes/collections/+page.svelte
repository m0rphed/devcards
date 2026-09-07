<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { Collapsible } from 'bits-ui';
	import { Star } from '@lucide/svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import PerspectiveBook from '$lib/components/ui/PerspectiveBook.svelte';
	import CollectionAppearanceFields from '$lib/components/CollectionAppearanceFields.svelte';
	import { COLLECTION_COLOR_META } from '$lib/collection-colors';
	import { COLLECTION_ICON_META } from '$lib/collection-icons';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
	let showCreate = $state(false);

	// "Trial mode", not a replacement: the classic list stays the default and
	// fully intact below — this only decides which of the two already-built
	// renderings shows. A per-viewer preference, so localStorage rather than
	// a DB column; PerspectiveBook is pure CSS with no JS cost per card, but
	// many simultaneous 3D+blend-mode layers is still real paint work, so
	// defaulting to the proven 'list' rendering is the safe choice until
	// there's reason to flip the default.
	const VIEW_MODE_KEY = 'devcards:collections-view-mode';
	let viewMode = $state<'list' | 'shelf'>('list');

	onMount(() => {
		try {
			const saved = localStorage.getItem(VIEW_MODE_KEY);
			if (saved === 'list' || saved === 'shelf') viewMode = saved;
		} catch {
			// Private-browsing/blocked storage — just keep the default.
		}
	});

	function setViewMode(mode: 'list' | 'shelf') {
		viewMode = mode;
		try {
			localStorage.setItem(VIEW_MODE_KEY, mode);
		} catch {
			// Nothing to persist to — the in-memory choice still works for this visit.
		}
	}

	// List-view color tinting: unlike card colors (an ordinary named Tailwind
	// hue, where the *-50 tier is already guaranteed readable with the
	// existing fixed dark text — see card-colors.ts), a collection's color is
	// one of 16 arbitrary, often fully-saturated hex values — a light tint
	// isn't really "the color" at that saturation, and black-on-navy or
	// white-on-yellow would both fail outright. So this uses the same
	// WCAG-computed textClass as the book cover, applied to the title and
	// description only — badges/owner-row/rating/action buttons keep their
	// own self-contained background+text pairing regardless (same
	// content-vs-controls boundary StudyCardView already draws: color tints
	// what the card *is*, not the controls around it).
	function listCardClass(color: (typeof data.mine)[number]['color']): string {
		// Both branches set their own border-color — built as one full class
		// string (not appended after a fixed base) so there's never two
		// conflicting border-color utilities in the same class list.
		return color
			? `rounded-md border border-transparent p-4 ${COLLECTION_COLOR_META[color].bgClass}`
			: 'rounded-md border border-gray-200 p-4 hover:border-gray-300';
	}
	function listTitleClass(color: (typeof data.mine)[number]['color']): string {
		return color ? `font-medium ${COLLECTION_COLOR_META[color].textClass}` : 'font-medium text-gray-900';
	}
	// withMargin: false for flex-col layouts (the "публичные" list) that
	// already space children via `gap`, where an extra mt-1 would be
	// redundant on top of the gap.
	function listDescriptionClass(color: (typeof data.mine)[number]['color'], withMargin = true): string {
		const margin = withMargin ? 'mt-1 ' : '';
		if (!color) return `${margin}text-sm text-gray-500`;
		const muted = COLLECTION_COLOR_META[color].textClass === 'text-white' ? 'text-white/70' : 'text-black/70';
		return `${margin}text-sm ${muted}`;
	}
</script>

<div class="flex flex-col gap-8">
	<!-- Collapsible used directly (not the generic Disclosure wrapper): same
	     reason as [collectionId]'s "+ Карточка" toggle — the trigger needs
	     to sit in this header's flex row, content appears below it. -->
	<Collapsible.Root bind:open={showCreate}>
		<div class="flex items-center justify-between gap-3">
			<h1 class="text-xl font-semibold">Мои коллекции</h1>
			<div class="flex items-center gap-2">
				<div class="flex rounded-md border border-gray-300 p-0.5 text-xs">
					<button
						type="button"
						class="rounded px-2 py-1 {viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600'}"
						onclick={() => setViewMode('list')}
					>
						Список
					</button>
					<button
						type="button"
						class="rounded px-2 py-1 {viewMode === 'shelf' ? 'bg-blue-600 text-white' : 'text-gray-600'}"
						onclick={() => setViewMode('shelf')}
					>
						Полка
					</button>
				</div>
				<Collapsible.Trigger class="rounded-md bg-blue-600 px-3 py-1.5 text-sm whitespace-nowrap text-white hover:bg-blue-700">
					{showCreate ? 'Отмена' : '+ Новая коллекция'}
				</Collapsible.Trigger>
			</div>
		</div>
		<Collapsible.Content>
			<form
				method="post"
				action="?/create"
				use:enhance
				class="mt-4 flex flex-col gap-3 rounded-md border border-gray-200 p-4"
			>
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
				<CollectionAppearanceFields />
				{#if form?.message}
					<p class="text-sm text-red-600">{form.message}</p>
				{/if}
				<button class="w-fit rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">
					Создать
				</button>
			</form>
		</Collapsible.Content>
	</Collapsible.Root>

	{#if data.mine.length === 0}
		<p class="text-sm text-gray-500">Пока нет своих коллекций — создай первую.</p>
	{:else if viewMode === 'list'}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each data.mine as c (c.id)}
				<li class={listCardClass(c.color)}>
					<a href="/collections/{c.id}" class={listTitleClass(c.color)}>{c.title}</a>
					{#if c.isPublic}
						<span class="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">публичная</span>
					{/if}
					{#if c.description}
						<p class={listDescriptionClass(c.color)}>{c.description}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<ul class="flex flex-wrap gap-6">
			{#each data.mine as c (c.id)}
				<li class="flex flex-col items-center gap-2">
					<a href="/collections/{c.id}">
						<PerspectiveBook
							size="sm"
							class={c.color ? `${COLLECTION_COLOR_META[c.color].bgClass} ${COLLECTION_COLOR_META[c.color].textClass}` : undefined}
						>
							<div class="flex h-full flex-col justify-between">
								{#if c.icon}
									<img src={COLLECTION_ICON_META[c.icon].src} alt="" class="size-8" />
								{/if}
								<div>
									<p class="text-sm leading-tight font-semibold">{c.title}</p>
									{#if c.description}
										<p class="mt-1 line-clamp-3 text-xs opacity-70">{c.description}</p>
									{/if}
								</div>
							</div>
						</PerspectiveBook>
					</a>
					{#if c.isPublic}
						<span class="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">публичная</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.shared.length > 0}
		<div>
			<h2 class="mb-3 text-lg font-semibold">Расшарено со мной</h2>
			{#if viewMode === 'list'}
				<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{#each data.shared as { collection, role } (collection.id)}
						<li class={listCardClass(collection.color)}>
							<a href="/collections/{collection.id}" class={listTitleClass(collection.color)}>{collection.title}</a>
							<span class="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{role}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<ul class="flex flex-wrap gap-6">
					{#each data.shared as { collection: c, role } (c.id)}
						<li class="flex flex-col items-center gap-2">
							<a href="/collections/{c.id}">
								<PerspectiveBook
									size="sm"
									class={c.color
										? `${COLLECTION_COLOR_META[c.color].bgClass} ${COLLECTION_COLOR_META[c.color].textClass}`
										: undefined}
								>
									<div class="flex h-full flex-col justify-between">
										{#if c.icon}
											<img src={COLLECTION_ICON_META[c.icon].src} alt="" class="size-8" />
										{/if}
										<p class="text-sm leading-tight font-semibold">{c.title}</p>
									</div>
								</PerspectiveBook>
							</a>
							<span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{role}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<div>
		<h2 class="mb-3 text-lg font-semibold">Публичные коллекции</h2>
		<form method="get" class="mb-3 flex gap-2">
			<input
				type="search"
				name="q"
				value={data.searchQuery}
				placeholder="Искать по названию/описанию..."
				class="block w-full max-w-sm rounded-md border-gray-300 text-sm shadow-sm"
			/>
			{#if data.searchQuery}
				<a href="/collections" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
					Сбросить
				</a>
			{/if}
		</form>
		{#if data.publicOnes.length === 0}
			<p class="text-sm text-gray-500">
				{data.searchQuery ? 'Ничего не найдено.' : 'Пока нет ни одной публичной коллекции от других пользователей.'}
			</p>
		{:else if viewMode === 'list'}
			<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each data.publicOnes as c (c.id)}
					<li class="flex flex-col gap-2 {listCardClass(c.color)}">
						<a href="/collections/{c.id}" class={listTitleClass(c.color)}>{c.title}</a>
						{#if c.description}
							<p class={listDescriptionClass(c.color, false)}>{c.description}</p>
						{/if}
						<div class="flex items-center gap-2 text-xs text-gray-500">
							<a href="/users/{c.ownerId}" class="flex items-center gap-1 hover:underline">
								<Avatar src={c.ownerImage} name={c.ownerName} size="xs" />
								{c.ownerName}
							</a>
							{#if c.rating}
								<span class="flex items-center gap-0.5">
								<Star class="size-3.5" fill="currentColor" aria-hidden="true" />
								{c.rating.avgRating.toFixed(1)} ({c.rating.ratingCount})
							</span>
							{/if}
						</div>
						<div class="flex gap-2 text-xs">
							{#if c.subscribed}
								<form method="post" action="?/leave" use:enhance>
									<input type="hidden" name="collectionId" value={c.id} />
									<button class="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">Отписаться</button>
								</form>
							{:else}
								<form method="post" action="?/subscribe" use:enhance>
									<input type="hidden" name="collectionId" value={c.id} />
									<button class="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">Добавить себе</button>
								</form>
							{/if}
							{#if c.forked}
								<span class="rounded bg-gray-50 px-2 py-1 text-gray-400">уже скопировано</span>
							{:else}
								<form method="post" action="?/fork" use:enhance>
									<input type="hidden" name="collectionId" value={c.id} />
									<button class="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">Скопировать себе</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="flex flex-wrap gap-6">
				{#each data.publicOnes as c (c.id)}
					<li class="flex w-37.5 flex-col items-center gap-2">
						<a href="/collections/{c.id}">
							<PerspectiveBook
								size="sm"
								class={c.color
									? `${COLLECTION_COLOR_META[c.color].bgClass} ${COLLECTION_COLOR_META[c.color].textClass}`
									: undefined}
							>
								<div class="flex h-full flex-col justify-between">
									{#if c.icon}
										<img src={COLLECTION_ICON_META[c.icon].src} alt="" class="size-8" />
									{/if}
									<div>
										<p class="text-sm leading-tight font-semibold">{c.title}</p>
										{#if c.description}
											<p class="mt-1 line-clamp-2 text-xs opacity-70">{c.description}</p>
										{/if}
									</div>
								</div>
							</PerspectiveBook>
						</a>
						<a href="/users/{c.ownerId}" class="flex items-center gap-1 text-xs text-gray-500 hover:underline">
							<Avatar src={c.ownerImage} name={c.ownerName} size="xs" />
							{c.ownerName}
						</a>
						{#if c.rating}
							<span class="flex items-center gap-0.5 text-xs text-gray-500">
								<Star class="size-3.5" fill="currentColor" aria-hidden="true" />
								{c.rating.avgRating.toFixed(1)} ({c.rating.ratingCount})
							</span>
						{/if}
						<div class="flex gap-2 text-xs">
							{#if c.subscribed}
								<form method="post" action="?/leave" use:enhance>
									<input type="hidden" name="collectionId" value={c.id} />
									<button class="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">Отписаться</button>
								</form>
							{:else}
								<form method="post" action="?/subscribe" use:enhance>
									<input type="hidden" name="collectionId" value={c.id} />
									<button class="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">Добавить</button>
								</form>
							{/if}
							{#if c.forked}
								<span class="rounded bg-gray-50 px-2 py-1 text-gray-400">скопировано</span>
							{:else}
								<form method="post" action="?/fork" use:enhance>
									<input type="hidden" name="collectionId" value={c.id} />
									<button class="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">Копия</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
