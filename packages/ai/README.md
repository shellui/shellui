# `@shellui/ai`

On-device AI for Shellui: adapter interface, registry, Ollama probe, and a WebLLM-shaped browser adapter stub.

Apps never import this package. They call `@shellui/sdk` (`shellui.ai` / LanguageModel). The shell owns discovery, downloads, and inference.

## Public entry

```ts
import {
  createDefaultAiRegistry,
  OllamaAdapter,
  WebLLMAdapter,
  probeWebGpu,
  probeOllama,
  BROWSER_MODEL_CATALOG,
} from '@shellui/ai';
```

## Adapters

| Adapter         | Role                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `OllamaAdapter` | Detect localhost Ollama, list tags, prompt / stream when reachable   |
| `WebLLMAdapter` | Curated catalog + “not downloaded” status; download pipeline is TODO |

Both implement `AiAdapter` (`id`, `listModels`, `load`, `prompt`, `promptStreaming`, `unload`, `isAvailable`).

Swap engines later (e.g. Transformers.js) by registering another adapter — the SDK façade stays unchanged.

## How to remove this feature

Delete these pieces and the AI surface is gone without leftover coupling:

1. **Package:** remove `packages/ai/` and drop `@shellui/ai` from `packages/core/package.json`.
2. **Core feature:** remove `packages/core/src/features/ai/` and the `<AiBridge />` mount in `packages/core/src/app.tsx`.
3. **Settings:** remove the AI route from `SettingsRoutes.tsx` / `SettingsView.tsx`, the `Ai` panel component, the Sparkles icon usage, and `ai` keys from `en`/`fr` `settings.json`.
4. **Settings persistence:** remove `ai` from the SDK `Settings` type and from `SettingsProvider` defaults / localStorage merge.
5. **SDK:** remove `packages/sdk/src/ai/`, `shellui.ai` wiring in `packages/sdk/src/index.ts`, and `SHELLUI_AI_*` message types from `packages/sdk/src/types.ts`.
6. **Docs:** remove `docs/features/ai.md` and the sidebar entry in `tools/docusaurus/sidebars.js`.
7. **Tests:** remove AI globs from `packages/core/vitest.config.ts` if any remain.

Message types to purge: `SHELLUI_AI_REQUEST`, `SHELLUI_AI_RESPONSE`, `SHELLUI_AI_STREAM`.
