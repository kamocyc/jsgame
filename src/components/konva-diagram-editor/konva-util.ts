import Konva from 'konva';
import { toStringFromSeconds } from '../../common';
import { DiaTime, Point } from '../../model';
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
  private selectionGroup: Konva.Group;

  constructor(
    private layer: Konva.Layer,
    private viewStateManager: ViewStateManager,
    private diagramProps: DiagramProps
  ) {
    this.selectionGroup = new Konva.Group();
    this.selectionGroup.on('mousedown', this.onMousedown.bind(this));
    this.selectionGroup.on('mouseup', this.onMouseup.bind(this));

    this.layer.add(this.selectionGroup);
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

  drawLabel() {
    const square = new Konva.Rect({
      x: position[0] - 5 / scale,
      y: position[1] - 5 / scale,
      width: 10 / scale,
      height: 10 / scale,
      fill: 'blue',
      stroke: 'black',
      strokeWidth: 0,
      draggable: true,
      id: `timePoint-${diaTime.diaTimeId}-${arrivalOrDeparture}`,
    });
    trainClickedGroup.add(square);

    const textPosition =
      arrivalOrDeparture === 'arrivalTime'
        ? { x: position[0] - 30 / scale, y: position[1] + 5 / scale }
        : { x: position[0], y: position[1] - 20 / scale };
    const timeLabel = new Konva.Text({
      x: textPosition.x,
      y: textPosition.y,
      text:
        arrivalOrDeparture === 'arrivalTime'
          ? toStringFromSeconds(diaTime.arrivalTime!)
          : toStringFromSeconds(diaTime.departureTime!),
      fontSize: Math.round(22 / scale),
      fill: 'black',
      id: `timeLabel-${diaTime.diaTimeId}-${arrivalOrDeparture}`,
      hitFunc: function (context, shape) {},
    });
    trainClickedGroup.add(timeLabel);
  }

  // 列車線をドラッグしたときの処理
  processTrainDragMove(trainSelection: TrainKonva) {
    const [secondWidth, stationPositions] = [
      this.viewStateManager.getSecondWidth(),
      this.viewStateManager.getStationPositions(),
    ];

    const train = trainSelection.getTrain();
    const timeOffset = (this.currentPosition!.x - this.dragStartPoint!.x) / secondWidth;

    for (const diaTime of train.diaTimes) {
      const stationPosition = stationPositions.find(
        (stationPosition) => stationPosition.station.stationId === diaTime.station.stationId
      );
      if (!stationPosition) {
        throw new Error(`station ${diaTime.station.stationId} not found`);
      }

      if (diaTime.departureTime != null) {
        diaTime.departureTime += timeOffset;

        const timeLabel = this.layer.findOne(`#timeLabel-${diaTime.diaTimeId}-${timeType}`) as Konva.Text;
        timeLabel.text(toStringFromSeconds(diaTime.departureTime));
      }
      if (diaTime.arrivalTime != null) {
        diaTime.arrivalTime += timeOffset;

        const timeLabel = this.layer.findOne(`#timeLabel-${diaTime.diaTimeId}-${timeType}`) as Konva.Text;
        timeLabel.text(toStringFromSeconds(diaTime.arrivalTime));
      }
    }

    this.diagramProps.updateTrains();
  }

  onMousedown(e: Konva.KonvaEventObject<MouseEvent>) {
    const pointerPosition = getPointerPosition(this.layer.getStage());
    this.setDragStartPoint(pointerPosition);
  }

  onMouseup(e: Konva.KonvaEventObject<MouseEvent>) {
    this.dragStartPoint = null;
    this.currentPosition = null;
  }

  getSelections() {
    return this.selections;
  }

  addTrainSelection(trainKonva: TrainKonva) {
    this.selectionGroup.add(trainKonva.getTrainLine());

    this.selections.push(trainKonva);
  }

  destroySelections() {
    this.selectionGroup.removeChildren();
    this.selections.splice(0, this.selections.length);
  }

  // isThisTrainSelected(train: Train) {
  //   return this.selections.some((selection) => selection.train.trainId === train.trainId);
  // }
}
