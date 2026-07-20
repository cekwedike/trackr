import { LegalDoc } from '@/components/legal-doc';
import { OFFLINE_SECTIONS } from '@/lib/legal-copy';

export default function OfflineDataNotice() {
  return (
    <LegalDoc
      title="Offline & Data"
      intro="Trackr keeps your business records on this device. This notice explains what that means for backups, uninstalls, and permissions."
      sections={OFFLINE_SECTIONS}
    />
  );
}
