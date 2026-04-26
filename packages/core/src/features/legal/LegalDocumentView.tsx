import { Link, useLocation } from 'react-router';
import { useConfig } from '../config/useConfig';
import { getLegalDocuments } from './legalDocuments';
import { LegalDocumentContent } from './LegalDocumentContent';
import urls from '../../constants/urls';

export const LegalDocumentView = () => {
  const { config } = useConfig();
  const location = useLocation();
  const legalDocuments = getLegalDocuments(config);
  const selectedDocument = legalDocuments.find((item) => item.path === location.pathname);

  if (!selectedDocument) {
    return (
      <main className="mx-auto w-full max-w-4xl p-6">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          Legal documents
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No legal document is configured for this page.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-4">
        <Link
          to={urls.login}
          className="text-sm text-primary hover:underline"
        >
          Back to login
        </Link>
      </div>
      <LegalDocumentContent document={selectedDocument} />
    </main>
  );
};
