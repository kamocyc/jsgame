import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Stage } from 'konva/lib/Stage';
import { assert, nn, toStringFromSeconds } from '../../common';
import { DiaTime, Point, Train } from '../../model';
import { HistoryItem, getDirection } from '../../outlinedTimetableData';
import { copyTrains, deleteTrains } from './diagram-core';
import { DiagramProps } from './drawer-util';
import { ViewStateManager, generateKonvaId, getPointerPosition } from './konva-util';
import { MouseEventManager } from './mouse-event-manager';
import { getPlatformPositions } from './station-view-konva';
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
  private dragStartTrainTimes: readonly TrainPartial[] = [];
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
      this.dragStartTrainTimes = this.dragStartTrainTimes.concat([
        {
          trainId: train.trainId,
          diaTimes: partialDiaTimes,
        },
      ]);
    }
  }

  setDraggingPoint(timeDiff: number) {
    const dragStartTrainTimes = this.dragStartTrainTimes;
    const trains = this.selections.map((s) => s.getTrain());

    return {
      this: undefined,
      redo: () => {
        for (const train of trains) {
          const startTimes = dragStartTrainTimes.find((t) => t.trainId === train.trainId);
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
        }
      },
      undo: () => {
        // undoの先の状態が違う。本来はドラッグ終了時に1回のみ記録したい
        for (const train of trains) {
          const startTimes = dragStartTrainTimes.find((t) => t.trainId === train.trainId);
          assert(startTimes != null);

          let i = 0;
          for (const diaTime of train.diaTimes) {
            if (diaTime.departureTime != null) {
              const orgTime = startTimes.diaTimes[i].departureTime;
              assert(orgTime != null);
              diaTime.departureTime = orgTime;
            }
            if (diaTime.arrivalTime != null) {
              const orgTime = startTimes.diaTimes[i].arrivalTime;
              assert(orgTime != null);
              diaTime.arrivalTime = orgTime;
            }
            i++;
          }
        }
      },
    };
  }

  // 1つの点のみをドラッグしたとき
  setDraggingPointForTime(
    timeDiff: number,
    trainId: string,
    diaTimeId: string,
    arrivalOrDeparture: 'Arrival' | 'Departure'
  ): HistoryItem {
    const train = this.selections.find((s) => s.getTrain().trainId === trainId);
    assert(train !== undefined);
    const diaTime = train.getTrain().diaTimes.find((diaTime) => diaTime.diaTimeId === diaTimeId);
    assert(diaTime !== undefined);

    const startTimes = this.dragStartTrainTimes.find((t) => t.trainId === train.getTrain().trainId);
    assert(startTimes != null);
    const startTime = startTimes.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTimeId);
    assert(startTime !== undefined);

    let orgDepartureTime: number | null = null;
    let orgArrivalTime: number | null = null;

    if (arrivalOrDeparture === 'Departure') {
      if (diaTime.departureTime != null) {
        orgDepartureTime = startTime.departureTime;
        assert(orgDepartureTime != null);
      }
    } else if (arrivalOrDeparture === 'Arrival') {
      if (diaTime.arrivalTime != null) {
        orgArrivalTime = startTime.arrivalTime;
        assert(orgArrivalTime != null);
      }
    }

    return {
      this: undefined,
      redo: () => {
        if (orgDepartureTime !== null) {
          diaTime.departureTime = orgDepartureTime + timeDiff;
        }
        if (orgArrivalTime !== null) {
          diaTime.arrivalTime = orgArrivalTime + timeDiff;
        }
      },
      undo: () => {
        if (orgDepartureTime !== null) {
          diaTime.departureTime = orgDepartureTime;
        }
        if (orgArrivalTime !== null) {
          diaTime.arrivalTime = orgArrivalTime;
        }
      },
    };
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
            id: 'timeBox-' + train.trainId + '-' + diaTime.diaTimeId + '-' + timeType,
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

    // TODO: 本来は定期的に呼び出すべき
    // this.mouseEventManager.deleteDestroyedShapes();
  }

  updateShape() {
    const scale = this.stageKonva.scale;

    for (const selection of this.trainDragManager.selections) {
      selection.updateShape();

      const train = selection.getTrain();
      for (const diaTime of train.diaTimes) {
        if (diaTime.departureTime != null) {
          this.setMarkerPosition(
            train,
            diaTime,
            diaTime.departureTime,
            diaTime.diaTimeId,
            diaTime.station.stationId,
            scale,
            'departureTime'
          );
        }
        if (diaTime.arrivalTime != null) {
          this.setMarkerPosition(
            train,
            diaTime,
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
    train: Train,
    diaTime: DiaTime,
    time: number,
    diaTimeId: string,
    stationId: string,
    scale: number,
    timeType: 'departureTime' | 'arrivalTime'
  ) {
    const timeLabel = nn(this.markers.get(diaTimeId + '-' + timeType))[1];
    timeLabel.text(toStringFromSeconds(nn(time)));

    const direction = getDirection(this.diagramProps.timetable, train.trainId);

    const platformIndex = diaTime.station.platforms.findIndex((p) => p.platformId === diaTime.platform?.platformId);
    assert(platformIndex !== -1);
    const platformPositions = getPlatformPositions(diaTime.station.platforms);
    const isStationExpanded = this.viewStateManager.isStationExpanded(diaTime.station.stationId);

    const positionX = this.viewStateManager.getPositionFromTime(nn(time));
    let positionY = nn(this.viewStateManager.getStationPosition(nn(stationId)));
    if (isStationExpanded) {
      if (
        (direction === 'Outbound' && timeType === 'arrivalTime') ||
        (direction === 'Inbound' && timeType === 'departureTime')
      ) {
        positionY += platformPositions[platformPositions.length - 1];
      }
    }

    const marker = nn(this.markers.get(diaTimeId + '-' + timeType))[0];
    marker.x(positionX - 5 / scale);
    marker.y(positionY - 5 / scale);
    marker.width(10 / scale);
    marker.height(10 / scale);

    timeLabel.x(positionX - 30 / scale);
    timeLabel.y(positionY + 5 / scale);
    timeLabel.fontSize(20 / scale);
  }

  onDragMove(e: KonvaEventObject<MouseEvent>, target: Shape<ShapeConfig> | Stage) {
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
    let historyItem: HistoryItem;
    if (target.id().substring(0, 8) === 'timeBox-') {
      const [_, trainId, diaTimeId, timeType] = target.id().split('_');
      assert(timeType === 'Arrival' || timeType === 'Departure');
      assert(trainId !== undefined && diaTimeId !== undefined && timeType !== undefined);
      historyItem = this.trainDragManager.setDraggingPointForTime(timeDiff, trainId, diaTimeId, timeType);
    } else {
      historyItem = this.trainDragManager.setDraggingPoint(timeDiff);
    }
    this.diagramProps.crudTrain.updateTrain(historyItem);
    this.updateShape();
  }

  onDragEnd() {
    this.dragStartPoint = null;
    this.currentPosition = null;
    this.updateShape();
  }

  addTrainSelections(trainKonvas: TrainKonva[]) {
    this.selectionGroup.add(...trainKonvas.map((t) => t.getTrainLine()));
    this.trainDragManager.selections.push(...trainKonvas);
    this.createMarkers();
    for (const trainKonva of trainKonvas) {
      trainKonva.setSelectTrainLine(true);
    }
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
    const historyItem = this.trainDragManager.setDraggingPoint(timeDiff);
    this.diagramProps.crudTrain.updateTrain(historyItem);
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
