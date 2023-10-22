import Konva from 'konva';
import { assert, nn, toStringFromSeconds } from '../../common';
import { Point } from '../../model';
import { copyTrains, deleteTrains } from './diagram-core';
import { DiagramProps } from './drawer-util';
import { ViewStateManager, generateKonvaId, getPointerPosition } from './konva-util';
import { MouseEventManager } from './mouse-event-manager';
import { TrainKonva } from './train-konva';

interface DiaTimePartial {
  diaTimeId: string;
  arrivalTime: number | null;
  departureTime: number | null;
}
interface TrainPartial {
  trainId: string;
  diaTimes: DiaTimePartial[];
}

export class SelectionGroupManager {
  private dragStartPoint: Point | null = null;
  private dragStartTrainTimes: TrainPartial[] = [];
  private currentPosition: Point | null = null;
  private selections: TrainKonva[] = [];
  private selectionGroup: Konva.Group;
  private markerGroup: Konva.Group;
  private markers: Map<string, [Konva.Rect, Konva.Text]> = new Map();

  constructor(
    private layer: Konva.Layer,
    private viewStateManager: ViewStateManager,
    private diagramProps: DiagramProps,
    private mouseEventManager: MouseEventManager,
    private stageKonva: { scale: number }
  ) {
    this.selectionGroup = new Konva.Group({ id: generateKonvaId() });
    mouseEventManager.registerDragStartHandler(this.selectionGroup.id(), this.onDragStart.bind(this));
    mouseEventManager.registerDragMoveHandler(this.selectionGroup.id(), this.onDragMove.bind(this));
    mouseEventManager.registerDragEndHandler(this.selectionGroup.id(), this.onDragEnd.bind(this));

    this.markerGroup = new Konva.Group({
      id: generateKonvaId(),
    });

    this.layer.add(this.selectionGroup);
    this.layer.add(this.markerGroup);

    this.updateShape();
  }

  private createMarkers() {
    this.markerGroup.destroyChildren();
    this.markers.clear();

    for (const selection of this.selections) {
      const train = selection.getTrain();
      for (const diaTrain of train.diaTimes) {
        for (const timeType of ['arrivalTime', 'departureTime'] as const) {
          const square = new Konva.Rect({
            fill: 'blue',
            stroke: 'black',
            strokeWidth: 0,
            id: generateKonvaId(),
          });
          const text = new Konva.Text({
            fill: 'black',
            hitFunc: function (context, shape) {},
            id: generateKonvaId(),
          });
          this.markerGroup.add(square);
          this.markerGroup.add(text);
          this.markers.set(diaTrain.diaTimeId + '-' + timeType, [square, text]);
        }
      }
    }
  }

  isDragging() {
    return this.dragStartPoint != null;
  }

  setDragStartPoint(point: Point) {
    this.dragStartPoint = {
      x: point.x,
      y: point.y,
    };

    this.dragStartTrainTimes = [];
    for (const train of this.selections.map((s) => s.getTrain())) {
      const partialDiaTimes = train.diaTimes.map((diaTime) => ({
        diaTimeId: diaTime.diaTimeId,
        arrivalTime: diaTime.arrivalTime,
        departureTime: diaTime.departureTime,
      }));
      this.dragStartTrainTimes.push({
        trainId: train.trainId,
        diaTimes: partialDiaTimes,
      });
    }

    this.updateShape();
  }

  setDraggingPoint(point: Point) {
    if (this.dragStartPoint == null) return;

    const x = Math.round(point.x / this.viewStateManager.getSecondWidth()) * this.viewStateManager.getSecondWidth();
    this.currentPosition = {
      x,
      y: 0,
    };

    for (const selection of this.selections) {
      this.processTrainDragMove(selection);
    }

    this.updateShape();
  }

