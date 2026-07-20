import { LegalDoc } from '@/components/legal-doc';
import { PRIVACY_SECTIONS } from '@/lib/legal-copy';

export default function PrivacyPolicy() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro="This policy describes how Trackr handles information for a local-first SME business app. Your books stay on your device unless you export a backup you control."
      sections={PRIVACY_SECTIONS}
    />
  );
}
