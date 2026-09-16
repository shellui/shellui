<script>
	import { language, t, theme } from '$lib/i18n.js';

	function themeLabel(current, translate) {
		if (!current) return translate('fallbackTheme');
		const name = current.displayName || current.name || 'shellui';
		return `${name} · ${current.mode}`;
	}
</script>

<main class="shellui-home">
	<p class="eyebrow">Shellui</p>
	<h1>{$t('title')}</h1>
	<p class="blurb">{$t('blurb')}</p>

	<dl class="meta">
		<div>
			<dt>{$t('themeLabel')}</dt>
			<dd>{themeLabel($theme, $t)}</dd>
		</div>
		<div>
			<dt>{$t('languageLabel')}</dt>
			<dd>{$language || $t('fallbackLanguage')}</dd>
		</div>
	</dl>

	<p class="hint">{$t('hint')}</p>
</main>
