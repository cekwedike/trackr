/**
 * Marketing hub — local message templates (copy/share), birthday list this month,
 * and a simple promo checklist. No external APIs.
 */
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';

import { FadeSlide } from '@/components/anim';
import { useAlert, useConfirm } from '@/components/confirm';
import { SelectField, SelectModal } from '@/components/pickers';
import {
  AppHeader,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  FAB,
  ListRow,
  Screen,
  SectionHeader,
  Text,
  TextField,
  Toggle,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { listCustomers } from '@/db/repos/customers';
import {
  createMarketingIdea,
  deleteMarketingIdea,
  ensureDefaultIdeas,
  listMarketingIdeas,
  setMarketingIdeaDone,
  updateMarketingIdea,
} from '@/db/repos/marketing-ideas';
import {
  createMessageTemplate,
  deleteMessageTemplate,
  ensureDefaultTemplates,
  fillTemplate,
  listMessageTemplates,
  TEMPLATE_CATEGORIES,
  updateMessageTemplate,
} from '@/db/repos/templates';
import type { MessageTemplate } from '@/db/types';
import { useAsyncData } from '@/hooks/use-async-data';
import { useTheme } from '@/hooks/use-theme';
import { dayjs, formatDate } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';

export default function MarketingScreen() {
  const t = useTheme();
  const { terms } = useApp();
  const alert = useAlert();
  const [editing, setEditing] = useState<MessageTemplate | null | 'new'>(null);
  const [ideaText, setIdeaText] = useState('');
  const [editingIdeaId, setEditingIdeaId] = useState<number | null>(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState('');
  const [savingIdeaId, setSavingIdeaId] = useState<number | null>(null);
  const [addingIdea, setAddingIdea] = useState(false);

  const { data, reload } = useAsyncData(async () => {
    await Promise.all([ensureDefaultTemplates(), ensureDefaultIdeas()]);
    const [templates, ideas, customers] = await Promise.all([
      listMessageTemplates(),
      listMarketingIdeas(),
      listCustomers(),
    ]);
    const month = dayjs().month();
    const birthdays = customers
      .filter((c) => c.birthday && dayjs(c.birthday).isValid() && dayjs(c.birthday).month() === month)
      .sort((a, b) => dayjs(a.birthday!).date() - dayjs(b.birthday!).date());
    return { templates, ideas, birthdays };
  }, []);

  const shareBody = async (body: string, title: string) => {
    try {
      await Share.share({ message: body, title });
    } catch (e) {
      void alert({ title: 'Couldn’t share', message: toUserMessage(e, 'Try again in a moment.') });
    }
  };

  if (editing !== null) {
    return (
      <TemplateEditor
        initial={editing === 'new' ? undefined : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />
    );
  }

  return (
    <>
      <Screen>
        <AppHeader title="Marketing" subtitle="Templates, birthdays & promo checklist" back />

        <FadeSlide>
          <SectionHeader
            title="Birthdays this month"
            subtitle={data ? `${data.birthdays.length} ${terms.customers.toLowerCase()}` : undefined}
          />
          {data && data.birthdays.length > 0 ? (
            <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
              {data.birthdays.slice(0, 8).map((c, idx) => (
                <View key={c.id}>
                  <ListRow
                    icon="gift"
                    iconTone="accent"
                    title={c.name}
                    subtitle={formatDate(c.birthday)}
                    onPress={() => router.push(`/customers/${c.id}`)}
                    right={<Chip label="Open" tone="primary" />}
                  />
                  {idx < Math.min(data.birthdays.length, 8) - 1 ? <Divider /> : null}
                </View>
              ))}
            </Card>
          ) : (
            <Card style={{ marginBottom: Spacing.lg }}>
              <Text variant="caption" color={t.textMuted}>
                No birthdays this month yet. Add birthdays on {terms.customers.toLowerCase()} (or import contacts) to plan wishes here.
              </Text>
            </Card>
          )}
        </FadeSlide>

        <SectionHeader title="Message templates" subtitle="Share to SMS, WhatsApp, or email" />
        {data && data.templates.length > 0 ? (
          <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg }}>
            {data.templates.map((tpl, idx) => (
              <View key={tpl.id}>
                <ListRow
                  icon="chatbubble-ellipses"
                  iconTone="info"
                  title={tpl.title}
                  subtitle={tpl.category ?? undefined}
                  onPress={() => setEditing(tpl)}
                  right={
                    <Chip
                      label="Share"
                      tone="primary"
                      onPress={() => shareBody(fillTemplate(tpl.body), tpl.title)}
                    />
                  }
                />
                {idx < data.templates.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        ) : (
          <Card style={{ marginBottom: Spacing.lg }}>
            <EmptyState
              icon="chatbubble-outline"
              title="No templates yet"
              message="Save reusable messages for promos, follow-ups and birthdays."
              actionLabel="New template"
              onAction={() => setEditing('new')}
              compact
            />
          </Card>
        )}

        <SectionHeader title="Promo checklist" />
        <Card style={{ gap: Spacing.md, marginBottom: Spacing.lg }}>
          {(data?.ideas ?? []).map((idea) => (
            <View key={idea.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <Toggle
                value={idea.done === 1}
                onValueChange={async (v) => {
                  await setMarketingIdeaDone(idea.id, v);
                  reload();
                }}
              />
              {editingIdeaId === idea.id ? (
                <>
                  <TextField
                    style={{ flex: 1 }}
                    value={editingIdeaTitle}
                    onChangeText={setEditingIdeaTitle}
                    autoFocus
                  />
                  <Chip
                    label={savingIdeaId === idea.id ? 'Saving…' : 'Save'}
                    onPress={async () => {
                      if (savingIdeaId != null) return;
                      const next = editingIdeaTitle.trim();
                      if (!next || next === idea.title) {
                        setEditingIdeaId(null);
                        setEditingIdeaTitle('');
                        return;
                      }
                      setSavingIdeaId(idea.id);
                      try {
                        await updateMarketingIdea(idea.id, next);
                        setEditingIdeaId(null);
                        setEditingIdeaTitle('');
                        reload();
                      } catch (e) {
                        void alert({
                          title: 'Couldn’t save',
                          message: toUserMessage(e, 'Couldn’t save this idea. Please try again.'),
                        });
                      } finally {
                        setSavingIdeaId(null);
                      }
                    }}
                  />
                </>
              ) : (
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    setEditingIdeaId(idea.id);
                    setEditingIdeaTitle(idea.title);
                  }}
                >
                  <Text
                    variant="body"
                    style={{
                      textDecorationLine: idea.done === 1 ? 'line-through' : undefined,
                      opacity: idea.done === 1 ? 0.55 : 1,
                    }}
                  >
                    {idea.title}
                  </Text>
                </Pressable>
              )}
              <Chip
                label="Remove"
                onPress={async () => {
                  await deleteMarketingIdea(idea.id);
                  reload();
                }}
              />
            </View>
          ))}
          <TextField
            label="Add idea"
            value={ideaText}
            onChangeText={setIdeaText}
            placeholder="e.g. Weekend flash sale"
          />
          <Button
            title="Add to checklist"
            icon="add"
            variant="secondary"
            loading={addingIdea}
            onPress={async () => {
              const next = ideaText.trim();
              if (!next || addingIdea) return;
              setAddingIdea(true);
              try {
                await createMarketingIdea(next);
                setIdeaText('');
                reload();
              } catch (e) {
                void alert({
                  title: 'Couldn’t save',
                  message: toUserMessage(e, 'Couldn’t add this idea. Please try again.'),
                });
              } finally {
                setAddingIdea(false);
              }
            }}
          />
        </Card>

        <SectionHeader title="Related" />
        <Card padded={false} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl }}>
          <ListRow
            icon="people"
            iconTone="info"
            title={terms.customers}
            subtitle="Contacts, birthdays, balances"
            onPress={() => router.push('/customers')}
          />
          <Divider />
          <ListRow
            icon="notifications"
            iconTone="primary"
            title="Birthday alerts"
            subtitle="Enable in Settings → Event alerts"
            onPress={() => router.push('/settings')}
          />
          <Divider />
          <ListRow
            icon="document-text"
            iconTone="accent"
            title="Notes"
            subtitle="Campaign drafts & ideas"
            onPress={() => router.push('/notes' as Href)}
          />
        </Card>
      </Screen>
      <FAB label="Template" onPress={() => setEditing('new')} />
    </>
  );
}

function TemplateEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial?: MessageTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTheme();
  const confirm = useConfirm();
  const alert = useAlert();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'Promo');
  const [catModal, setCatModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      void alert({ title: 'Add a title', message: 'Give this template a short name.' });
      return;
    }
    if (!body.trim()) {
      void alert({ title: 'Add a message', message: 'Write the text you’ll share.' });
      return;
    }
    setSaving(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), category: category || null };
      if (initial) await updateMessageTemplate(initial.id, payload);
      else await createMessageTemplate(payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    const choice = await confirm({
      title: 'Delete template',
      message: 'Remove this template?',
      actions: [
        { label: 'Delete', style: 'destructive', value: 'delete' },
        { label: 'Cancel', style: 'cancel', value: 'cancel' },
      ],
    });
    if (choice !== 'delete') return;
    await deleteMessageTemplate(initial.id);
    onSaved();
  };

  return (
    <Screen>
      <AppHeader title={initial ? 'Edit template' : 'New template'} back onBack={onClose} />
      <Card style={{ gap: Spacing.md }}>
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Weekend promo" autoFocus={!initial} />
        <SelectField label="Category" value={category} onPress={() => setCatModal(true)} />
        <TextField
          label="Message"
          value={body}
          onChangeText={setBody}
          placeholder="Use {name} for the customer’s name"
          multiline
        />
        <Text variant="caption" color={t.textMuted}>
          Tip: {'{name}'} is replaced when you share. Tap back to cancel without saving.
        </Text>
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </Card>
      <Button
        title={initial ? 'Save changes' : 'Save template'}
        icon="checkmark"
        onPress={save}
        loading={saving}
        size="lg"
        style={{ marginTop: Spacing.lg }}
      />
      {initial ? <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: Spacing.md }} /> : null}
      <SelectModal
        visible={catModal}
        title="Category"
        searchable={false}
        onClose={() => setCatModal(false)}
        onSelect={setCategory}
        options={TEMPLATE_CATEGORIES.map((c) => ({ id: c, label: c }))}
      />
    </Screen>
  );
}
