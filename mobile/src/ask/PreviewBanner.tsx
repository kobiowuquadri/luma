import { Banner } from '@/ui/parts';
import { useOnline } from './OnlineProvider';

/** Shown whenever the LUMA server is running with labelled test fixtures. */
export function PreviewBanner() {
  const { caps } = useOnline();
  if (caps?.mode !== 'preview-fixtures') return null;
  return (
    <Banner
      tone="warning"
      title="Preview mode: not real AI"
      message="This LUMA server is in preview mode for testing. Answers, transcripts and audio are fixed test fixtures, not AI output. The audio is a chime, not a voice."
    />
  );
}
