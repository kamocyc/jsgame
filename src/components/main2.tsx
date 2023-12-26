import { enableMapSet, enablePatches, setAutoFreeze } from 'immer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { useStrictMode } from 'react-konva';
import { TimetableEditorAppContainer } from './timetable-editor-app-container';
import { ToastComponent } from './toast-component';

enablePatches();
enableMapSet();
setAutoFreeze(true);
useStrictMode(true);

function IndividualTimetableRootComponent() {
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  return (
    <>
      <ToastComponent message={toastMessage} setMessage={setToastMessage} />
      <TimetableEditorAppContainer setToastMessage={setToastMessage} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <IndividualTimetableRootComponent />
  </React.StrictMode>
);
