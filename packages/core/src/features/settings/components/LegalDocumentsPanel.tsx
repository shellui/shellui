import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { useConfig } from '../../config/useConfig';
import { getLegalDocuments } from '../../legal/legalDocuments';
import { LegalDocumentContent } from '../../legal/LegalDocumentContent';

export const LegalDocumentsPanel = () => {
  const { config } = useConfig();
  const legalDocuments = useMemo(() => getLegalDocuments(config), [config]);
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string | null>(
    legalDocuments[0]?.path ?? null,
  );
  const selectedDocument =
    legalDocuments.find((item) => item.path === selectedDocumentPath) ?? legalDocuments[0] ?? null;

  if (legalDocuments.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-1">
        <h3
          className="text-sm font-medium leading-none"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          Legal documents
        </h3>
        <p className="text-sm text-muted-foreground">No legal documents are configured.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {legalDocuments.map((document) => (
          <Button
            key={document.path}
            variant={selectedDocument?.path === document.path ? 'default' : 'outline'}
            onClick={() => setSelectedDocumentPath(document.path)}
          >
            {document.title}
          </Button>
        ))}
      </div>
      {selectedDocument && <LegalDocumentContent document={selectedDocument} />}
    </section>
  );
};
