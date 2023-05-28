import { onFileSelectorChange } from "./file.js";
import { initializeTrainMove } from "./initializeTrainMove.js";
import { DiagramExt, getEkiJikokus } from "./oudParser.js";
import { svgLoaderMain } from "./svgLoader.js";
import { drawTimetable_ } from "./timetableEditor.js";
import { initializeTrackEditor } from "./trackEditor.js";
// import { drawTimetable } from "./timetableEditor.js";

const RUN_MODE: 'TrainMove' | 'TimetableEdit' | 'TrackEdit' = 'TrackEdit';

async function initializeTrainMoveMode() {
  let interrupt: ((newInterval: number | undefined, restart: boolean) => boolean) | undefined = undefined;
  
  await svgLoaderMain();

  const fileSelector = document.getElementById('file-selector')!;
  fileSelector.addEventListener('change', async (event) => {
    const diagram = await onFileSelectorChange(event);
    if (diagram != null) {
      if (interrupt) {
        interrupt(undefined, false);
      }

      const trainMove = await svgLoaderMain();
      interrupt = initializeTrainMove(diagram, trainMove);

      document.getElementById('button-slow-speed')!.onclick = (ev) => {
        interrupt!(undefined, true);
      };

      document.getElementById('button-slow-speed-2')!.onclick = (ev) => {
        if ((ev.target as HTMLButtonElement).value !== 'slow') {
          interrupt!(undefined, false);
          interrupt!(10, true);
          (ev.target as HTMLButtonElement).value = 'slow';
        } else {
          interrupt!(undefined, false);
          interrupt!(100, true);
          (ev.target as HTMLButtonElement).value = 'fast';
        }
      }
    }
  });
}

export async function initializeTimetableEdit() {
  fetch('./narasen_dia.oud2').then(r => r.text()).then(r => {
    const diagram = getEkiJikokus(r as string);
    drawTimetable_(diagram as DiagramExt);
  })
  // const fileSelector = document.getElementById('file-selector')!;
  // fileSelector.addEventListener('change', async (event) => {
  //   const diagram = await onFileSelectorChange(event);
  //   if (diagram != null) {
  //     drawTimetable_(diagram as DiagramExt);
  //   }
  // });
}

export async function initialize() {
  // drawDiagram_();
  // initialize();

  // fetch('./narasen_dia.oud2').then(x => x.text()).then(data => {
  //   const r = getEkiJikokus(data);
  //   drawTimetable(r);
  // })

  if (RUN_MODE === 'TrainMove') {
    await initializeTrainMoveMode();
  } else if (RUN_MODE === 'TimetableEdit') {
    await initializeTimetableEdit()
  } else if (RUN_MODE === 'TrackEdit') {
    await initializeTrackEditor();
  }

    
}