  updateShape() {
    const scale = this.stageKonva.scale;

    for (const selection of this.selections) {
      const train = selection.getTrain();
      for (const diaTime of train.diaTimes) {
        if (diaTime.departureTime != null) {
          this.setMarkerPosition(
            diaTime.departureTime,
            diaTime.diaTimeId,
            diaTime.station.stationId,
            scale,
            'departureTime'
          );
        }
        if (diaTime.arrivalTime != null) {
          this.setMarkerPosition(
            diaTime.arrivalTime,
            diaTime.diaTimeId,
            diaTime.station.stationId,
            scale,
            'arrivalTime'
          );
        }
      }
    }
  }

  private setMarkerPosition(
    time: number,
    diaTimeId: string,
    stationId: string,
    scale: number,
    timeType: 'departureTime' | 'arrivalTime'
  ) {
    const timeLabel = nn(this.markers.get(diaTimeId + '-' + timeType))[1];
    timeLabel.text(toStringFromSeconds(nn(time)));

    const positionX = this.viewStateManager.getPositionFromTime(nn(time));
    const positionY = nn(this.viewStateManager.getStationPosition(nn(stationId)));

    const marker = nn(this.markers.get(diaTimeId + '-' + timeType))[0];
    marker.x(positionX - 5 / scale);
    marker.y(positionY - 5 / scale);
    marker.width(10 / scale);
    marker.height(10 / scale);

    timeLabel.x(positionX - 30 / scale);
    timeLabel.y(positionY + 5 / scale);
  }

  // 列車線をドラッグしたときの処理
  private processTrainDragMove(trainSelection: TrainKonva) {
    const [secondWidth, _stationPositions] = [
      this.viewStateManager.getSecondWidth(),
      this.viewStateManager.getStationPositions(),
    ];

    const train = trainSelection.getTrain();
    const timeDiff = Math.round((this.currentPosition!.x - this.dragStartPoint!.x) / secondWidth);

    const startTimes = this.dragStartTrainTimes.find((t) => t.trainId === trainSelection.getTrain().trainId);
    assert(startTimes != null);

    let i = 0;
    for (const diaTime of train.diaTimes) {
      if (diaTime.departureTime != null) {
        const orgTime = startTimes.diaTimes[i].departureTime;
        assert(orgTime != null);
        diaTime.departureTime = orgTime + timeDiff;
      }
      if (diaTime.arrivalTime != null) {
        const orgTime = startTimes.diaTimes[i].arrivalTime;
        assert(orgTime != null);
        diaTime.arrivalTime = orgTime + timeDiff;
      }
      i++;
    }

    trainSelection.updateShape();
    this.diagramProps.updateTrains();
  }

  private onDragStart(e: Konva.KonvaEventObject<MouseEvent>) {
    const pointerPosition = getPointerPosition(this.layer.getStage());
    this.setDragStartPoint(pointerPosition);
    this.updateShape();
  }

  onDragMove() {
    const dragPoint = getPointerPosition(this.layer.getStage());
    this.setDraggingPoint(dragPoint);
    this.updateShape();
  }

  onDragEnd() {
    this.dragStartPoint = null;
    this.currentPosition = null;
    this.updateShape();
  }

  addTrainSelection(trainKonva: TrainKonva) {
    this.selectionGroup.add(trainKonva.getTrainLine());
    this.selections.push(trainKonva);
    this.createMarkers();
    trainKonva.setSelectTrainLine(true);
    this.updateShape();
  }

  destroySelections() {
    this.selectionGroup.removeChildren();
    for (const selection of this.selections) {
      selection.setSelectTrainLine(false);
      this.layer.add(selection.getTrainLine());
    }
    this.selections.splice(0, this.selections.length);
    this.markerGroup.destroyChildren();
    this.markers.clear();
    this.updateShape();
  }

  copySelections() {
    copyTrains(
      this.diagramProps,
      this.selections.map((s) => s.getTrain())
    );

    this.updateShape();
  }

  deleteSelections() {
    deleteTrains(
      this.diagramProps,
      this.selections.map((s) => s.getTrain())
    );

    this.destroySelections();

    this.updateShape();
  }
}
