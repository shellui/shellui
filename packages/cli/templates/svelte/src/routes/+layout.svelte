<script>
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { startShellui } from '$lib/shellui.js';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		let stop = () => {};
		void startShellui().then((unsubscribe) => {
			stop = unsubscribe;
		});
		return () => stop();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
