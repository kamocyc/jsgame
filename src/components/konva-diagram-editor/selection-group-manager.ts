import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Stage } from 'konva/lib/Stage';
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

class TrainDragManager {
  private dragStartTrainTimes: TrainPartial[] = [];
  public selections: TrainKonva[] = [];
  private isTimeDrag: boolean = false;

  constructor() {}

  setIsTimeDrag(flag: boolean) {
    this.isTimeDrag = flag;
  }

  setDragStartPoint() {
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
  }

  setDraggingPoint(timeDiff: number) {
    for (const selection of this.selections) {
      this.processTrainDragMove(selection, timeDiff);
    }
  }

  setDraggingPointForTime(
    timeDiff: number,
    trainId: string,
    diaTimeId: string,
    arrivalOrDeparture: 'Arrival' | 'Departure'
  ) {
    const train = this.selections.find((s) => s.getTrain().trainId === trainId);
    assert(train !== undefined);
    const diaTime = train.getTrain().diaTimes.find((diaTime) => diaTime.diaTimeId === diaTimeId);
    assert(diaTime !== undefined);

    const startTimes = this.dragStartTrainTimes.find((t) => t.trainId === train.getTrain().trainId);
    assert(startTimes != null);
    const startTime = startTimes.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTimeId);
    assert(startTime !== undefined);

    if (arrivalOrDeparture === 'Departure') {
      if (diaTime.departureTime != null) {
        const orgTime = startTime.departureTime;
        assert(orgTime != null);
        diaTime.departureTime = orgTime + timeDiff;
      }
    } else if (arrivalOrDeparture === 'Arrival') {
      if (diaTime.arrivalTime != null) {
        const orgTime = startTime.arrivalTime;
        assert(orgTime != null);
        diaTime.arrivalTime = orgTime + timeDiff;
      }
    }
  }

  // 列車線をドラッグしたときの処理
  private processTrainDragMove(trainSelection: TrainKonva, timeDiff: number) {
    const train = trainSelection.getTrain();

    const startTimes = this.dragStartTrainTimes.find((t) => t.trainId === trainSelection.getTrain().trainId);
    assert(startTimes != null);

    const a = (train: Train) => {};
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
  }
}

export class SelectionGroupManager {
  private selectionGroup: Konva.Group;
  private markerGroup: Konva.Group;
  private markers: Map<string, [Konva.Rect, Konva.Text]> = new Map();
  private dragStartPoint: Point | null = null;
  private currentPosition: Point | null = null;
  private trainDragManager: TrainDragManager;

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

    this.trainDragManager = new TrainDragManager();

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

    for (const selection of this.trainDragManager.selections) {
      const train = selection.getTrain();
      for (const diaTime of train.diaTimes) {
        for (const timeType of ['arrivalTime', 'departureTime'] as const) {
          const square = new Konva.Rect({
            fill: 'blue',
            stroke: 'black',
            strokeWidth: 0,
            id: 'timeBox-' + selection.getTrain().trainId + '-' + diaTime.diaTimeId + '-' + timeType,
          });
          this.mouseEventManager.registerDragStartHandler(square.id(), this.onDragStart.bind(this));
          this.mouseEventManager.registerDragMoveHandler(square.id(), this.onDragMove.bind(this));
          this.mouseEventManager.registerDragEndHandler(square.id(), this.onDragEnd.bind(this));

          const text = new Konva.Text({
            fill: 'black',
            hitFunc: function (context, shape) {},
            id: generateKonvaId(),
          });
          this.markerGroup.add(square);
          this.markerGroup.add(text);
          this.markers.set(diaTime.diaTimeId + '-' + timeType, [square, text]);
        }
      }
    }
  }

  updateShape() {
    const scale = this.stageKonva.scale;

    for (const selection of this.trainDragManager.selections) {
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
    timeLabel.fontSize(20 / scale);
  }

  onDragMove(e: KonvaEventObject<MouseEvent>, target: Shape<ShapeConfig> | Stage, isTimeDrag: boolean = false) {
    const dragPoint = getPointerPosition(this.layer.getStage());
    if (this.dragStartPoint == null) return;

    const x = Math.round(dragPoint.x / this.viewStateManager.getSecondWidth()) * this.viewStateManager.getSecondWidth();
    this.currentPosition = {
      x,
      y: 0,
    };

    const timeDiff = Math.round(
      (this.currentPosition!.x - this.dragStartPoint!.x) / this.viewStateManager.getSecondWidth()
    );
    if (target.id().substring(0, 8) === 'timeBox-') {
      const [_, trainId, diaTimeId, timeType] = target.id().split('_');
      assert(timeType === 'Arrival' || timeType === 'Departure');
      this.trainDragManager.setDraggingPointForTime(timeDiff, trainId, diaTimeId, timeType);
    } else {
      this.trainDragManager.setDraggingPoint(timeDiff);
    }
    this.diagramProps.updateTrains();
    this.updateShape();
  }

  onDragEnd() {
    this.dragStartPoint = null;
    this.currentPosition = null;
    this.updateShape();
  }

  addTrainSelection(trainKonva: TrainKonva) {
    this.selectionGroup.add(trainKonva.getTrainLine());
    this.trainDragManager.selections.push(trainKonva);
    this.createMarkers();
    trainKonva.setSelectTrainLine(true);
    this.updateShape();
  }

  destroySelections() {
    this.selectionGroup.removeChildren();
    for (const selection of this.trainDragManager.selections) {
      selection.setSelectTrainLine(false);
      this.layer.add(selection.getTrainLine());
    }
    this.trainDragManager.selections.splice(0, this.trainDragManager.selections.length);
    this.markerGroup.destroyChildren();
    this.markers.clear();
    this.updateShape();
  }

  copySelections() {
    copyTrains(
      this.diagramProps,
      this.trainDragManager.selections.map((s) => s.getTrain())
    );

    this.updateShape();
  }

  deleteSelections() {
    deleteTrains(
      this.diagramProps,
      this.trainDragManager.selections.map((s) => s.getTrain())
    );

    this.destroySelections();

    this.updateShape();
  }

  moveSelections(offsetX: number) {
    this.trainDragManager.setDragStartPoint();
    const timeDiff = offsetX * 15;
    this.trainDragManager.setDraggingPoint(timeDiff);
    this.diagramProps.updateTrains();
    this.updateShape();
  }

  private onDragStart() {
    const pointerPosition = getPointerPosition(this.layer.getStage());
    this.dragStartPoint = {
      x: pointerPosition.x,
      y: pointerPosition.y,
    };
    this.trainDragManager.setDragStartPoint();
    this.updateShape();
  }
}
