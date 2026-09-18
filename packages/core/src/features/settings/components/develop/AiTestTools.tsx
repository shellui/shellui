import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { useSettings } from '../../hooks/useSettings';
import {
  collectDevelopAiDiagnostics,
  DEVELOP_AI_TEST_PROMPT,
  runDevelopAiPrompt,
  runDevelopAiStream,
  type DevelopAiDiagnostics,
} from '../../../ai/developHarness';

type BusyAction = 'refresh' | 'list' | 'prompt' | 'stream' | null;

function yesNo(value: boolean, yes: string, no: string): string {
  return value ? yes : no;
}

export const AiTestTools = () => {
  const { t } = useTranslation('settings');
  const { settings } = useSettings();
  const [diagnostics, setDiagnostics] = useState<DevelopAiDiagnostics | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [log, setLog] = useState('');
  const [error, setError] = useState<string | null>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => (prev ? `${prev}\n${line}` : line));
  }, []);

  const refresh = useCallback(
    async (options?: { log?: boolean }) => {
      setBusy('refresh');
      setError(null);
      try {
        const next = await collectDevelopAiDiagnostics(settings);
        setDiagnostics(next);
        if (options?.log) {
          appendLog(t('develop.testing.ai.logRefreshed'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('develop.testing.ai.unknownError'));
      } finally {
        setBusy(null);
      }
    },
    [appendLog, settings, t],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const listModels = useCallback(async () => {
    setBusy('list');
    setError(null);
    try {
      const next = await collectDevelopAiDiagnostics(settings);
      setDiagnostics(next);
      if (next.models.length === 0) {
        appendLog(t('develop.testing.ai.logNoModels'));
      } else {
        appendLog(
          t('develop.testing.ai.logModels', {
            list: next.models.map((m) => `${m.id} (${m.status})`).join(', '),
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('develop.testing.ai.unknownError'));
    } finally {
      setBusy(null);
    }
  }, [appendLog, settings, t]);

  const runPrompt = useCallback(async () => {
    setBusy('prompt');
    setError(null);
    try {
      const result = await runDevelopAiPrompt(settings, DEVELOP_AI_TEST_PROMPT);
      appendLog(
        t('develop.testing.ai.logPromptResult', {
          model: result.modelId,
          text: result.text,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t('develop.testing.ai.unknownError');
      setError(message);
      appendLog(t('develop.testing.ai.logPromptError', { message }));
    } finally {
      setBusy(null);
    }
  }, [appendLog, settings, t]);

  const runStream = useCallback(async () => {
    setBusy('stream');
    setError(null);
    appendLog(t('develop.testing.ai.logStreamStart'));
    try {
      const result = await runDevelopAiStream(settings, DEVELOP_AI_TEST_PROMPT, (chunk) => {
        appendLog(t('develop.testing.ai.logStreamChunk', { chunk }));
      });
      appendLog(
        t('develop.testing.ai.logStreamDone', {
          model: result.modelId,
          text: result.text,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t('develop.testing.ai.unknownError');
      setError(message);
      appendLog(t('develop.testing.ai.logStreamError', { message }));
    } finally {
      setBusy(null);
    }
  }, [appendLog, settings, t]);

  const clearLog = useCallback(() => {
    setLog('');
    setError(null);
  }, []);

  const yes = t('develop.testing.ai.yes');
  const no = t('develop.testing.ai.no');

  return (
    <div className="space-y-3">
      <div>
        <h4
          className="mb-1 text-sm font-medium"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          {t('develop.testing.ai.title')}
        </h4>
        <p className="text-sm text-muted-foreground">{t('develop.testing.ai.description')}</p>
      </div>

      <div className="space-y-1 rounded-md border border-border/70 bg-muted/30 p-3 text-sm">
        <p>
          <span className="font-medium">{t('develop.testing.ai.webGpu')}: </span>
          {diagnostics
            ? yesNo(diagnostics.webGpuAvailable, yes, no)
            : t('develop.testing.ai.loading')}
          {diagnostics?.webGpuDetail ? (
            <span className="text-muted-foreground"> — {diagnostics.webGpuDetail}</span>
          ) : null}
        </p>
        <p>
          <span className="font-medium">{t('develop.testing.ai.ollama')}: </span>
          {diagnostics
            ? yesNo(diagnostics.ollamaReachable, yes, no)
            : t('develop.testing.ai.loading')}
          {diagnostics?.ollamaLatencyMs != null ? ` (${diagnostics.ollamaLatencyMs} ms)` : null}
          {diagnostics?.ollamaDetail ? (
            <span className="text-muted-foreground"> — {diagnostics.ollamaDetail}</span>
          ) : null}
        </p>
        <p>
          <span className="font-medium">{t('develop.testing.ai.defaultModel')}: </span>
          {diagnostics?.defaultModelId ?? t('develop.testing.ai.none')}
        </p>
        <p>
          <span className="font-medium">{t('develop.testing.ai.adapters')}: </span>
          {diagnostics?.adapters.length
            ? diagnostics.adapters.join(', ')
            : t('develop.testing.ai.none')}
        </p>
        <p>
          <span className="font-medium">{t('develop.testing.ai.aiEnabled')}: </span>
          {diagnostics ? yesNo(diagnostics.aiEnabled, yes, no) : t('develop.testing.ai.loading')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => void refresh({ log: true })}
        >
          {t('develop.testing.ai.buttons.refresh')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => void listModels()}
        >
          {t('develop.testing.ai.buttons.listModels')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => void runPrompt()}
        >
          {t('develop.testing.ai.buttons.prompt')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => void runStream()}
        >
          {t('develop.testing.ai.buttons.stream')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onClick={clearLog}
        >
          {t('develop.testing.ai.buttons.clear')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('develop.testing.ai.promptHint')}</p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {log ? (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border/70 bg-background p-3 text-xs">
          {log}
        </pre>
      ) : null}
    </div>
  );
};
