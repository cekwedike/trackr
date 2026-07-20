/**
 * Voice note recorder + playback for note editor.
 * Uses expo-audio (SDK 57). No ActivityIndicator — label / waveform busy states only.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { addAttachment, deleteAttachment, listAttachments } from '@/db/repos/attachments';
import type { Attachment } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { persistAudioRecording } from '@/lib/attachments';
import { toUserMessage } from '@/lib/errors';
import { PermissionRationale, requestMicrophone } from '@/lib/permissions';
import { selectionFeedback } from '@/lib/haptics';

const RECORD_OPTS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  directory: 'document' as const,
};

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Waveform({ levels, active }: { levels: number[]; active: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, flex: 1 }}>
      {levels.map((level, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: Math.max(4, Math.min(32, level)),
            borderRadius: 2,
            backgroundColor: active ? t.primary : t.borderStrong,
            opacity: active ? 0.85 : 0.45,
          }}
        />
      ))}
    </View>
  );
}

function VoiceClip({
  attachment,
  onDeleted,
}: {
  attachment: Attachment;
  onDeleted: () => void;
}) {
  const t = useTheme();
  const player = useAudioPlayer(attachment.uri);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const durationMs = (attachment.duration_ms ?? status.duration * 1000) || 0;
  const positionMs = (status.currentTime ?? 0) * 1000;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      <Pressable
        onPress={() => {
          selectionFeedback();
          if (playing) player.pause();
          else {
            if (status.currentTime >= status.duration && status.duration > 0) {
              player.seekTo(0);
            }
            player.play();
          }
        }}
        style={{
          width: 44,
          height: 44,
          borderRadius: Radius.pill,
          backgroundColor: t.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel={playing ? 'Pause recording' : 'Play recording'}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={22} color={t.primary} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="caption" color={t.textSecondary}>
          Voice note · {formatMs(playing ? positionMs : durationMs)}
        </Text>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: t.border, overflow: 'hidden' }}>
          <View
            style={{
              height: '100%',
              width: `${durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0}%`,
              backgroundColor: t.primary,
            }}
          />
        </View>
      </View>
      <Pressable
        onPress={async () => {
          try {
            await deleteAttachment(attachment.id);
            onDeleted();
          } catch (e) {
            Alert.alert('Couldn’t delete recording', toUserMessage(e));
          }
        }}
        hitSlop={10}
        accessibilityLabel="Delete recording"
      >
        <Ionicons name="trash-outline" size={18} color={t.danger} />
      </Pressable>
    </View>
  );
}

export function VoiceNoteSection({ noteId }: { noteId: number }) {
  const t = useTheme();
  const recorder = useAudioRecorder(RECORD_OPTS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [clips, setClips] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const levelsRef = useRef<number[]>(Array.from({ length: 24 }, () => 6));
  const [levels, setLevels] = useState(levelsRef.current);

  const reload = async () => {
    const rows = await listAttachments('note', noteId);
    setClips(rows.filter((r) => (r.mime ?? '').startsWith('audio') || r.uri.includes('voice-')));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    if (!recorderState.isRecording) return;
    const metering = recorderState.metering ?? -40;
    // metering is typically -160..0 dB; map to bar height
    const height = Math.max(4, Math.min(32, ((metering + 50) / 50) * 28));
    levelsRef.current = [...levelsRef.current.slice(1), height];
    setLevels([...levelsRef.current]);
  }, [recorderState.durationMillis, recorderState.metering, recorderState.isRecording]);

  const idleLevels = useMemo(() => Array.from({ length: 24 }, () => 6), []);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await requestMicrophone();
      if (outcome !== 'granted') {
        Alert.alert(PermissionRationale.microphone.title, PermissionRationale.microphone.message);
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      selectionFeedback();
    } catch (e) {
      Alert.alert('Couldn’t start recording', toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = recorderState.durationMillis ?? 0;
      if (!uri) {
        Alert.alert('Recording failed', 'No audio was saved. Please try again.');
        return;
      }
      const persisted = await persistAudioRecording(uri, 'audio/mp4');
      await addAttachment('note', noteId, persisted.uri, persisted.mime, durationMs || null);
      await setAudioModeAsync({ allowsRecording: false });
      selectionFeedback();
      await reload();
    } catch (e) {
      Alert.alert('Couldn’t save recording', toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const recording = recorderState.isRecording;

  return (
    <View style={{ gap: Spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
          backgroundColor: t.cardAlt,
          borderRadius: Radius.lg,
          padding: Spacing.md,
        }}
      >
        <Pressable
          onPress={recording ? stop : start}
          disabled={busy}
          style={{
            width: 56,
            height: 56,
            borderRadius: Radius.pill,
            backgroundColor: recording ? t.danger : t.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: busy ? 0.6 : 1,
          }}
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
        >
          <Ionicons name={recording ? 'stop' : 'mic'} size={26} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="body" weight="semibold">
            {busy && !recording
              ? 'Saving…'
              : recording
                ? `Recording ${formatMs(recorderState.durationMillis)}`
                : 'Tap to record'}
          </Text>
          <Waveform levels={recording ? levels : idleLevels} active={recording} />
        </View>
      </View>

      {clips.length === 0 ? (
        <Text variant="caption" color={t.textMuted}>
          Voice notes stay on this device and are included when you export a backup.
        </Text>
      ) : (
        <View>
          {clips.map((c) => (
            <VoiceClip key={c.id} attachment={c} onDeleted={reload} />
          ))}
        </View>
      )}
    </View>
  );
}
