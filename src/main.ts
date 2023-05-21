import { getStationIdMapKey, min, moduloRoundDown } from "./common.js";
import { draw } from "./drawer.js";
import { onFileSelectorChange } from "./file.js";
import { generateLines, prepare } from "./generateLine.js";
import { Diagram, Train } from "./model.js";
import { svgLoaderMain } from "./svgLoader.js";
// import { drawTimetable } from "./timetableEditor.js";
import { TrainMove } from "./trainMove.js";

let intervalId: null | number = null;

function mainLoop(trainMove: TrainMove, diagram: Diagram) {
  trainMove.addTrainFromDiagramAndTime(diagram)
  trainMove.main();

  draw(trainMove, null, null);
}

function initializeTrainMove(diagram: Diagram, trainMove?: TrainMove) {
  const stationIdMap = prepare(diagram);

  if (!trainMove) {
    trainMove = new TrainMove();
    generateLines(trainMove, diagram.stations, stationIdMap);
  } else {
    // 名称で駅を一致させる
    trainMove.tracks.forEach(track => {
      const station = track.track.station;
      if (station) {
        const [baseName, platformNo_] = station.stationName.split(' ');
        const platformIndex = Number(platformNo_) - 1;
        
        const matchingStations_ = diagram.stations.filter(s => s.name === baseName);
        if (matchingStations_.length !== 1) throw new Error('matchingStation.length');
        const matchingStation = matchingStations_[0];

        station.stationId = stationIdMap.get(getStationIdMapKey(matchingStation.stationId, matchingStation.platforms[platformIndex].platformId))!;
        if (!station.stationId) throw new Error('!station.stationId');
      }
    })
  }

  trainMove.mode = 'TimetableMode';
  const original = min(diagram.trains.map(t => t.trainTimetable.map(tt => tt.arrivalTime)).flat());
  trainMove.globalTime = moduloRoundDown(original, 10 /* this.globalTimeSpeed */);

  intervalId = setInterval(() => mainLoop(trainMove!, diagram), 100);

  return (newInterval: number | undefined) => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      return false;
    } else {
      intervalId = setInterval(() => mainLoop(trainMove!, diagram), newInterval ?? 100);
      return true;
    }
  }
}

export async function initialize() {
  // drawDiagram_();
  // initialize();

  // fetch('./narasen_dia.oud2').then(x => x.text()).then(data => {
  //   const r = getEkiJikokus(data);
  //   drawTimetable(r);
  // })

  const trainMove = await svgLoaderMain();

  const fileSelector = document.getElementById('file-selector')!;
  fileSelector.addEventListener('change', async (event) => {
    const diagram = await onFileSelectorChange(event);
    if (diagram != null) {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }

      const interrupt = initializeTrainMove(diagram, trainMove);

      document.getElementById('button-slow-speed')!.onclick = (ev) => {
        interrupt(undefined);
      };

      document.getElementById('button-slow-speed-2')!.onclick = (ev) => {
        if ((ev.target as HTMLButtonElement).value !== 'slow') {
          interrupt(undefined);
          interrupt(10);
          (ev.target as HTMLButtonElement).value = 'slow';
        } else {
          interrupt(undefined);
          interrupt(100);
          (ev.target as HTMLButtonElement).value = 'fast';
        }
      }
    }
  });
}
