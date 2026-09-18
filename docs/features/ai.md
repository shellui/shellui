---
title: Run on-device AI
sidebar_label: On-device AI
description: 'Settings → AI, Ollama and browser models, and shellui.ai Prompt API messaging from iframe apps.'
---

Shellui can run language models **on the user's device** so every embedded app shares one install and one GPU session. Apps never talk to Ollama or WebGPU directly - they call a browser-shaped API on `@shellui/sdk`, and the **shell** (in `@shellui/core`) owns discovery, model lifecycle, and inference.

Local AI ships as a **default core feature**. You do not install a separate AI package. Turn providers on or off in **Settings → AI**.

## What you install or download

There are two optional paths. Neither requires a Shellui cloud AI backend.

### Ollama (app on the machine)

1. Install [Ollama](https://ollama.com/) on the computer.
2. Pull a model there (for example `ollama pull llama3.2`).
3. Open **Settings → AI** in Shellui. If Ollama is running locally, the shell lists those models.

Models stay in Ollama's own storage. The browser only calls a local HTTP API (`http://127.0.0.1:11434` by default). If Ollama is not running, Shellui soft-fails - the rest of the shell still works.

### Browser models (catalog in this profile)

**Settings → AI** lists a curated browser catalog. **Install** records a catalog entry on this device (survives reload; shared by every app on this origin). **Remove** deletes that record.

Browser **weight download and inference are not wired yet**. Use Ollama for prompts until the WebLLM engine lands. Install still needs WebGPU available in the browser.

## Why apps don't load WebLLM themselves

If every iframe downloaded and warmed its own copy:

- Disk and RAM would multiply per app
- Phones would thrash GPU memory
- Users would re-download the same weights

The shell keeps **one** registry and **one** runtime. Apps call `shellui.ai.languageModel` (Prompt API / `LanguageModel` shape). The SDK only `postMessage`s to the parent; adapters (`OllamaAdapter`, `WebLLMAdapter`, …) stay in core. AI requests use the same privileged companion + trusted-frame policy as storage (`safeForAuthToken`).

## WebGPU and soft degradation

Browser catalog installs need **WebGPU**. Settings → AI shows WebGPU, Ollama, and browser storage status. If WebGPU is missing:

- Ollama can still work when installed
- Browser catalog models show as needing WebGPU
- Apps see `availability()` as `unavailable` or `downloadable` instead of hard crashes

## What you should know (risks)

| Topic             | Plain language                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Disk size         | Browser models are big once real downloads land.                                                              |
| First-load time   | Loading weights into the GPU can take a while the first time.                                                 |
| Battery / heat    | Local inference uses the CPU/GPU; laptops and phones can get warm.                                            |
| Untrusted prompts | Apps send the text. Treat it like any other untrusted input (prompt injection, sensitive data in the prompt). |
| Privacy           | v1 stays on-device. A later hosted backend is out of scope for this feature's first version.                  |

## Settings → AI

Open the built-in settings route (default `/__settings`), then **Preferences → AI**.

You can:

- Allow or block apps from using AI
- Scan WebGPU / Ollama / browser storage status
- Pick a default model (automatic when only one is ready)
- Toggle Ollama and browser providers
- List Ollama models when reachable
- Install / cancel / remove browser catalog entries (inference still Ollama-only for now)

**Settings → Develop** has **AI test tools** (probe, list, one-shot and stream prompt) for developers. Day-to-day setup stays on Settings → AI.

## Developer SDK sketch

```typescript
import { shellui } from '@shellui/sdk';

await shellui.init();

const availability = await shellui.ai.languageModel.availability();
// 'available' | 'downloadable' | 'downloading' | 'unavailable'

if (availability !== 'available') {
  console.warn('No ready model yet - open Settings → AI');
} else {
  const session = await shellui.ai.languageModel.create();
  const text = await session.prompt('Summarize this…');
  for await (const chunk of session.promptStreaming('…')) {
    // stream tokens
  }
  session.destroy();
}
```

Messaging (for implementers): `SHELLUI_AI_REQUEST` → shell → `SHELLUI_AI_RESPONSE` / `SHELLUI_AI_STREAM` back to the requesting iframe only.

## Architecture

```
App iframe
  └─ shellui.ai / LanguageModel (packages/sdk/src/ai)
       └─ postMessage (privileged + trusted-frame)
            └─ AiBridge (packages/core/src/features/ai)
                 ├─ registry + adapters/
                 │    ├─ OllamaAdapter
                 │    └─ WebLLMAdapter (catalog install stub; inference TODO)
                 └─ Settings → AI panel
```

Module map and notes: `packages/core/src/features/ai/README.md`.

## Related

- Issue [#47](https://github.com/shellui/shellui/issues/47) - full v1 acceptance (real download pipeline, playground, etc.)
- [SDK](/sdk) - general iframe APIs
- [Storage](/features/storage) - similar shell-owned bridge pattern
