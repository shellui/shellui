import { Link } from 'react-router';
import urls from '../../constants/urls';
import { useConfig } from '../config/useConfig';
import { getLegalDocuments } from './legalDocuments';

export const LegalDocumentsIndexView = () => {
  const { config } = useConfig();
  const legalDocuments = getLegalDocuments(config);

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="space-y-2">
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
        >
          Legal documents
        </h1>
        <p className="text-sm text-muted-foreground">Select a document to view its full content.</p>
      </div>

      {legalDocuments.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No legal document is currently configured.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {legalDocuments.map((document) => (
            <li key={document.path}>
              <Link
                to={document.path}
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {document.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Link
          to={urls.login}
          className="text-sm text-primary hover:underline"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
};
