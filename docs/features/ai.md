---
title: Run on-device AI
sidebar_label: On-device AI
description: 'Settings → AI, Ollama and browser models, and shellui.ai Prompt API messaging from iframe apps.'
---

Shellui can run language models **on the user's device** so every embedded app shares one install and one GPU session. Apps never talk to Ollama or WebGPU directly - they call a browser-shaped API on `@shellui/sdk`, and the **shell** (in `@shellui/core`) owns discovery, model lifecycle, and inference.

Local AI ships as a **default core feature**. You do not install a separate AI package. Turn providers on or off in **Settings → AI**, or disable the whole product in config (see below).

## Disable AI entirely (config kill-switch)

In `shellui.config.json` (default is **enabled** when omitted):

```json
{
  "ai": {
    "enabled": false
  }
}
```

When `ai.enabled` is `false`:

- Settings → AI is hidden
- Develop AI test tools are hidden
- The full `AiBridge` is not mounted (a tiny responder answers `shellui.ai` with `unavailable` / `ai_disabled` so apps do not hang)
- `@mlc-ai/web-llm` is never imported and the WebLLM worker is never started
- Storage nav is **not** shown solely for local AI disk usage

This is separate from the in-app **Settings → AI → Allow apps to use AI** toggle, which soft-disables inference while keeping the AI settings panel available (when the config feature is on).

## Lazy loading (when AI is enabled in config)

Even with config AI on:

- Opening Settings → AI lists the catalog and probes WebGPU / Ollama **without** downloading the WebLLM library
- `@mlc-ai/web-llm` is loaded via dynamic `import()` only on first browser-model **Install** or **load** (and best-effort on delete cache wipe)
- The dedicated Web Worker is constructed only at that same time

## What you install or download

There are two optional paths. Neither requires a Shellui cloud AI backend.

### Ollama (app on the machine)

1. Install [Ollama](https://ollama.com/) on the computer.
2. Pull a model there (for example `ollama pull llama3.2`).
3. Open **Settings → AI** in Shellui. If Ollama is running locally, the shell lists those models.

Models stay in Ollama's own storage. The browser only calls a local HTTP API (`http://127.0.0.1:11434` by default). If Ollama is not running, Shellui soft-fails - the rest of the shell still works.

### Browser models (WebLLM / WebGPU)

**Settings → AI** lists a curated browser catalog. **Install** uses [`@mlc-ai/web-llm`](https://webllm.mlc.ai/) to fetch MLC weights from Hugging Face (via WebLLM’s prebuilt model library — not a custom HF downloader), warms a **dedicated Web Worker** engine, and marks the model ready when inference can run.

**Supported browsers for in-browser Install:** Chromium with usable WebGPU — **Chrome** and **Edge**. Firefox often exposes a basic WebGPU probe but is still too immature for WebLLM engine init in v1; Safari is unsupported too. On those browsers, Settings shows catalog models as **unsupported** and points you to **Ollama** instead of failing with a generic “Model download failed.”

**Debugging Install:** Hugging Face weight requests run **inside the WebLLM worker**, so they may not appear on the main-document Network list — check the worker’s Network/console in DevTools. Failures log as `console.error('[shellui.ai]', …)` on the page and show the real message in the transfer toaster (WebGPU worker failures map to a clear “WebGPU failed in the WebLLM worker” message).

Closing Settings does **not** cancel the download. Progress continues in the shell root **transfer toaster** (same UI as storage uploads). In-panel progress returns if you reopen Settings mid-download.

After Install completes, apps can call `shellui.ai.languageModel` immediately — no second “load” step on the happy path (the worker keeps the model warm). Reloading the tab may need a short cache warm on first prompt; the install record survives in `localStorage` and weights stay in WebLLM’s browser cache.

Reused sessions (e.g. playground Chat asking a second question) serialize generations on the shared WebLLM worker, drain each stream fully, and call `interruptGenerate()` between turns so the next `promptStreaming` does not hang. The shell also accumulates user/assistant history on the `AiSession` and passes full `messages` into WebLLM for multi-turn context.

Switching or creating a new playground conversation `destroy()`s the LanguageModel session; core then awaits WebLLM `resetChat` (still under the generation lock) so the next chat starts with a clean KV/chat state without unloading weights. Refresh is no longer required to start a new conversation.

A fire-and-forget `destroy` of the **previous** session must not interrupt the **new** one: core tracks `activeSessionId` and skips `resetConversation` / `interruptGenerate` for stale destroys. Prefer awaiting `session.destroy()` before `create()` in apps.

Catalog model ids (after the `webllm:` prefix) match WebLLM `model_id` strings, for example:

- `Llama-3.2-1B-Instruct-q4f16_1-MLC`
- `Phi-3.5-mini-instruct-q4f16_1-MLC`

**v1 limit:** one browser model warm at a time (switching models reloads the worker engine).

Browser installs need **WebGPU** on a Chromium browser.

## Why apps don't load WebLLM themselves

If every iframe downloaded and warmed its own copy:

- Disk and RAM would multiply per app
- Phones would thrash GPU memory
- Users would re-download the same weights

The shell keeps **one** registry and **one** WebLLM worker runtime. Apps call `shellui.ai.languageModel` (Prompt API / `LanguageModel` shape). The SDK only `postMessage`s to the parent; adapters (`OllamaAdapter`, `WebLLMAdapter`, …) stay in core. AI requests use the same privileged companion + trusted-frame policy as storage (`safeForAuthToken`).

## WebGPU and soft degradation

Browser catalog installs need **WebGPU**. Settings → AI shows WebGPU, Ollama, and browser storage status. If WebGPU is missing:

- Ollama can still work when installed
- Browser catalog models show as needing WebGPU
- Apps see `availability()` as `unavailable` or `downloadable` instead of hard crashes

## What you should know (risks)

| Topic             | Plain language                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Disk size         | Browser models are large (hundreds of MB to multi-GB).                                                        |
| First-load time   | First Install downloads weights; later loads use WebLLM’s cache when possible.                                |
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
- Install / cancel / remove browser catalog models (real WebLLM download + worker inference)

**Try it locally:** use **Chrome or Edge** with WebGPU → Settings → AI → Install a catalog model → wait for the toaster / panel to finish → Settings → Develop → AI test tools, or call `shellui.ai` from an iframe app. On Firefox/Safari, use Ollama instead of browser Install.

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
                 │    └─ WebLLMAdapter → WebLLMEngineService (worker)
                 ├─ transfer toaster (shared with storage uploads)
                 └─ Settings → AI panel
```

Module map and notes: `packages/core/src/features/ai/README.md`.

## Related

- Issue [#47](https://github.com/shellui/shellui/issues/47) - full v1 acceptance
- [SDK](/sdk) - general iframe APIs
- [Storage](/features/storage) - similar shell-owned bridge pattern
