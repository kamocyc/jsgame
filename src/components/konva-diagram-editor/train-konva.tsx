import { Fragment } from 'react';
import { Line, Rect, Text } from 'react-konva';
import { useRecoilState, useRecoilValue } from 'recoil';
import { DeepReadonly, assert } from 'ts-essentials';
import { nn, toStringFromSeconds } from '../../common';
import { DiaTime, Point, StationLike, Train } from '../../model';
import { getDirection } from '../../outlinedTimetableData';
import { DiagramProps } from './drawer-util';
import { WarningKonva } from './hover-konva';
import {
  createPositionDiaTimeMap,
  getPositionFromTime,
  secondWidthAtom,
  selectedTrainIdsAtom,
  stageStateAtom,
  stationMapSelector,
  useViewStateValues,
} from './konva-util';
import { MouseEventManager } from './mouse-event-manager';
import { getPlatformPositions } from './station-view-konva';

function getKey(
  train: DeepReadonly<Train>,
  diaTime: DiaTime,
  timeType: 'arrivalTime' | 'departureTime',
  isPlatform: boolean
) {
  return `timeBox-${train.trainId}-${diaTime.diaTimeId}-${isPlatform ? 'platform' : 'station'}-${timeType}`;
}

export type TrainKonvaProps = DeepReadonly<{
  train: Train;
  diagramProps: DiagramProps;
  mouseEventManager: MouseEventManager;
}>;

export function TrainKonva(props: TrainKonvaProps) {
  const { train, diagramProps, mouseEventManager } = props;
  const secondWidth = useRecoilValue(secondWidthAtom);
  const selectedTrainIds = useRecoilValue(selectedTrainIdsAtom);
  const stageState = useRecoilValue(stageStateAtom);
  const viewState = useViewStateValues();
  const stationMap = useRecoilValue(stationMapSelector);
  const [, setSelectedTrainIds] = useRecoilState(selectedTrainIdsAtom);

  if (
    !diagramProps.timetable.inboundTrainIds.includes(train.trainId) &&
    !diagramProps.timetable.outboundTrainIds.includes(train.trainId)
  ) {
    return <></>;
  }

  const errors = diagramProps.errors;
  const scale = stageState.scale;
  const stationPositions = viewState.stationPositions;
  const direction = getDirection(diagramProps.timetable, train.trainId);
  const points = createPositionDiaTimeMap(stationMap, viewState, train.diaTimes, direction)
    .map(({ x, y }) => [x, y])
    .flat();

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
      {errors.map((error, i) => {
        const diaTime = train.diaTimes.find((diaTime) => diaTime.diaTimeId === error.diaTimeId);
        if (diaTime === undefined) return <></>;

        const time =
          error.arrivalOrDeparture === 'arrivalTime'
            ? diaTime?.arrivalTime
            : error.arrivalOrDeparture === 'departureTime'
            ? diaTime?.departureTime
            : diaTime?.arrivalTime ?? diaTime?.departureTime;

        const station = nn(stationMap.get(diaTime.stationId));

        const warningPosition =
          error != null && error.stationId != null && time !== null
            ? getTextLabelPosition(
                train,
                diaTime,
                station,
                time,
                error?.stationId,
                scale,
                error.arrivalOrDeparture ?? 'arrivalTime'
              )
            : null;

        if (warningPosition !== null) {
          return (
            <WarningKonva
              key={i}
              x={warningPosition.x + 40 / scale}
              y={warningPosition.y}
              message={error.type}
              scale={scale}
            />
          );
        } else {
          return <Fragment key={i}></Fragment>;
        }
      })}
      {isSelected ? (
        train.diaTimes.map((diaTime) => {
          return timeTypes.map((timeType) => {
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
            const station = nn(stationMap.get(diaTime.stationId));

            const [platformPositions, lastLinePosition] = getPlatformPositions(station.platforms);
            const isStationExpanded = viewState.isStationExpanded.get(diaTime.stationId) ?? false;

            const timeText = toStringFromSeconds(nn(time));
            const positionX = getPositionFromTime(nn(time), secondWidth);
            const positionY = nn(stationPositions.find((s) => s.stationId === diaTime.stationId)).diagramPosition;

            const { x: timeOffsetX, y: timeOffsetY } = getTextMakerPositionOffset(timeType, direction);

            const platformIndex = station.platforms.findIndex((p) => p.platformId === diaTime.platformId);
            assert(platformIndex !== -1);

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

            return (
              <Fragment key={'timeBox-' + diaTime.diaTimeId + '_' + timeType}>
                <Rect
                  id={getKey(train, diaTime, timeType, false)}
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
                  <Rect
                    id={getKey(train, diaTime, timeType, true)}
                    x={markerPosition.x}
                    y={positionY + platformPositions[platformIndex] - 5 / scale}
                    width={10 / scale}
                    height={10 / scale}
                    fill={'blue'}
                    stroke={'black'}
                    strokeWidth={0}
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
}
