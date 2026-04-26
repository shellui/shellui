import type { ShellUIConfig } from '../config/types';
import urls from '../../constants/urls';

export type LegalDocumentKey =
  | 'privacyPolicy'
  | 'termsOfService'
  | 'legalNotice'
  | 'dataProcessingAgreement';

export type LegalDocumentDescriptor = {
  key: LegalDocumentKey;
  title: string;
  path: string;
  filename: string;
  content: string;
};

type LegalDocumentDefinition = Omit<LegalDocumentDescriptor, 'content'>;

const LEGAL_DOCUMENT_DEFINITIONS: LegalDocumentDefinition[] = [
  {
    key: 'privacyPolicy',
    title: 'Privacy Policy',
    path: urls.legalPrivacyPolicy,
    filename: 'privacy-policy.md',
  },
  {
    key: 'termsOfService',
    title: 'Terms of Service',
    path: urls.legalTermsOfService,
    filename: 'terms-of-service.md',
  },
  {
    key: 'legalNotice',
    title: 'Legal Notice',
    path: urls.legalNotice,
    filename: 'legal-notice.md',
  },
  {
    key: 'dataProcessingAgreement',
    title: 'Data Processing Agreement',
    path: urls.legalDataProcessingAgreement,
    filename: 'data-processing-agreement.md',
  },
];

export const getLegalDocuments = (config: ShellUIConfig): LegalDocumentDescriptor[] => {
  const legalConfig = config.legalDocuments;
  if (!legalConfig) return [];
  const documents: LegalDocumentDescriptor[] = [];
  for (const definition of LEGAL_DOCUMENT_DEFINITIONS) {
    const content = legalConfig[definition.key];
    if (typeof content !== 'string') continue;
    const trimmedContent = content.trim();
    if (!trimmedContent) continue;
    documents.push({
      ...definition,
      content: trimmedContent,
    });
  }
  return documents;
};
