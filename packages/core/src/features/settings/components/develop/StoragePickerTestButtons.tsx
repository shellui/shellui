import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shellui, type StorageSelectedItem } from '@shellui/sdk';
import { Button } from '../../../../components/ui/button';

const FolderIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);

const FileIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
  </svg>
);

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export const StoragePickerTestButtons = () => {
  const { t } = useTranslation('settings');
  const [items, setItems] = useState<StorageSelectedItem[]>([]);

  const runPicker = async (fn: () => Promise<{ items: StorageSelectedItem[] } | null>) => {
    try {
      const result = await fn();
      if (result) setItems(result.items);
    } catch (err) {
      shellui.toast({
        title: t('develop.testing.storagePicker.errorTitle'),
        description: err instanceof Error ? err.message : t('develop.testing.storagePicker.error'),
        type: 'error',
      });
    }
  };

  return (
    <div>
      <h4
        className="text-sm font-medium mb-2"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        {t('develop.testing.storagePicker.title')}
      </h4>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => void runPicker(() => shellui.selectFolders())}
        >
          {t('develop.testing.storagePicker.buttons.folders')}
        </Button>
        <Button
          variant="outline"
          onClick={() => void runPicker(() => shellui.selectFolders({ multiple: true }))}
        >
          {t('develop.testing.storagePicker.buttons.foldersMultiple')}
        </Button>
        <Button
          variant="outline"
          onClick={() => void runPicker(() => shellui.selectFiles({ multiple: true }))}
        >
          {t('develop.testing.storagePicker.buttons.files')}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void runPicker(() => shellui.selectFiles({ multiple: true, folders: true }))
          }
        >
          {t('develop.testing.storagePicker.buttons.filesAndFolders')}
        </Button>
      </div>
      {items.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {items.map((item) => (
            <li
              key={`${item.bucket}:${item.type}:${item.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm"
            >
              <span className="shrink-0 text-muted-foreground">
                {item.type === 'folder' ? <FolderIcon /> : <FileIcon />}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <button
                type="button"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() =>
                  setItems((current) =>
                    current.filter(
                      (entry) =>
                        !(
                          entry.id === item.id &&
                          entry.bucket === item.bucket &&
                          entry.type === item.type
                        ),
                    ),
                  )
                }
                aria-label={t('develop.testing.storagePicker.remove', { name: item.name })}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
