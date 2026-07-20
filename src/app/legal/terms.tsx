import { LegalDoc } from '@/components/legal-doc';
import { TERMS_SECTIONS } from '@/lib/legal-copy';

export default function TermsOfUse() {
  return (
    <LegalDoc
      title="Terms of Use"
      intro="These terms govern your use of Trackr. Read them carefully. Trackr is a record-keeping tool, not professional advice."
      sections={TERMS_SECTIONS}
    />
  );
}
