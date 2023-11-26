import Konva from 'konva';
import { assert } from '../../common';
import { DiaTime, StationLike, TimetableDirection } from '../../model';
import { DragRectKonva } from './drag-rect-konva';
import { DiagramProps, StationPosition } from './drawer-util';
import { MouseEventManager } from './mouse-event-manager';
import { SelectionGroupManager } from './selection-group-manager';
import { getPlatformPositions } from './station-view-konva';

export const canvasHeight = 600;
export const canvasWidth = 600; // dummy width (will be set by initializeKonva)
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

export function createPositionDiaTimeMap(
  diaTimes: DiaTime[],
  viewStateManager: ViewStateManager,
  direction: TimetableDirection
): { diaTime: DiaTime; type: 'arrivalTime' | 'departureTime'; x: number; y: number }[] {
  const create = (diaTime: DiaTime, type: 'arrivalTime' | 'departureTime', x: number, y: number) => ({
    diaTime,
    type,
    x,
    y,
  });

  const secondWidth = viewStateManager.getSecondWidth();
  const stationPositions = viewStateManager.getStationPositions();

  const positionDiaTimeMap = diaTimes.flatMap((diaTime) => {
    const stationPosition = stationPositions.find((station) => station.station.stationId === diaTime.station.stationId);
    if (!stationPosition) {
      throw new Error(`station ${diaTime.station.stationId} not found`);
    }

    const isStationExpanded = viewStateManager.isStationExpanded(diaTime.station.stationId);

    let [departureTime, arrivalTime] = [diaTime.departureTime, diaTime.arrivalTime];
    if (departureTime === null && arrivalTime === null) return [];

    if (departureTime === null) departureTime = arrivalTime;
    if (arrivalTime === null) arrivalTime = departureTime;
    assert(departureTime !== null && arrivalTime !== null);

    const stationY = stationPosition.diagramPosition;

    if (isStationExpanded) {
      const platformIndex = diaTime.station.platforms.findIndex((p) => p.platformId === diaTime.platform?.platformId);
      if (platformIndex !== -1) {
        const [platformPositions, lastLinePosition] = getPlatformPositions(diaTime.station.platforms);
        const platformPosition = platformPositions[platformIndex];
        assert(platformPosition !== undefined);
        const lastPosition = platformPositions[platformPositions.length - 1];

        if (direction === 'Inbound') {
          return [
            create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY),
            create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY + platformPosition),
            create(diaTime, 'departureTime', departureTime * secondWidth, stationY + platformPosition),
            create(diaTime, 'departureTime', departureTime * secondWidth, stationY + lastLinePosition),
          ];
        } else {
          return [
            create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY + lastLinePosition),
            create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY + platformPosition),
            create(diaTime, 'departureTime', departureTime * secondWidth, stationY + platformPosition),
            create(diaTime, 'departureTime', departureTime * secondWidth, stationY),
          ];
        }
      }
    }

    return [
      create(diaTime, 'arrivalTime', arrivalTime * secondWidth, stationY),
      create(diaTime, 'departureTime', departureTime * secondWidth, stationY),
    ];
  });

  return positionDiaTimeMap;
}

export class ViewStateManager {
  private stationPositions: ReadonlyArray<StationPosition>;
  private readonly isStationExpandedMap: Map<string, boolean>;
  private readonly secondWidth: number;

  constructor(stations: StationLike[]) {
    const secondWidth = virtualCanvasWidth / 24 / 60 / 60;
    const stationPositions = this.createStationPositions(stations);

    this.stationPositions = stationPositions;
    this.secondWidth = secondWidth;

    this.isStationExpandedMap = new Map();
    for (const stationPosition of stationPositions) {
      this.isStationExpandedMap.set(stationPosition.station.stationId, false);
    }
  }

  private createStationPositions(stations: StationLike[]): StationPosition[] {
    let position = 50;

    const stationPositions: StationPosition[] = [];
    for (const station of stations) {
      stationPositions.push({ station, diagramPosition: position });
      position += 50;
      if (this.isStationExpandedMap && this.isStationExpandedMap.get(station.stationId)) {
        position += 30 * station.platforms.length + 20;
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
    const stationPosition = this.stationPositions.find(
      (stationPosition) => stationPosition.station.stationId === stationId
    );
    if (stationPosition == null) return null;

    return stationPosition.diagramPosition;
  }

  setStationIsExpanded(stationId: string, isExpanded: boolean) {
    this.isStationExpandedMap.set(stationId, isExpanded);
    this.stationPositions = this.createStationPositions(this.stationPositions.map((s) => s.station));
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

export class DiagramKonvaContext {
  constructor(
    public diagramProps: DiagramProps,
    public viewStateManager: ViewStateManager,
    public dragRectKonva: DragRectKonva,
    public topLayer: Konva.Layer,
    public selectionGroupManager: SelectionGroupManager,
    public mouseEventManager: MouseEventManager
  ) {}
}

export function generateKonvaId() {
  return Date.now() + '_' + Math.random().toString(36).slice(-8);
}
