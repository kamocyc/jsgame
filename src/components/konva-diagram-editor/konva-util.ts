import Konva from 'konva';
import { toStringFromSeconds } from '../../common';
import { DiaTime, Point, Train } from '../../model';
import { DragRectKonva } from './drag-rect-konva';
import { DiagramProps, StationPosition } from './drawer-util';
import { TrainKonva } from './train-konva';

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

export class SelectionGroupManager {
  private dragStartPoint: Point | null = null;
  private currentPosition: Point | null = null;
  private selections: TrainKonva[] = [];
  // private selectionGroup: Konva.Group;

  constructor(
    private layer: Konva.Layer,
    private viewStateManager: ViewStateManager,
    private dragRectKonva: DragRectKonva
  ) {
    // this.selectionGroup = new Konva.Group({
    //   draggable: true,
    // });
    // this.selectionGroup.on('mousemove', this.onDragMove.bind(this));
    // this.layer.add(this.selectionGroup);
  }

  getSelections() {
    return this.selections;
  }

  setDragStartPoint(point: { x: number; y: number }) {
    this.dragStartPoint = {
      x: point.x,
      y: point.y,
    };
  }

  isDragging() {
    return this.dragStartPoint != null;
  }

  setDraggingPoint(point: { x: number; y: number }) {
    if (this.dragStartPoint == null) return;

    const x = Math.round(point.x / this.viewStateManager.getSecondWidth()) * this.viewStateManager.getSecondWidth();
    this.currentPosition = {
      x,
      y: 0,
    };

    for (const selection of this.selections) {
      this.processTrainDragMove(selection);
    }
  }

  // 列車線をドラッグしたときの処理
  processTrainDragMove(trainSelection: TrainKonva) {
    const [secondWidth, stationPositions] = [
      this.viewStateManager.getSecondWidth(),
      this.viewStateManager.getStationPositions(),
    ];

    const train = trainSelection.getTrain();
    const positionDiaTimeMap = createPositionDiaTimeMap(train.diaTimes, secondWidth, stationPositions);
    const timeOffset = (this.currentPosition!.x - this.dragStartPoint!.x) / secondWidth;

    // const offsetX = shape.x() + this.selectionGroup.x();
    // let diaTimeIndex = 0;
    for (const [diaTime_, timeType, _] of positionDiaTimeMap) {
      const diaTime = train.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTime_.diaTimeId)!;

      if (timeType === 'arrivalTime') {
        const time = diaTime.arrivalTime + timeOffset;
        diaTime.arrivalTime = time;
      }
      if (timeType === 'departureTime') {
        const time = diaTime.departureTime + timeOffset;
        diaTime.departureTime = time;
      }

      const timeLabel = this.layer.findOne(`#timeLabel-${diaTime.diaTimeId}-${timeType}`) as Konva.Text;
      timeLabel.text(toStringFromSeconds(time));
      // timeLabel.x(shape.points()[diaTimeIndex] + offsetX - 5);

      // const timePoint = layer.findOne(`#timePoint-${diaTime.diaTimeId}-${timeType}`) as Konva.Rect;
      // timePoint.x(shape.points()[diaTimeIndex] + offsetX - 5);

      diaTimeIndex += 2;
    }

    updateTrains(layer, [train]);
  }

  onDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    const prevSelections = [...this.selections];
    this.destroySelections();
    const offsetX = this.selectionGroup.x();
    this.selectionGroup.x(0);

    for (const selection of prevSelections) {
      selection.shape.x(selection.shape.x() + offsetX);
      this.addTrainSelection(selection.shape, selection.train);
    }
  }

  addTrainSelection(trainLine: Konva.Line, train: Train) {
    this.selectionGroup.add(trainLine);

    const newSelection: TrainSelection = {
      shape: trainLine,
      train: train,
    };

    this.selections.push(newSelection);
  }

  destroySelection(selection: TrainKonva) {
    selection.shape.draggable(false);
    selection.shape.stroke('black');
    selection.shape.remove();
    this.layer.add(selection.shape);
  }

  destroySelections() {
    for (const selection of this.selections) {
      this.destroySelection(selection);
    }
    this.selections.splice(0, this.selections.length);
  }

  // isThisTrainSelected(train: Train) {
  //   return this.selections.some((selection) => selection.train.trainId === train.trainId);
  // }
}
