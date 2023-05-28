import { getStationIdMapKey, min, moduloRoundDown } from "./common.js";
import { draw } from "./drawer.js";
import { generateLines, prepare } from "./generateLine.js";
import { Diagram, Train } from "./model.js";
// import { drawTimetable } from "./timetableEditor.js";
import { TrainMove } from "./trainMove.js";

function mainLoop(trainMove: TrainMove, diagram: Diagram) {
  trainMove.addTrainFromDiagramAndTime(diagram)
  trainMove.main();

  draw(trainMove, null, null);
}

export function initializeTrainMove(diagram: Diagram, trainMove?: TrainMove) {
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

  let intervalId: number | null = setInterval(() => mainLoop(trainMove!, diagram), 100);

  return (newInterval: number | undefined, restart: boolean) => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      return false;
    } else {
      if (restart) { 
        intervalId = setInterval(() => mainLoop(trainMove!, diagram), newInterval ?? 100);
      }
      return true;
    }
  }
}
