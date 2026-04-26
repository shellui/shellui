import type { LegalDocumentDescriptor } from './legalDocuments';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../components/ui/breadcrumb';
import urls from '../../constants/urls';

type LegalDocumentContentProps = {
  document: LegalDocumentDescriptor;
};

export const LegalDocumentContent = ({ document }: LegalDocumentContentProps) => {
  const isIframeView = typeof window !== 'undefined' && window.parent !== window;

  return (
    <article className="space-y-5">
      {!isIframeView && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={urls.legalDocuments}>Legal documents</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{document.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="max-w-none space-y-4 text-sm leading-7 text-card-foreground">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1
                className="text-3xl font-semibold tracking-tight text-card-foreground"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2
                className="mt-8 border-b pb-2 text-2xl font-semibold tracking-tight text-card-foreground first:mt-0"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3
                className="mt-6 text-xl font-semibold tracking-tight text-card-foreground"
                style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
              >
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="text-sm leading-7 text-card-foreground">{children}</p>
            ),
            ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>,
            ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>,
            li: ({ children }) => (
              <li className="text-sm leading-7 text-card-foreground">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-card-foreground">{children}</strong>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-4"
              >
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
            ),
            hr: () => <hr className="my-6 border-border" />,
          }}
        >
          {document.content}
        </ReactMarkdown>
      </div>
    </article>
  );
};
