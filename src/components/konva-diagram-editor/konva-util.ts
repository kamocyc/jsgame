import Konva from 'konva';
import { atom, selector, selectorFamily, useRecoilValue } from 'recoil';
import { DeepReadonly, assert } from 'ts-essentials';
import { nn } from '../../common';
import { OperationError } from '../../mapEditorModel';
import { AppClipboard, DiaTime, StationLike, TimetableDirection, Train } from '../../model';
import { getStationMap } from '../timetable-editor/common-component';
import { StationPosition } from './drawer-util';
import { MouseEventManager } from './mouse-event-manager';
import { getPlatformPositions } from './station-view-konva';

export const canvasHeight = 400;
export const virtualCanvasWidth = 10000;

// 青系統の薄めの色
export const gridColor = '#53a7d0';

export interface RectState {
  x: number;
  y: number;
  height: number;
  width: number;
}

export function getPointerPosition(stage: Konva.Stage) {
  const vec = stage.getPointerPosition()!;
  return { x: (vec.x - stage.x()) / stage.scaleX(), y: (vec.y - stage.y()) / stage.scaleY() };
}

export function useViewStateValues(): DeepReadonly<ViewState> {
  const secondWidth = useRecoilValue(secondWidthAtom);
  const stationPositions = useRecoilValue(stationPositionsAtom).stationPositions;
  const isStationExpanded = useRecoilValue(isStationExpandedAtom);
  return {
    secondWidth,
    stationPositions,
    isStationExpanded,
  };
}

export function createPositionDiaTimeMap(
  stationMap: DeepReadonly<Map<string, StationLike>>,
  {
    secondWidth,
    stationPositions,
    isStationExpanded: isStationExpandedMap,
  }: DeepReadonly<{
    secondWidth: number;
    stationPositions: StationPosition[];
    isStationExpanded: Map<string, boolean>;
  }>,
  diaTimes: DeepReadonly<DiaTime[]>,
  direction: TimetableDirection
): { diaTime: DiaTime; type: 'arrivalTime' | 'departureTime'; x: number; y: number }[] {
  const create = (diaTime: DiaTime, type: 'arrivalTime' | 'departureTime', x: number, y: number) => ({
    diaTime,
    type,
    x,
    y,
  });

  const positionDiaTimeMap = diaTimes.flatMap((diaTime, diaTimeIndex) => {
    const stationPosition = stationPositions.find((station) => station.stationId === diaTime.stationId);
    if (!stationPosition) {
      throw new Error(`station ${diaTime.stationId} not found`);
    }

    const isStationExpanded = isStationExpandedMap.get(diaTime.stationId) ?? false;

    let [arrivalTime, departureTime] = [diaTime.arrivalTime, diaTime.departureTime];
    if (arrivalTime === null && departureTime === null) return [];

    const stationY = stationPosition.diagramPosition;

    const times = [];
    if (isStationExpanded) {
      const platforms = nn(stationMap.get(diaTime.stationId)).platforms;
      const platformIndex = platforms.findIndex((p) => p.platformId === diaTime.platformId);
      if (platformIndex !== -1) {
        const [platformPositions, lastLinePosition] = getPlatformPositions(platforms);
        const platformPosition = platformPositions[platformIndex];
        if (direction === 'Inbound') {
          if (diaTimeIndex > 0) {
            times.push(create(diaTime, 'arrivalTime', nn(arrivalTime ?? departureTime) * secondWidth, stationY));
          }

          if (arrivalTime !== null) {
            times.push(create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY + platformPosition));
          }
          if (departureTime !== null) {
            times.push(create(diaTime, 'departureTime', departureTime * secondWidth, stationY + platformPosition));
          }

          if (diaTimeIndex < diaTimes.length - 1) {
            times.push(
              create(
                diaTime,
                'departureTime',
                nn(departureTime ?? arrivalTime) * secondWidth,
                stationY + lastLinePosition
              )
            );
          }
        } else {
          if (diaTimeIndex > 0) {
            times.push(
              create(
                diaTime,
                'arrivalTime',
                nn(arrivalTime ?? departureTime) * secondWidth,
                stationY + lastLinePosition
              )
            );
          }

          if (arrivalTime !== null) {
            times.push(create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY + platformPosition));
          }

          if (departureTime !== null) {
            times.push(create(diaTime, 'departureTime', departureTime * secondWidth, stationY + platformPosition));
          }

          if (diaTimeIndex < diaTimes.length - 1) {
            times.push(create(diaTime, 'departureTime', nn(departureTime ?? arrivalTime) * secondWidth, stationY));
          }
        }
      } else {
        if (arrivalTime !== null) {
          times.push(create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY));
        }
        if (departureTime !== null) {
          times.push(create(diaTime, 'departureTime', departureTime * secondWidth, stationY));
        }
      }
    } else {
      if (arrivalTime !== null) {
        times.push(create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY));
      }
      if (departureTime !== null) {
        times.push(create(diaTime, 'departureTime', departureTime * secondWidth, stationY));
      }
    }

    return times;
  });

  return positionDiaTimeMap;
}

