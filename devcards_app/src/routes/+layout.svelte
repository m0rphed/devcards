<script lang="ts">
	import type { Snippet } from 'svelte';
	import './layout.css';
	// KaTeX's own stylesheet (font sizing/positioning for rendered math) —
	// loaded globally, not just alongside the editor: study/quiz/results
	// pages render already-rendered KaTeX HTML server-side without ever
	// mounting a <MarkdownEditor>, so they need this too.
	import 'katex/dist/katex.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="border-b border-gray-200 bg-white">
	<div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
		<a href="/collections" class="font-semibold text-gray-900">devcards</a>
		{#if data.user}
			<div class="flex items-center gap-3 text-sm text-gray-600">
				<span>{data.user.name}</span>
				<form method="post" action="/logout">
					<button class="text-blue-600 hover:underline">Выйти</button>
				</form>
			</div>
		{:else}
			<a href="/login" class="text-sm text-blue-600 hover:underline">Войти</a>
		{/if}
	</div>
</header>

<main class="mx-auto max-w-4xl px-4 py-6">
	{@render children()}
</main>
