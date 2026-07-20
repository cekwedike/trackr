import { useState } from 'react';
import { Alert, View } from 'react-native';

import { useConfirm } from '@/components/confirm';
import { HelpTip } from '@/components/help';
import { PassphraseModal } from '@/components/passphrase-modal';
import { AppHeader, Button, Card, Screen, SectionHeader, Text, type IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import {
  exportBackup,
  importBackupWithPassphrase,
  importLegacyBackup,
  pickBackupFile,
} from '@/lib/backup';
import { clearDemoData, loadDemoData, type DemoCounts } from '@/lib/demo-data';
import { toUserMessage } from '@/lib/errors';
import {
  exportCustomersCsv,
  exportExpensesCsv,
  exportInventoryCsv,
  exportOrdersCsv,
  exportSalesCsv,
  type CsvExportResult,
} from '@/lib/export-csv';

interface CsvAction {
  key: string;
  label: string;
  icon: IconName;
  run: () => Promise<CsvExportResult>;
}

const CSV_ACTIONS: CsvAction[] = [
  { key: 'sales', label: 'Sales', icon: 'cart', run: exportSalesCsv },
  { key: 'expenses', label: 'Expenses', icon: 'wallet', run: exportExpensesCsv },
  { key: 'customers', label: 'Customers', icon: 'people', run: exportCustomersCsv },
  { key: 'inventory', label: 'Inventory', icon: 'cube', run: exportInventoryCsv },
  { key: 'orders', label: 'Orders', icon: 'clipboard', run: exportOrdersCsv },
];

/** Human summary of inserted/removed demo counts, e.g. "3 products, 2 customers, 2 sales". */
function summarize(c: DemoCounts): string {
  const parts: string[] = [];
  if (c.products) parts.push(`${c.products} products`);
  if (c.customers) parts.push(`${c.customers} customers`);
  if (c.sales) parts.push(`${c.sales} sales`);
  if (c.expenses) parts.push(`${c.expenses} expenses`);
  if (c.orders) parts.push(`${c.orders} orders`);
  if (c.notes) parts.push(`${c.notes} notes`);
  return parts.length ? parts.join(', ') : 'nothing';
}

export default function DataScreen() {
  const t = useTheme();
  const confirm = useConfirm();
  const { reloadSettings } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [exportPassModal, setExportPassModal] = useState(false);
  const [importPassModal, setImportPassModal] = useState(false);
  const [pendingImport, setPendingImport] = useState<Uint8Array | null>(null);

  /** Run a guarded async action: only one at a time, surfacing errors via Alert. */
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', toUserMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onBackup = () => setExportPassModal(true);

  const runExport = (passphrase: string) => {
    setExportPassModal(false);
    run('backup', async () => {
      await exportBackup(passphrase);
    });
  };

  const onRestore = async () => {
    const choice = await confirm({
      title: 'Restore from a backup?',
      message:
        'This permanently REPLACES all current data in Trackr with the contents of the backup file you pick. Anything not in the backup will be lost. This cannot be undone.',
      actions: [
        { label: 'Choose file & replace data', style: 'destructive', value: 'ok' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'ok') return;

    run('restore', async () => {
      const picked = await pickBackupFile();
      if (!picked.picked) return;

      if (picked.kind === 'encrypted') {
        setPendingImport(picked.bytes);
        setImportPassModal(true);
        return;
      }

      const legacy = await confirm({
        title: 'Unencrypted backup',
        message:
          'This older backup is not passphrase-protected. Anyone with the file can read your books. Restore it anyway?',
        actions: [
          { label: 'Restore anyway', style: 'destructive', value: 'ok' },
          { label: 'Cancel', style: 'cancel', value: 'cancel' },
        ],
      });
      if (legacy !== 'ok') return;

      const result = await importLegacyBackup(picked.bytes, picked.kind);
      await reloadSettings();
      Alert.alert('Restore complete', `Your data was restored from the backup (${result.tables} tables).`);
    });
  };

  const runEncryptedImport = (passphrase: string) => {
    if (!pendingImport) {
      setImportPassModal(false);
      return;
    }
    setImportPassModal(false);
    const bytes = pendingImport;
    setPendingImport(null);
    run('restore', async () => {
      const result = await importBackupWithPassphrase(bytes, passphrase);
      await reloadSettings();
      Alert.alert('Restore complete', `Your data was restored from the backup (${result.tables} tables).`);
    });
  };

  const onCsv = (action: CsvAction) =>
    run(`csv-${action.key}`, async () => {
      const result = await action.run();
      if (result.count === 0) {
        Alert.alert('Nothing to export', `There are no ${action.label.toLowerCase()} to export yet.`);
      }
    });

  const onLoadDemo = () =>
    run('demo-load', async () => {
      const counts = await loadDemoData();
      Alert.alert('Sample data added', `Added ${summarize(counts)}. Explore the app, then clear it any time.`);
    });

  const onClearDemo = async () => {
    const choice = await confirm({
      title: 'Remove sample data?',
      message: 'This deletes only the sample records that Trackr added. Your own data is left untouched.',
      actions: [
        { label: 'Remove sample data', style: 'destructive', value: 'ok' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'ok') return;
    run('demo-clear', async () => {
      const counts = await clearDemoData();
      Alert.alert('Sample data removed', `Removed ${summarize(counts)}.`);
    });
  };

  const disabled = (key: string) => busy !== null && busy !== key;

  return (
    <Screen>
      <AppHeader
        title="Data & backup"
        back
        subtitle="Back up, restore, export & sample data"
        right={
          <HelpTip
            title="Data & backup"
            subtitle="Keep your business data safe"
            paragraphs={[
              'Trackr stores everything on this device only. Back up regularly with a passphrase so you never lose your records if your phone is lost or replaced — and so shared files stay protected.',
            ]}
            points={[
              { term: 'Backup', desc: 'A passphrase-encrypted file with all of your Trackr data plus voice notes and photos. Save it to Google Drive, Files or email.' },
              { term: 'Restore', desc: 'Load an encrypted backup (or older unprotected zip/JSON) back into Trackr. It replaces everything currently in the app.' },
              { term: 'CSV export', desc: 'A spreadsheet of one module (opens in Excel or Google Sheets) for sharing or accounting.' },
            ]}
          />
        }
      />

      {/* --- Back up --- */}
      <View style={{ marginBottom: Spacing.xl }}>
        <SectionHeader title="Back up now" icon="cloud-upload" />
        <Card style={{ gap: Spacing.md }}>
          <Text variant="body" color={t.textSecondary}>
            Save a complete, passphrase-protected copy of everything in Trackr — including voice notes and photos.
            You’ll need that passphrase to restore. Keep the file somewhere safe like Google Drive, Files or your email.
          </Text>
          <Button
            title="Back up now"
            icon="cloud-upload"
            onPress={onBackup}
            loading={busy === 'backup'}
            disabled={disabled('backup')}
          />
        </Card>
      </View>

      {/* --- Restore --- */}
      <View style={{ marginBottom: Spacing.xl }}>
        <SectionHeader title="Restore from a file" icon="cloud-download" />
        <Card style={{ gap: Spacing.md }}>
          <Text variant="body" color={t.textSecondary}>
            Bring back data from a Trackr encrypted backup (or an older unprotected zip/JSON). This overwrites
            everything currently in Trackr, so only use it on a fresh install or when you want to roll back.
          </Text>
          <Button
            title="Restore from backup"
            icon="cloud-download"
            variant="danger"
            onPress={onRestore}
            loading={busy === 'restore'}
            disabled={disabled('restore')}
          />
        </Card>
      </View>

      {/* --- CSV export --- */}
      <View style={{ marginBottom: Spacing.xl }}>
        <SectionHeader title="Export to CSV" icon="grid" />
        <Card style={{ gap: Spacing.md }}>
          <Text variant="body" color={t.textSecondary}>
            Export any module as a spreadsheet (.csv) you can open in Excel or Google Sheets — handy for accounting or
            sharing with someone else.
          </Text>
          <View style={{ gap: Spacing.sm }}>
            {CSV_ACTIONS.map((action) => (
              <Button
                key={action.key}
                title={action.label}
                icon={action.icon}
                variant="secondary"
                onPress={() => onCsv(action)}
                loading={busy === `csv-${action.key}`}
                disabled={disabled(`csv-${action.key}`)}
              />
            ))}
          </View>
        </Card>
      </View>

      {/* --- Sample data --- */}
      <View style={{ marginBottom: Spacing.xl }}>
        <SectionHeader title="Sample data" icon="flask" />
        <Card style={{ gap: Spacing.md }}>
          <Text variant="body" color={t.textSecondary}>
            New to Trackr? Add a small set of example products, customers, sales, an order and a note to explore how
            everything works. You can remove it again in one tap — only the samples are deleted.
          </Text>
          <Button
            title="Load sample data"
            icon="flask"
            variant="secondary"
            onPress={onLoadDemo}
            loading={busy === 'demo-load'}
            disabled={disabled('demo-load')}
          />
          <Button
            title="Clear sample data"
            icon="trash"
            variant="ghost"
            onPress={onClearDemo}
            loading={busy === 'demo-clear'}
            disabled={disabled('demo-clear')}
          />
        </Card>
      </View>

      <PassphraseModal
        visible={exportPassModal}
        mode="export"
        title="Protect this backup"
        message="Choose a passphrase. You’ll need it to restore. Don’t share the file without it."
        confirmLabel="Export"
        onClose={() => setExportPassModal(false)}
        onSubmit={runExport}
      />
      <PassphraseModal
        visible={importPassModal}
        mode="import"
        title="Enter backup passphrase"
        message="This backup is encrypted. Enter the passphrase used when it was exported."
        confirmLabel="Restore"
        onClose={() => {
          setImportPassModal(false);
          setPendingImport(null);
        }}
        onSubmit={runEncryptedImport}
      />
    </Screen>
  );
}