export function getPositionFromTime(time: number, secondWidth: number): number {
  return time * secondWidth;
}

export function generateKonvaId() {
  return Date.now() + '_' + Math.random().toString(36).slice(-8);
}

export type ViewState = DeepReadonly<{
  secondWidth: number;
  stationPositions: StationPosition[];
  isStationExpanded: Map<string, boolean>;
}>;

export const isStationExpandedAtom = atom<DeepReadonly<Map<string, boolean>>>({
  key: 'isStationExpandedAtom',
  default: new Map<string, boolean>(),
});
export const secondWidthAtom = atom<number>({
  key: 'secondWidthAtom',
  default: virtualCanvasWidth / 24 / 60 / 60,
});
export const stationIdsAtom = atom<DeepReadonly<string[]>>({
  key: 'stationIdsAtom',
  default: [],
});
export const stationsAtom = atom<DeepReadonly<StationLike[]>>({
  key: 'stationsAtom',
  default: [],
});
export const stationMapSelector = selector<DeepReadonly<Map<string, StationLike>>>({
  key: 'stationMapSelector',
  get: ({ get }) => {
    const stations = get(stationsAtom);
    return getStationMap(stations);
  },
});

export const stationPositionsAtom = selector<
  DeepReadonly<{ stationPositions: StationPosition[]; lastPosition: number }>
>({
  key: 'stationPositionsAtom',
  get: ({ get }) => {
    const stationIds = get(stationIdsAtom);
    const stationMap = get(stationMapSelector);
    const isStationExpanded = get(isStationExpandedAtom);

    let position = 50;

    const stationPositions: StationPosition[] = [];
    for (const stationId of stationIds) {
      stationPositions.push({ stationId: stationId, diagramPosition: position });
      position += 50;
      if (isStationExpanded.get(stationId)) {
        const station = nn(stationMap.get(stationId));
        position += 30 * station.platforms.length + 20;
      }
    }

    return { stationPositions, lastPosition: position };
  },
});
export const selectedTrainIdsAtom = atom<DeepReadonly<string[]>>({
  key: 'selectedTrainIdsAtom',
  default: [],
});

export const allTrainsMapAtom = atom<DeepReadonly<Map<string, Train>>>({
  key: 'allTrainsMapAtom',
  default: new Map(),
});
export const clipboard = atom<DeepReadonly<AppClipboard>>({
  key: 'clipboard',
  default: {
    trains: [],
    originalTrainIds: [],
  },
});

// export const timetableAtom = atom<DeepReadonly<OutlinedTimetable>>({
//   key: 'timetableAtom',
//   default: {

//   },
// });
// export const railwayLineAtom = atom<DeepReadonly<RailwayLine>>({
//   key: 'railwayLineAtom',
//   default: {
//     railwayLineId: '',
//     railwayLineName: '',
//     stations: [],
//     color: '',
//   },
// });
export const errorsAtom = atom<DeepReadonly<OperationError[]>>({
  key: 'errorsAtom',
  default: [],
});

export type DrawingTrainLine = DeepReadonly<{
  drawingLineTimes: { stationId: string; platformId: string; time: number }[];
  tempDrawingLineTime: { stationId: string; platformId: string; time: number } | null;
  isDrawing: boolean;
}>;
export const drawingTrainLineAtom = atom<DrawingTrainLine>({
  key: 'drawingTrainLineAtom',
  default: {
    drawingLineTimes: [],
    tempDrawingLineTime: null,
    isDrawing: false,
  },
});

export interface DiagramStageState {
  x: number;
  y: number;
  scale: number;
  height: number;
  width: number;
}

export const stageStateAtom = atom<DeepReadonly<DiagramStageState>>({
  key: 'stageStateAtom',
  default: {
    x: 0,
    y: 0,
    scale: 1,
    height: canvasHeight,
    width: 0,
  },
});

export const stationCanvasWidthAtom = atom<number>({
  key: 'stationCanvasWidthAtom',
  default: 100,
});

let mouseEventManager: MouseEventManager | null = null;

export const getMouseEventManager = () => {
  if (mouseEventManager === null) {
    mouseEventManager = new MouseEventManager();
  }

  return mouseEventManager;
};

export const trainSelectorFamily = selectorFamily<DeepReadonly<Train>, string>({
  key: 'trainAtomFamily',
  get:
    (trainId) =>
    ({ get }) => {
      const train = get(allTrainsMapAtom).get(trainId);
      assert(train != null, 'train not found: ' + trainId);
      return train;
    },
});

export const virtualCanvasHeightSelector = selector<number>({
  key: 'virtualCanvasHeightSelector',
  get: ({ get }) => {
    const lastPosition = get(stationPositionsAtom).lastPosition;
    return lastPosition;
  },
});

export function getPositionToTime(position: number, secondWidth: number): number {
  return Math.round(position / secondWidth);
}

export const mouseState = {
  isMouseDown: false,
};
