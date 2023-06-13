import { useState } from 'preact/hooks';
import { TimetableEditorComponent } from './TimetableEditorComponent';
import { TrackEditorComponent } from './TrackEditorComponent';

export function App() {
  const [appMode, setAppMode] = useState<'TrackEditor' | 'TimetableEditor'>('TimetableEditor');

  return appMode === 'TrackEditor' ? <TrackEditorComponent /> : <TimetableEditorComponent />;
}
