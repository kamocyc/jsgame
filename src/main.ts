import { min } from "./common.js";
import { draw } from "./drawer.js";
import { onFileSelectorChange } from "./file.js";
import { generateLines, prepare } from "./generateLine.js";
import { Diagram } from "./model.js";
import { TrainMove } from "./trainMove.js";

let intervalId: null | number = null;

function mainLoop(trainMove: TrainMove, diagram: Diagram) {
  trainMove.addTrainFromDiagramAndTime(diagram)
  trainMove.main();

  draw(trainMove, null, null);
}

function initializeTrainMove(diagram: Diagram) {
  const stationIdMap = prepare(diagram);

  const trainMove = new TrainMove();
  generateLines(trainMove.tracks, trainMove.switches, diagram.stations, stationIdMap);

  trainMove.mode = 'TimetableMode';
  trainMove.globalTime = min(diagram.trains.map(t => t.trainTimetable.map(tt => tt.arrivalTime)).flat());

  intervalId = setInterval(() => mainLoop(trainMove, diagram), 100);
}

export function initialize() {
  // drawDiagram_();
  // initialize();
  // initialize2();
  // loadTime();

  // const button = document.getElementById('button-slow-speed') as HTMLInputElement;
  // button.onclick = function () {
  //   toJSON();
  //   clearInterval(timeoutId);
  //   if (button.value === 'slow') {
  //     button.value = 'fast';
  //     timeoutId = setInterval(main, 100);
  //   } else {
  //     button.value = 'slow';
  //     timeoutId = setInterval(main, 1000);
  //   }
  // }
  
  const fileSelector = document.getElementById('file-selector')!;
  fileSelector.addEventListener('change', async (event) => {
    const diagram = await onFileSelectorChange(event);
    if (diagram != null) {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      initializeTrainMove(diagram);
    }
  });
}
