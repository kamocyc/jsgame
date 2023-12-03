import { Fragment, forwardRef } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import { useRecoilState, useRecoilValue } from 'recoil';
import { DeepReadonly, assert } from 'ts-essentials';
import { nn, toStringFromSeconds } from '../../common';
import { DiaTime, Point, StationLike, Train } from '../../model';
import { getDirection } from '../../outlinedTimetableData';
import { DiagramProps } from './drawer-util';
import {
  createPositionDiaTimeMap,
  getPositionFromTime,
  secondWidthAtom,
  selectedTrainIdsAtom,
  stageStateAtom,
  useViewStateValues,
} from './konva-util';
import { MouseEventManager } from './mouse-event-manager';
import { getPlatformPositions } from './station-view-konva';

// export class TrainCollectionKonva_Fucntions {
//   commitDrawingLine(drawingLineTimes: { station: StationLike; time: number }[]): Train | null {
//     if (drawingLineTimes.length >= 2) {
//       // 1番目のstationのindexと2番目のstationのindexを比較し、inbound / outboundを判定する
//       const firstStationIndex = this.context.diagramProps.stations.findIndex(
//         (station) => station.stationId === drawingLineTimes[0].station.stationId
//       );
//       const secondStationIndex = this.context.diagramProps.stations.findIndex(
//         (station) => station.stationId === drawingLineTimes[1].station.stationId
//       );
//       const direction = firstStationIndex < secondStationIndex ? 'Inbound' : 'Outbound';
//       const trains =
//         direction === 'Inbound' ? this.context.diagramProps.inboundTrains : this.context.diagramProps.outboundTrains;

//       const firstOrLast = getFirstOrLast(direction, this.context.diagramProps.timetable.inboundIsFirstHalf);
//       const railwayLine = this.context.diagramProps.railwayLine;

//       const diaTimes: DiaTime[] = drawingLineTimes.map((drawingLineTime, index) => {
//         const platform = getRailwayPlatform(railwayLine, drawingLineTime.station.stationId, firstOrLast);
//         const stop = railwayLine.stops.find((stop) => stop.platform.platformId === platform.platformId);
//         assert(stop != null);
//         return {
//           station: drawingLineTime.station,
//           departureTime: index < drawingLineTimes.length - 1 ? drawingLineTime.time : null,
//           arrivalTime: index > 0 ? drawingLineTime.time : null,
//           diaTimeId: generateId(),
//           isPassing: false,
//           platform: platform,
//           isInService: true,
//           railwayLine: railwayLine,
//           trackId: stop.platformTrack.trackId,
//         };
//       });

//       const newTrain: Train = {
//         trainId: generateId(),
//         trainName: '',
//         trainType: undefined,
//         diaTimes: diaTimes,
//         trainCode: '',
//         firstStationOperation: getDefaultConnectionType(),
//         lastStationOperation: getDefaultConnectionType(),
//       };

//       fillMissingTimes(newTrain, this.context.diagramProps.stations);

//       this.context.diagramProps.crudTrain.addTrain(newTrain, direction);
//       this.updateShape();

//       return trains[trains.length - 1];
//     }

//     return null;
//   }

//   private getOverlappedTrainLines(rect: RectState) {
//     const overlappedTrainLines = [...this.trainKonvas.entries()]
//       .filter(([_, trainKonva]) => trainKonva.areOverlapped(rect))
//       .map(([_, trainKonva]) => trainKonva);
//     return overlappedTrainLines;
//   }

//   addSelectedTrains(trains: Train[]) {
//     const trainLines = [];
//     for (const train of trains) {
//       const trainKonva = this.trainKonvas.get(train.trainId);
//       assert(trainKonva != null);

//       trainLines.push(trainKonva);
//     }
//     this.context.selectionGroupManager.addTrainSelections(trainLines);
//   }

//   addSelectedTrainsWithinDragged() {
//     const rect = this.context.dragRectKonva.getDragRect();
//     if (rect != null) {
//       const overlappedTrainLines = this.getOverlappedTrainLines(rect);

//       const trainLines = [];
//       for (const trainLine of overlappedTrainLines) {
//         const trainId = trainLine.getTrain().trainId;
//         const train = this.context.diagramProps.inboundTrains
//           .concat(this.context.diagramProps.outboundTrains)
//           .find((train) => train.trainId === trainId);
//         if (train == null) continue;

//         trainLines.push(trainLine);
//       }

//       this.context.selectionGroupManager.addTrainSelections(trainLines);
//     }
//   }
// }

// export function areOverlapped(points: number[], rect: RectState) {
//   // rectの頂点の配列
//   const width = rect.width !== 0 ? rect.width : 0.001;
//   const height = rect.height !== 0 ? rect.height : 0.001;

