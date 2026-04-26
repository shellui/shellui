import { Link } from 'react-router';
import { useConfig } from '../config/useConfig';
import { getLegalDocuments } from './legalDocuments';

export const LegalDocumentsLinks = () => {
  const { config } = useConfig();
  const legalDocuments = getLegalDocuments(config);

  if (legalDocuments.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Legal links"
      className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"
    >
      {legalDocuments.map((document) => (
        <Link
          key={document.path}
          to={document.path}
          className="hover:text-foreground hover:underline"
        >
          {document.title}
        </Link>
      ))}
    </nav>
  );
};
