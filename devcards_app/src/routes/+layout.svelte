<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import './layout.css';
	// KaTeX's own stylesheet (font sizing/positioning for rendered math) —
	// loaded globally, not just alongside the editor: study/quiz/results
	// pages render already-rendered KaTeX HTML server-side without ever
	// mounting a <MarkdownEditor>, so they need this too.
	import 'katex/dist/katex.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();

	// SvelteKit's documented recipe for wiring client-side navigation to the
	// native View Transitions API — there's no single element for a Svelte
	// `transition:` to attach to here, since a navigation swaps the whole
	// page, not one component. The actual transition (fade+slide) is
	// declared as CSS in layout.css against the ::view-transition-*(root)
	// pseudo-elements the browser creates; this hook only decides whether to
	// ask for one at all.
	onNavigate((navigation) => {
		// Unsupported browser (no View Transitions API) — let the navigation
		// happen the normal way.
		if (!document.startViewTransition) return;
		// Respect the OS-level motion preference explicitly rather than
		// relying on CSS alone to cancel it: the animation in layout.css is
		// already gated on `prefers-reduced-motion: no-preference`, but the
		// View Transitions API still runs its own built-in default
		// cross-fade if we start one and just leave it un-styled — so skip
		// starting a transition at all rather than fight that default.
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		// onNavigate fires for every SvelteKit-classified "navigation", which
		// is a much wider set than "the page changed": a <form method="get">
		// (the card search box), a same-page <a href="?tag=..."> (the tag
		// filter chips), and a grade-then-redirect-to-the-same-URL (study's
		// "Again"/"Hard"/.../skip) are all real navigations by SvelteKit's
		// definition, but none of them are a page-to-page move — animating
		// the whole page on those reads as a broken flicker, not a
		// transition. Only start one when the actual path is changing.
		if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="border-b border-gray-200 bg-white">
	<div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
		<a href="/collections" class="font-semibold text-gray-900">devcards</a>
		{#if data.user}
			<div class="flex items-center gap-3 text-sm text-gray-600">
				<a href="/settings" class="hover:underline">{data.user.name}</a>
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
