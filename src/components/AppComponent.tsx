import { TimetableEditorComponent } from './timetable-editor/TimetableEditorComponent';
import { SplitViewComponent } from './timetable-editor/common-component';
import { TrackEditorComponent } from './track-editor/TrackEditorComponent';

export function App() {
  return (
    <SplitViewComponent
      splitViews={[
        {
          splitViewId: 1,
          component: () => <TrackEditorComponent />,
        },
        {
          splitViewId: 2,
          component: () => <TimetableEditorComponent />,
        },
      ]}
    />
  );
}
