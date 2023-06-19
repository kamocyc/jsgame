import { useState } from 'preact/hooks';
import { TrackEditorComponent } from './TrackEditorComponent';
import { TimetableEditorComponent } from './timetable-editor/TimetableEditorComponent';

export function App() {
  const [appMode, setAppMode] = useState<'TrackEditor' | 'TimetableEditor'>('TimetableEditor');

  return appMode === 'TrackEditor' ? <TrackEditorComponent /> : <TimetableEditorComponent />;
}
