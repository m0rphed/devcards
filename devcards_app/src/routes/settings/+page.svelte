<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	let uploading = $state(false);
	let uploadError = $state('');
	let avatarForm: HTMLFormElement;
	let urlInput: HTMLInputElement;

	async function onFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		uploading = true;
		uploadError = '';
		try {
			const body = new FormData();
			body.set('file', file);
			const res = await fetch('/api/attachments', { method: 'POST', body });
			if (!res.ok) {
				const { error: reason } = await res.json().catch(() => ({ error: 'unknown' }));
				uploadError =
					reason === 'unsupported_type'
						? 'Поддерживаются только PNG, JPEG и WebP'
						: reason === 'too_large'
							? 'Файл больше 5MB'
							: 'Не удалось загрузить файл';
				return;
			}
			const { url } = await res.json();
			urlInput.value = url;
			avatarForm.requestSubmit();
		} finally {
			uploading = false;
		}
	}
</script>

<div class="flex max-w-md flex-col gap-6">
	<h1 class="text-xl font-semibold">Настройки профиля</h1>

	<div class="flex items-center gap-4">
		{#if data.user.image}
			<img src={data.user.image} alt="" class="h-16 w-16 rounded-full object-cover" />
		{:else}
			<div class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-xl text-gray-500">
				{data.user.name[0]?.toUpperCase()}
			</div>
		{/if}
		<div>
			<label class="block text-sm text-blue-600 hover:underline">
				{uploading ? 'Загрузка…' : 'Сменить аватар'}
				<input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" onchange={onFileChange} disabled={uploading} />
			</label>
			<p class="text-xs text-gray-400">PNG, JPEG или WebP, до 5MB</p>
			{#if uploadError}<p class="text-xs text-red-600">{uploadError}</p>{/if}
			{#if form?.message}<p class="text-xs text-red-600">{form.message}</p>{/if}
		</div>
	</div>

	<form bind:this={avatarForm} method="post" action="?/setAvatar" use:enhance class="hidden">
		<input bind:this={urlInput} type="hidden" name="url" />
	</form>
</div>
