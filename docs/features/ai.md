# On-device AI

Shellui can run language models **on the user’s device** so every embedded app shares one download and one GPU session. Apps never talk to Ollama or WebGPU directly — they call a browser-shaped API on `@shellui/sdk`, and the **shell** owns discovery, model lifecycle, and inference.

This page is the human-readable overview. Engine adapters live in [`@shellui/ai`](https://github.com/shellui/shellui/tree/develop/packages/ai) (see that package README for **how to remove** the feature cleanly).

## What you install or download

There are two optional paths. Neither requires a Shellui cloud AI backend.

### Ollama (app on the machine)

1. Install [Ollama](https://ollama.com/) on the computer.
2. Pull a model there (for example `ollama pull llama3.2`).
3. Open **Settings → AI** in Shellui. If Ollama is running locally, the shell lists those models.

Models stay in Ollama’s own storage. The browser only calls a local HTTP API (`http://127.0.0.1:11434` by default). If Ollama is not running, Shellui soft-fails — the rest of the shell still works.

### Browser models (files in the tab)

Later slices will let you download a curated model into **this browser’s storage** (OPFS / Cache). Those files are large (hundreds of MB to a few GB). They are not uploaded to Shellui servers; they live on the device for that browser profile.

The Settings panel already shows a **catalog stub** (not downloaded yet). Download, pause, resume, and delete come next.

## Why apps don’t load WebLLM themselves

If every iframe downloaded and warmed its own copy:

- Disk and RAM would multiply per app
- Phones would thrash GPU memory
- Users would re-download the same weights

The shell keeps **one** registry and **one** runtime. Apps call `shellui.ai.languageModel` (Prompt API / `LanguageModel` shape). The SDK only `postMessage`s to the parent; adapters (`OllamaAdapter`, `WebLLMAdapter`, future Transformers.js, …) stay in the shell.

## WebGPU and soft degradation

Browser inference needs **WebGPU**. Settings → AI shows whether WebGPU is available. If it is not:

- Ollama can still work when installed
- Browser catalog models show as needing WebGPU / not ready
- Apps see `availability()` as `unavailable` or `downloadable` instead of hard crashes

## What you should know (risks)

| Topic             | Plain language                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Disk size         | Browser models are big. Confirm size before download (when download lands).                                   |
| First-load time   | Loading weights into the GPU can take a while the first time.                                                 |
| Battery / heat    | Local inference uses the CPU/GPU; laptops and phones can get warm.                                            |
| Untrusted prompts | Apps send the text. Treat it like any other untrusted input (prompt injection, sensitive data in the prompt). |
| Privacy           | v1 stays on-device. A later hosted backend is out of scope for this feature’s first version.                  |

## Settings → AI

Open the built-in settings route (default `/__settings`), then **Preferences → AI**.

You can:

- Allow or block apps from using AI
- See WebGPU and Ollama status
- Toggle Ollama / browser providers
- Pick a default model when more than one is ready
- Browse Ollama tags (when reachable) and the browser catalog stub

## Developer SDK sketch

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();

const availability = await shellui.ai.languageModel.availability();
// 'available' | 'downloadable' | 'downloading' | 'unavailable'

if (availability !== 'available') {
  console.warn('No ready model yet — open Settings → AI');
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

## Architecture (removable module)

```
App iframe
  └─ shellui.ai / LanguageModel (packages/sdk/src/ai)
       └─ postMessage
            └─ AiBridge (packages/core/src/features/ai)
                 └─ @shellui/ai registry
                      ├─ OllamaAdapter
                      └─ WebLLMAdapter (catalog stub → download TODO)
```

To delete the feature later, follow the checklist in `packages/ai/README.md`.

## Related

- Issue [#47](https://github.com/shellui/shellui/issues/47) — full v1 acceptance (download pipeline, playground, etc.)
- [SDK](/sdk) — general iframe APIs
- [Storage](/features/storage) — similar shell-owned bridge pattern
