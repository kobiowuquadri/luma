import { useCallback } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';

/** Mono AAC in an .m4a file: small uploads, a format YarnGPT accepts. */
const SPEECH_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 64000,
};

export type RecordStart = 'ok' | 'denied' | 'error';

/** Records a spoken question only while the student holds it open. */
export function useQuestionRecorder() {
  const recorder = useAudioRecorder(SPEECH_RECORDING);
  const state = useAudioRecorderState(recorder, 250);

  const start = useCallback(async (): Promise<RecordStart> => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return 'denied';
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      return 'ok';
    } catch {
      return 'error';
    }
  }, [recorder]);

  const stop = useCallback(async (): Promise<{ uri: string | null; durationMs: number }> => {
    const durationMs = recorder.currentTime * 1000;
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    return { uri: recorder.uri, durationMs };
  }, [recorder]);

  return { start, stop, isRecording: state.isRecording, durationMs: state.durationMillis };
}
