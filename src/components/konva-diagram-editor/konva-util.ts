import Konva from 'konva';
import { DiaTime } from '../../model';
import { DragRectKonva } from './drag-rect-konva';
import { DiagramProps, StationPosition } from './drawer-util';
import { SelectionGroupManager } from './selection-group-manager';

export const canvasHeight = 600;
export const canvasWidth = 600; // dummy width (will be set by initializeKonva)
export const virtualCanvasHeight = 2000;
export const virtualCanvasWidth = 10000;

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
  secondWidth: number,
  stationPositions: StationPosition[]
) {
  const positionDiaTimeMap = diaTimes.flatMap((diaTime) => {
    const stationPosition = stationPositions.find((station) => station.station.stationId === diaTime.station.stationId);
    if (!stationPosition) {
      throw new Error(`station ${diaTime.station.stationId} not found`);
    }

    if (diaTime.departureTime == null && diaTime.arrivalTime == null) {
      return [];
    } else if (diaTime.departureTime != null && diaTime.arrivalTime == null) {
      return [
        [diaTime, 'departureTime', [diaTime.departureTime * secondWidth, stationPosition.diagramPosition]] as const,
      ];
    } else if (diaTime.departureTime == null && diaTime.arrivalTime != null) {
      return [[diaTime, 'arrivalTime', [diaTime.arrivalTime * secondWidth, stationPosition.diagramPosition]] as const];
    } else {
      return [
        [diaTime, 'arrivalTime', [diaTime.arrivalTime! * secondWidth, stationPosition.diagramPosition]] as const,
        [diaTime, 'departureTime', [diaTime.departureTime! * secondWidth, stationPosition.diagramPosition]] as const,
      ];
    }
  });
  return positionDiaTimeMap;
}

export class ViewStateManager {
  private stationPositions: StationPosition[];
  private secondWidth: number;

  constructor(secondWidth: number, stationPositions: StationPosition[]) {
    this.stationPositions = stationPositions;
    this.secondWidth = secondWidth;
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
    public selectionGroupManager: SelectionGroupManager
  ) {}
}
