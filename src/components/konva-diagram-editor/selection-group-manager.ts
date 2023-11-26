import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Shape, ShapeConfig } from 'konva/lib/Shape';
import { Stage } from 'konva/lib/Stage';
import { assert, nn, toStringFromSeconds } from '../../common';
import { DiaTime, PlatformLike, Point, Train } from '../../model';
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

function getNewTime(
  train: Train,
  diaTime: DiaTime,
  orgTime: number,
  timeDiff: number,
  arrivalOrDeparture: 'ArrivalTime' | 'DepartureTime'
): number {
  let newTime = orgTime + timeDiff;

  // 前の時間以降にする
  const diaTimes = train.diaTimes;
  const index = diaTimes.findIndex((d) => d.diaTimeId === diaTime.diaTimeId);
  assert(index !== -1);
  // console.log({ index, newTime, orgTime: orgTime });

  if (arrivalOrDeparture === 'ArrivalTime') {
    const departureTime = diaTimes[index].departureTime;
    if (departureTime !== null) {
      if (newTime > departureTime) {
        newTime = departureTime;
      }
    }
  } else if (arrivalOrDeparture === 'DepartureTime') {
    const arrivalTime = diaTimes[index].arrivalTime;
    if (arrivalTime !== null) {
      if (newTime < arrivalTime) {
        newTime = arrivalTime;
      }
    }
  }

  if (index > 0) {
    const prevDiaTime = diaTimes[index - 1];
    const prevTime = Math.max(prevDiaTime.arrivalTime ?? 0, prevDiaTime.departureTime ?? 0);
    if (newTime < prevTime) {
      newTime = prevTime;
    }
  }

  if (index < diaTimes.length - 1) {
    const nextDiaTime = diaTimes[index + 1];
    const nextTime = Math.min(nextDiaTime.arrivalTime ?? Infinity, nextDiaTime.departureTime ?? Infinity);
    if (newTime > nextTime) {
      newTime = nextTime;
    }
  }

  return newTime;
}

