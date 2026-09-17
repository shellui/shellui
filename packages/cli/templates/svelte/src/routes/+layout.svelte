<script>
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(async () => {
		// Dynamic import avoids SSR evaluating @shellui/sdk/tiny (uses `location`).
		const { shellui } = await import('@shellui/sdk/tiny');
		// Light Shellui host handshake when embedded (no-op outside the shell).
		void shellui.ready;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
