import { assert } from '../../common';
import { DiaTime, StationLike, Train, generateId, getDefaultConnectionType } from '../../model';
import { fillMissingTimes, getFirstOrLast, getRailwayPlatform } from '../timetable-editor/timetable-util';
import { DiagramKonvaContext, RectState } from './konva-util';
import { TrainKonva } from './train-konva';

export class TrainCollectionKonva {
  private trainKonvas: Map<string, TrainKonva> = new Map();

  constructor(private context: DiagramKonvaContext) {
    // グリッドの後に描画するために、updateShapeは後で呼ぶ想定
  }

  updateShape() {
    const notUsedTrainIds = new Set<string>(this.trainKonvas.keys());
    const bothTrains = this.context.diagramProps.inboundTrains.concat(this.context.diagramProps.outboundTrains);

    for (const train of bothTrains) {
      let trainKonva = this.trainKonvas.get(train.trainId);
      if (trainKonva == null) {
        trainKonva = new TrainKonva(this.context, train);
        this.trainKonvas.set(train.trainId, trainKonva);
      }

      trainKonva.updateShape();

      notUsedTrainIds.delete(train.trainId);
    }

    for (const trainId of notUsedTrainIds) {
      const trainKonva = this.trainKonvas.get(trainId);
      assert(trainKonva != null);

      trainKonva.destroy();
      this.trainKonvas.delete(trainId);
    }
  }

  commitDrawingLine(drawingLineTimes: { station: StationLike; time: number }[]): Train | null {
    if (drawingLineTimes.length >= 2) {
      // 1番目のstationのindexと2番目のstationのindexを比較し、inbound / outboundを判定する
      const firstStationIndex = this.context.diagramProps.stations.findIndex(
        (station) => station.stationId === drawingLineTimes[0].station.stationId
      );
      const secondStationIndex = this.context.diagramProps.stations.findIndex(
        (station) => station.stationId === drawingLineTimes[1].station.stationId
      );
      const direction = firstStationIndex < secondStationIndex ? 'Inbound' : 'Outbound';
      const trains =
        direction === 'Inbound' ? this.context.diagramProps.inboundTrains : this.context.diagramProps.outboundTrains;

      const firstOrLast = getFirstOrLast(direction, this.context.diagramProps.timetable.inboundIsFirstHalf);
      const railwayLine = this.context.diagramProps.railwayLine;

      const diaTimes: DiaTime[] = drawingLineTimes.map((drawingLineTime, index) => {
        const platform = getRailwayPlatform(railwayLine, drawingLineTime.station.stationId, firstOrLast);
        const stop = railwayLine.stops.find((stop) => stop.platform.platformId === platform.platformId);
        assert(stop != null);
        return {
          station: drawingLineTime.station,
          departureTime: index < drawingLineTimes.length - 1 ? drawingLineTime.time : null,
          arrivalTime: index > 0 ? drawingLineTime.time : null,
          diaTimeId: generateId(),
          isPassing: false,
          platform: platform,
          isInService: true,
          railwayLine: railwayLine,
          trackId: stop.platformTrack.trackId,
        };
      });

      const newTrain: Train = {
        trainId: generateId(),
        trainName: '',
        trainType: undefined,
        diaTimes: diaTimes,
        trainCode: '',
        firstStationOperation: getDefaultConnectionType(),
        lastStationOperation: getDefaultConnectionType(),
      };

      fillMissingTimes(newTrain, this.context.diagramProps.stations);

      this.context.diagramProps.crudTrain.addTrain(newTrain, direction);
      this.updateShape();

      return trains[trains.length - 1];
    }

    return null;
  }

  private getOverlappedTrainLines(rect: RectState) {
    const overlappedTrainLines = [...this.trainKonvas.entries()]
      .filter(([_, trainKonva]) => trainKonva.areOverlapped(rect))
      .map(([_, trainKonva]) => trainKonva);
    return overlappedTrainLines;
  }

  addSelectedTrains(trains: Train[]) {
    const trainLines = [];
    for (const train of trains) {
      const trainKonva = this.trainKonvas.get(train.trainId);
      assert(trainKonva != null);

      trainLines.push(trainKonva);
    }
    this.context.selectionGroupManager.addTrainSelections(trainLines);
  }

  addSelectedTrainsWithinDragged() {
    const rect = this.context.dragRectKonva.getDragRect();
    if (rect != null) {
      const overlappedTrainLines = this.getOverlappedTrainLines(rect);

      const trainLines = [];
      for (const trainLine of overlappedTrainLines) {
        const trainId = trainLine.getTrain().trainId;
        const train = this.context.diagramProps.inboundTrains
          .concat(this.context.diagramProps.outboundTrains)
          .find((train) => train.trainId === trainId);
        if (train == null) continue;

        trainLines.push(trainLine);
      }

      this.context.selectionGroupManager.addTrainSelections(trainLines);
    }
  }
}
