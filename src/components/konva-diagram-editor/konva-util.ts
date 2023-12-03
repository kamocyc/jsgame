import Konva from 'konva';
import { atom, selector, useRecoilValue } from 'recoil';
import { DeepReadonly } from 'ts-essentials';
import { nn } from '../../common';
import { OperationError } from '../../mapEditorModel';
import { AppClipboard, DiaTime, StationLike, TimetableDirection, Train } from '../../model';
import { DiagramProps, StationPosition } from './drawer-util';
import { MouseEventManager } from './mouse-event-manager';
import { getPlatformPositions } from './station-view-konva';

export const canvasHeight = 600;
// export const canvasWidth = 600; // dummy width (will be set by initializeKonva)
export const virtualCanvasHeight = 2000;
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
  const stationPositions = useRecoilValue(stationPositionsAtom);
  const isStationExpanded = useRecoilValue(isStationExpandedAtom);
  return {
    secondWidth,
    stationPositions,
    isStationExpanded,
  };
}

export function createPositionDiaTimeMap(
  diagramProps: DiagramProps,
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
      const platforms = nn(diagramProps.stations.get(diaTime.stationId)).platforms;
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

export class ViewStateManager {
  private stationPositions: ReadonlyArray<StationPosition>;
  private readonly isStationExpandedMap: Map<string, boolean>;
  private readonly secondWidth: number;

  constructor(stationIds: DeepReadonly<string[]>, private stations: DeepReadonly<Map<string, StationLike>>) {
    const secondWidth = virtualCanvasWidth / 24 / 60 / 60;
    const stationPositions = this.createStationPositions(stationIds);

    this.stationPositions = stationPositions;
    this.secondWidth = secondWidth;

    this.isStationExpandedMap = new Map();
    for (const stationPosition of stationPositions) {
      this.isStationExpandedMap.set(stationPosition.stationId, false);
    }
  }

  private createStationPositions(stationIds: DeepReadonly<string[]>): StationPosition[] {
    let position = 50;

    const stationPositions: StationPosition[] = [];
    for (const stationId of stationIds) {
      stationPositions.push({ stationId: stationId, diagramPosition: position });
      position += 50;
      if (this.isStationExpandedMap && this.isStationExpandedMap.get(stationId)) {
        position += 30 * stationId.platforms.length + 20;
      }
    }

    return stationPositions;
  }

  getSecondWidth() {
    return this.secondWidth;
  }

  getStationPositions() {
    return this.stationPositions;
  }

  getStationPosition(stationId: string): number | null {
    const stationPosition = this.stationPositions.find((stationPosition) => stationPosition.stationId === stationId);
    if (stationPosition == null) return null;

    return stationPosition.diagramPosition;
  }

  setStationIsExpanded(stationId: string, isExpanded: boolean) {
    this.isStationExpandedMap.set(stationId, isExpanded);
    this.stationPositions = this.createStationPositions(this.stationPositions.map((s) => s.stationId));
  }

  isStationExpanded(stationId: string) {
    return this.isStationExpandedMap.get(stationId) ?? false;
  }

  getPositionFromTime(time: number): number {
    return time * this.secondWidth;
  }

  getPositionToTime(position: number) {
    return Math.round(position / this.secondWidth);
  }
}

export function getPositionFromTime(time: number, secondWidth: number): number {
  return time * secondWidth;
}

// export class DiagramKonvaContext {
//   constructor(
//     public diagramProps: DiagramProps,
//     public viewStateManager: ViewStateManager,
//     public dragRectKonva: DragRectKonva,
//     public topLayer: Konva.Layer,
//     public selectionGroupManager: SelectionGroupManager,
//     public mouseEventManager: MouseEventManager_
//   ) {}
// }

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
export const stationsAtom = atom<DeepReadonly<Map<string, StationLike>>>({
  key: 'stationsAtom',
  default: new Map(),
});
export const stationPositionsAtom = selector<DeepReadonly<StationPosition[]>>({
  key: 'stationPositionsAtom',
  get: ({ get }) => {
    const stationIds = get(stationIdsAtom);
    const stations = get(stationsAtom);
    const isStationExpanded = get(isStationExpandedAtom);

    let position = 50;

    const stationPositions: StationPosition[] = [];
    for (const stationId of stationIds) {
      stationPositions.push({ stationId: stationId, diagramPosition: position });
      position += 50;
      if (isStationExpanded.get(stationId)) {
        const station = nn(stations.get(stationId));
        position += 30 * station.platforms.length + 20;
      }
    }

    return stationPositions;
  },
});
export const selectedTrainIdsAtom = atom<DeepReadonly<string[]>>({
  key: 'selectedTrainIdsAtom',
  default: [],
});
// export type DiagramProps = DeepReadonly<{
//   stationIds: string[];
//   stations: Map<string, StationLike>;
//   crudTrain: CrudTrain;
//   inboundTrains: readonly Train[];
//   outboundTrains: readonly Train[];
//   timetable: OutlinedTimetable;
//   clipboard: AppClipboard;
//   railwayLine: RailwayLine;
//   errors: readonly OperationError[];
//   setClipboard: (clipboard: AppClipboard) => void;
//   getTrainsWithDirections: () => DeepReadonly<[Train[], Train[]]>;
// }>;
export const inboundTrainsAtom = atom<DeepReadonly<Train[]>>({
  key: 'inboundTrainsAtom',
  default: [],
});
export const outboundTrainsAtom = atom<DeepReadonly<Train[]>>({
  key: 'outboundTrainsAtom',
  default: [],
});
export const clipboard = atom<DeepReadonly<AppClipboard>>({
  key: 'clipboard',
  default: {
    trains: [],
    originalTrains: [],
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
export const drawingLineTimesAtom = atom<DeepReadonly<{ station: StationLike; time: number }[]>>({
  key: 'drawingLineTimesAtom',
  default: [],
});
export const tempDrawingLineTimeAtom = atom<DeepReadonly<{ station: StationLike; time: number } | null>>({
  key: 'tempDrawingLineTimeAtom',
  default: null,
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
  default: 200,
});

let mouseEventManager: MouseEventManager | null = null;

export const getMouseEventManager = () => {
  if (mouseEventManager === null) {
    mouseEventManager = new MouseEventManager();
  }

  return mouseEventManager;
};