//   const rectPoints = [
//     { x: rect.x, y: rect.y },
//     { x: rect.x + width, y: rect.y },
//     { x: rect.x + width, y: rect.y + height },
//     { x: rect.x, y: rect.y + height },
//   ];
//   const rectPolygon = new Polygon(rectPoints);

//   const segments = [];
//   let previousPoint = { x: points[0], y: points[1] };
//   for (let i = 2; i < points.length; i += 2) {
//     const currentPoint = { x: points[i], y: points[i + 1] };
//     segments.push([previousPoint, currentPoint]);
//     previousPoint = currentPoint;
//   }

//   for (const segment of segments) {
//     const overlapped = sat(rectPolygon, new Polygon(segment));
//     if (overlapped) {
//       return true;
//     }
//   }

//   return false;
// }

export type TrainKonvaProps = DeepReadonly<{
  train: Train;
  diagramProps: DiagramProps;
  mouseEventManager: MouseEventManager;
}>;

export const TrainKonva = forwardRef(function TrainKonva(props: TrainKonvaProps, ref: any) {
  const { train, diagramProps, mouseEventManager } = props;
  const secondWidth = useRecoilValue(secondWidthAtom);
  const selectedTrainIds = useRecoilValue(selectedTrainIdsAtom);
  const stageState = useRecoilValue(stageStateAtom);
  const errors = diagramProps.errors;
  const scale = stageState.scale;
  const viewState = useViewStateValues();
  const stationPositions = viewState.stationPositions;
  const direction = getDirection(diagramProps.timetable, train.trainId);
  const points = createPositionDiaTimeMap(diagramProps, viewState, train.diaTimes, direction)
    .map(({ x, y }) => [x, y])
    .flat();
  const [, setSelectedTrainIds] = useRecoilState(selectedTrainIdsAtom);

  const isSelected = selectedTrainIds.includes(train.trainId);
  const strokeColor = isSelected ? 'red' : train.trainType?.trainTypeColor ?? '#5a5a5a';
  const id = 'trainLine-' + train.trainId;

  mouseEventManager.registerClickHandler(id, (e) => {
    if (e.evt.ctrlKey) {
      setSelectedTrainIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(train.trainId);
        return Array.from(newSet);
      });
    } else {
      setSelectedTrainIds([train.trainId]);
    }
  });

  const getTextMakerPositionOffset = (
    timeType: 'arrivalTime' | 'departureTime',
    direction: 'Inbound' | 'Outbound'
  ): Point => {
    if (timeType === 'arrivalTime') {
      if (direction === 'Inbound') {
        return { x: -15, y: -22 };
      } else {
        return { x: -15, y: 5 };
      }
    } else {
      if (direction === 'Inbound') {
        return { x: 0, y: 5 };
      } else {
        return { x: 0, y: -22 };
      }
    }
  };

  const getTextLabelPosition = (
    train: DeepReadonly<Train>,
    diaTime: DeepReadonly<DiaTime>,
    station: DeepReadonly<StationLike>,
    time: number,
    stationId: string,
    scale: number,
    timeType: 'departureTime' | 'arrivalTime'
  ) => {
    const direction = getDirection(diagramProps.timetable, train.trainId);

    const [_platformPositions, lastLinePosition] = getPlatformPositions(station.platforms);
    const isStationExpanded = viewState.isStationExpanded.get(diaTime.stationId);

    const positionX = getPositionFromTime(nn(time), secondWidth);
    const positionY = nn(stationPositions.find((s) => s.stationId === stationId)).diagramPosition;

    const { x: timeOffsetX, y: timeOffsetY } = getTextMakerPositionOffset(timeType, direction);

    const y =
      isStationExpanded &&
      ((direction === 'Outbound' && timeType === 'arrivalTime') ||
        (direction === 'Inbound' && timeType === 'departureTime'))
        ? positionY + lastLinePosition + timeOffsetY / scale
        : positionY + timeOffsetY / scale;

    const x = positionX - ((20 / 2) * 4) / scale + timeOffsetX / scale;

    return { x, y };
  };

  const timeTypes = ['arrivalTime', 'departureTime'] as const;

  return (
    <>
      <Line points={points} stroke={strokeColor} strokeWidth={1} hitStrokeWidth={10} name='trainLine' id={id} />
      {isSelected ? (
        train.diaTimes.map((diaTime) => {
          timeTypes.map((timeType) => {
            mouseEventManager.registerDragStartHandler(this.selectionGroup.id(), this.onDragStart.bind(this));
            mouseEventManager.registerDragMoveHandler(this.selectionGroup.id(), this.onDragMove.bind(this));
            mouseEventManager.registerDragEndHandler(this.selectionGroup.id(), this.onDragEnd.bind(this));
            //   const square = new Konva.Rect({
            //     fill: 'blue',
            //     stroke: 'black',
            //     strokeWidth: 0,
            //     // id: getKey(train, diaTime, timeType, false),
            //   });
            //   // this.mouseEventManager.registerDragStartHandler(square.id(), this.onDragStart.bind(this));
            //   // this.mouseEventManager.registerDragMoveHandler(square.id(), this.onDragMove.bind(this));
            //   // this.mouseEventManager.registerDragEndHandler(square.id(), this.onDragEnd.bind(this));
            //   // this.mouseEventManager.registerClickHandler(square.id(), this.onClickTimeMarker.bind(this));

            const time =
              timeType === 'arrivalTime'
                ? diaTime?.arrivalTime
                : timeType === 'departureTime'
                ? diaTime?.departureTime
                : null;
            if (time === null) {
              return <></>;
            }

            const direction = getDirection(diagramProps.timetable, train.trainId);
            const station = nn(diagramProps.stations.get(diaTime.stationId));

            const [platformPositions, lastLinePosition] = getPlatformPositions(station.platforms);
            const isStationExpanded = viewState.isStationExpanded.get(diaTime.stationId) ?? false;

            const timeText = toStringFromSeconds(nn(time));
            const positionX = getPositionFromTime(nn(time), secondWidth);
            const positionY = nn(stationPositions.find((s) => s.stationId === diaTime.stationId)).diagramPosition;

            const { x: timeOffsetX, y: timeOffsetY } = getTextMakerPositionOffset(timeType, direction);

            let markerPosition = { x: 0, y: 0 };
            let timePosition = { x: 0, y: 0 };

            timePosition.x = positionX - ((20 / 2) * timeText.length) / scale + timeOffsetX / scale;
            markerPosition.x = positionX - 5 / scale;
            if (
              isStationExpanded &&
              ((direction === 'Outbound' && timeType === 'arrivalTime') ||
                (direction === 'Inbound' && timeType === 'departureTime'))
            ) {
              markerPosition.y = positionY + lastLinePosition - 5 / scale;
              timePosition.y = positionY + lastLinePosition + timeOffsetY / scale;
            } else {
              markerPosition.y = positionY - 5 / scale;
              timePosition.y = positionY + timeOffsetY / scale;
            }

            const error = errors.find(
              (error) => error.diaTimeId === diaTime.diaTimeId && error.arrivalOrDeparture === timeType
            );
            const warningPosition =
              error != null && error.stationId != null && error.arrivalOrDeparture != null
                ? getTextLabelPosition(train, diaTime, station, time, error?.stationId, scale, error.arrivalOrDeparture)
                : null;

            const platformIndex = station.platforms.findIndex((p) => p.platformId === diaTime.platformId);
            assert(platformIndex !== -1);

            return (
              <Fragment key={diaTime.diaTimeId + '_' + timeType}>
                <Rect
                  id={'station-marker-' + diaTime.diaTimeId + '-' + timeType}
                  width={10 / scale}
                  height={10 / scale}
                  fill={'blue'}
                  stroke={'black'}
                  strokeWidth={0}
                  x={markerPosition.x}
                  y={markerPosition.y}
                />
                <Text
                  x={timePosition.x}
                  y={timePosition.y}
                  fontSize={20 / scale}
                  text={toStringFromSeconds(nn(time))}
                  fill={'black'}
                  hitFunc={() => {}}
                />
                {isStationExpanded ? (
                  <Text
                    x={positionX - 5 / scale}
                    y={positionY + platformPositions[platformIndex] - 5 / scale}
                    width={10 / scale}
                    height={10 / scale}
                  />
                ) : (
                  <></>
                )}
                {error && warningPosition ? (
                  <Text
                    fill={'#ff9000'}
                    hitFunc={() => {}}
                    text={error.type}
                    x={warningPosition.x + 40 / scale}
                    y={warningPosition.y}
                  />
                ) : (
                  <></>
                )}
              </Fragment>
            );
          });
        })
      ) : (
        <></>
      )}
    </>
  );
});

export type TrainCollectionKonvaProps = DeepReadonly<{
  diagramProps: DiagramProps;
  mouseEventManager: MouseEventManager;
}>;

export const TrainCollectionKonva = forwardRef(function TrainCollectionKonva(
  props: TrainCollectionKonvaProps,
  ref: any
) {
  const { diagramProps, mouseEventManager } = props;
  const bothTrains = diagramProps.inboundTrains.concat(diagramProps.outboundTrains);
  return (
    <Group>
      {bothTrains.map((train) => (
        <TrainKonva
          key={train.trainId}
          mouseEventManager={mouseEventManager}
          diagramProps={diagramProps}
          train={train}
        />
      ))}
    </Group>
  );
});