function getPlatformUnderCursor(y: number, stageKonva: { scale: number }, viewStateManager: ViewStateManager) {
  const stationPositions = viewStateManager.getStationPositions();
  const stationLineWidth = 20;
  const foundStations = stationPositions.map((station) => {
    const isPlatformExpanded = viewStateManager.isStationExpanded(station.station.stationId);
    const stationY = station.diagramPosition;

    if (isPlatformExpanded) {
      // プラットフォーム
      if (stationY < y) {
        const [platformPositions, _] = getPlatformPositions(station.station.platforms);

        const platformPositionIndex = platformPositions.findIndex((platformPosition) => {
          const platformY = station.diagramPosition + platformPosition;
          const platformYStart = platformY - (stationLineWidth * stageKonva.scale) / 2;
          const platformYEnd = platformY + (stationLineWidth * stageKonva.scale) / 2;
          return platformYStart <= y && y <= platformYEnd;
        });
        if (platformPositionIndex !== -1) {
          return { platform: station.station.platforms[platformPositionIndex], station: null };
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      // 駅
      const stationYStart = stationY - (stationLineWidth * stageKonva.scale) / 2;
      const stationYEnd = stationY + (stationLineWidth * stageKonva.scale) / 2;
      if (stationYStart <= y && y <= stationYEnd) {
        return { platform: null, station };
      } else {
        return null;
      }
    }
  });
  const foundStations_ = foundStations.filter((s) => s !== null);
  if (foundStations_.length === 0) {
    return null;
  }

  return foundStations_[0];
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

  // スジ全体をドラッグしたとき
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
        // TODO: undoの先の状態が違う。本来はドラッグ終了時に1回のみ記録したい
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
  // ドラッグ開始時の時刻点を記録しておく
  setDraggingPointForTime(
    timeDiff: number,
    trainId: string,
    diaTimeId: string,
    arrivalOrDeparture: 'arrivalTime' | 'departureTime',
    movePlatform: boolean,
    newPlatform: PlatformLike | null
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

    if (arrivalOrDeparture === 'departureTime') {
      if (diaTime.departureTime != null) {
        orgDepartureTime = startTime.departureTime;
        assert(orgDepartureTime != null);
      }
    } else if (arrivalOrDeparture === 'arrivalTime') {
      if (diaTime.arrivalTime != null) {
        orgArrivalTime = startTime.arrivalTime;
        assert(orgArrivalTime != null);
      }
    }

    let orgPlatform: PlatformLike | null = null;
    if (movePlatform) {
      orgPlatform = diaTime.platform;
    }

    return {
      this: undefined,
      redo: () => {
        if (orgDepartureTime !== null) {
          diaTime.departureTime = getNewTime(train.getTrain(), diaTime, orgDepartureTime, timeDiff, 'DepartureTime');
        }
        if (orgArrivalTime !== null) {
          diaTime.arrivalTime = getNewTime(train.getTrain(), diaTime, orgArrivalTime, timeDiff, 'ArrivalTime');
        }
        if (movePlatform && newPlatform !== null) {
          diaTime.platform = newPlatform;
        }
      },
      undo: () => {
        if (orgDepartureTime !== null) {
          diaTime.departureTime = orgDepartureTime;
        }
        if (orgArrivalTime !== null) {
          diaTime.arrivalTime = orgArrivalTime;
        }
        if (orgPlatform !== null) {
          diaTime.platform = orgPlatform;
        }
      },
    };
  }
}

function getKey(train: Train, diaTime: DiaTime, timeType: 'arrivalTime' | 'departureTime', isPlatform: boolean) {
  return `timeBox-${train.trainId}-${diaTime.diaTimeId}-${isPlatform ? 'platform' : 'station'}-${timeType}`;
}

/**
 * オブジェクトの初期化順序が重なり順序になるため、createShapeを初期化時に実行する必要がある
 */
export class SelectionGroupManager {
  private selectionGroup!: Konva.Group;
  private markerGroup!: Konva.Group;
  private markers: Map<string, { square: Konva.Rect; squarePlatform: Konva.Rect | null; text: Konva.Text }> = new Map();
  private dragStartPoint: Point | null = null;
  private currentPosition: Point | null = null;
  private trainDragManager!: TrainDragManager;

  constructor(
    private layer: Konva.Layer,
    private viewStateManager: ViewStateManager,
    private diagramProps: DiagramProps,
    private mouseEventManager: MouseEventManager,
    private stageKonva: { scale: number }
  ) {}

  createShapes() {
    this.selectionGroup = new Konva.Group({ id: generateKonvaId() });
    this.mouseEventManager.registerDragStartHandler(this.selectionGroup.id(), this.onDragStart.bind(this));
    this.mouseEventManager.registerDragMoveHandler(this.selectionGroup.id(), this.onDragMove.bind(this));
    this.mouseEventManager.registerDragEndHandler(this.selectionGroup.id(), this.onDragEnd.bind(this));

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
            id: getKey(train, diaTime, timeType, false),
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

          this.markers.set(diaTime.diaTimeId + '-' + timeType, { square, squarePlatform: null, text });
        }
      }
    }

    this.updateIsExpanded();

    // TODO: 本来は定期的に呼び出すべき
    // this.mouseEventManager.deleteDestroyedShapes();
  }

  updateIsExpanded() {
    for (const selection of this.trainDragManager.selections) {
      const train = selection.getTrain();
      for (const diaTime of train.diaTimes) {
        for (const timeType of ['arrivalTime', 'departureTime'] as const) {
          const isPlatformExpanded = this.viewStateManager.isStationExpanded(diaTime.station.stationId);
          let squarePlatform: Konva.Rect | null = null;
          if (isPlatformExpanded && this.markerGroup.find('#' + getKey(train, diaTime, timeType, true)).length === 0) {
            squarePlatform = new Konva.Rect({
              fill: 'blue',
              stroke: 'black',
              strokeWidth: 0,
              id: getKey(train, diaTime, timeType, true),
            });
            this.mouseEventManager.registerDragStartHandler(squarePlatform.id(), this.onDragStart.bind(this));
            this.mouseEventManager.registerDragMoveHandler(squarePlatform.id(), this.onDragMove.bind(this));
            this.mouseEventManager.registerDragEndHandler(squarePlatform.id(), this.onDragEnd.bind(this));
            this.markerGroup.add(squarePlatform);

            const oldMarkers = nn(this.markers.get(diaTime.diaTimeId + '-' + timeType));
            this.markers.set(diaTime.diaTimeId + '-' + timeType, {
              square: oldMarkers.square,
              squarePlatform,
              text: oldMarkers.text,
            });
          } else if (
            !isPlatformExpanded &&
            this.markerGroup.find('#' + getKey(train, diaTime, timeType, true)).length > 0
          ) {
            squarePlatform = nn(this.markerGroup.find('#' + getKey(train, diaTime, timeType, true))[0]) as Konva.Rect;
            squarePlatform.destroy();

            const oldMarkers = nn(this.markers.get(diaTime.diaTimeId + '-' + timeType));
            this.markers.set(diaTime.diaTimeId + '-' + timeType, {
              square: oldMarkers.square,
              squarePlatform: null,
              text: oldMarkers.text,
            });
          }
        }
      }
    }
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
    const timeLabel = nn(this.markers.get(diaTimeId + '-' + timeType)).text;
    timeLabel.text(toStringFromSeconds(nn(time)));

    const direction = getDirection(this.diagramProps.timetable, train.trainId);

    const [platformPositions, lastLinePosition] = getPlatformPositions(diaTime.station.platforms);
    const isStationExpanded = this.viewStateManager.isStationExpanded(diaTime.station.stationId);

    const positionX = this.viewStateManager.getPositionFromTime(nn(time));
    const positionY = nn(this.viewStateManager.getStationPosition(nn(stationId)));

    const marker = nn(this.markers.get(diaTimeId + '-' + timeType)).square;
    marker.x(positionX - 5 / scale);
    marker.width(10 / scale);
    marker.height(10 / scale);
    if (
      isStationExpanded &&
      ((direction === 'Outbound' && timeType === 'arrivalTime') ||
        (direction === 'Inbound' && timeType === 'departureTime'))
    ) {
      marker.y(positionY + lastLinePosition - 5 / scale);
      timeLabel.y(positionY + lastLinePosition + 5 / scale);

      // ホームの位置
      const markerPlatform = nn(this.markers.get(diaTimeId + '-' + timeType)).squarePlatform;
      if (markerPlatform !== null) {
        const platformIndex = diaTime.station.platforms.findIndex((p) => p.platformId === diaTime.platform?.platformId);
        assert(platformIndex !== -1);
        markerPlatform.x(positionX - 5 / scale);
        markerPlatform.y(positionY + platformPositions[platformIndex] - 5 / scale);
        markerPlatform.width(10 / scale);
        markerPlatform.height(10 / scale);
      }
    } else {
      marker.y(positionY - 5 / scale);
      timeLabel.y(positionY + 5 / scale);
    }

    timeLabel.x(positionX - 30 / scale);
    timeLabel.fontSize(20 / scale);
  }

  onDragMove(e: KonvaEventObject<MouseEvent>, target: Shape<ShapeConfig> | Stage) {
    const dragPoint = getPointerPosition(this.layer.getStage());
    if (this.dragStartPoint == null) return;

    const x = Math.round(dragPoint.x / this.viewStateManager.getSecondWidth()) * this.viewStateManager.getSecondWidth();
    const platform = getPlatformUnderCursor(dragPoint.y, this.stageKonva, this.viewStateManager);
    this.currentPosition = {
      x,
      y: 0,
    };

    const timeDiff = Math.round(
      (this.currentPosition!.x - this.dragStartPoint!.x) / this.viewStateManager.getSecondWidth()
    );
    let historyItem: HistoryItem;
    if (target.id().substring(0, 8) === 'timeBox-') {
      // 1つの時刻のみ
      const [_, trainId, diaTimeId, platformOrStation, timeType] = target.id().split('-');
      assert(timeType === 'arrivalTime' || timeType === 'departureTime');
      assert(
        trainId !== undefined && diaTimeId !== undefined && platformOrStation !== undefined && timeType !== undefined
      );
      historyItem = this.trainDragManager.setDraggingPointForTime(
        timeDiff,
        trainId,
        diaTimeId,
        timeType,
        platformOrStation === 'platform',
        platform?.platform ?? null
      );
    } else {
      // スジ全体
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
