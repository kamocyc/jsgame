import Konva from 'konva';
import { AppClipboard, CrudTrain, Train } from '../../model';
import { AddingNewTrain, HistoryItem, OutlinedTimetable } from '../../outlinedTimetableData';
import { pasteTrains } from './diagram-core';
import { DragRectKonva } from './drag-rect-konva';
import { DiagramProps } from './drawer-util';
import { DrawingTrainLineKonva } from './drawing-train-line-konva';
import {
  DiagramKonvaContext,
  ViewStateManager,
  canvasHeight,
  canvasWidth,
  generateKonvaId,
  getPointerPosition,
  virtualCanvasHeight,
  virtualCanvasWidth,
} from './konva-util';
import { MouseEventManager } from './mouse-event-manager';
import { OperationCollectionKonva } from './operation-konva';
import { SelectionGroupManager } from './selection-group-manager';
import { StationLineCollectionKonva } from './station-line-konva';
import { StationViewKonva } from './station-view-konva';
import { TimeGridKonva } from './time-grid-konva';
import { TrainCollectionKonva } from './train-collection-konva';

interface StagePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface OutlinedTimetableHistoryItemContext {
  timetable: OutlinedTimetable;
}

// やることは、オブジェクトへの反映。ただし、undo / redoのために、undo / redo用の関数を返す必要がある。

function setHookToCrudTrain(crudTrain: CrudTrain, hook: () => void): CrudTrain {
  return {
    addTrains: (trains: AddingNewTrain[]) => {
      const result = crudTrain.addTrains(trains);
      hook();
      return result;
    },
    addTrain: (train: Train, direction: 'Inbound' | 'Outbound') => {
      const result = crudTrain.addTrain(train, direction);
      hook();
      return result;
    },
    updateTrain: (historyItem: HistoryItem) => {
      const result = crudTrain.updateTrain(historyItem);
      hook();
      return result;
    },
    deleteTrains: (trainIds: string[]) => {
      const result = crudTrain.deleteTrains(trainIds);
      hook();
      return result;
    },
  };
}

export class StageKonva {
  private readonly stage: Konva.Stage;
  private readonly layer: Konva.Layer;
  private readonly dragRectKonva: DragRectKonva;
  private readonly timeGridKonva: TimeGridKonva;
  private readonly stationLineCollectionKonva: StationLineCollectionKonva;
  private readonly trainCollectionKonva: TrainCollectionKonva;
  private readonly drawingTrainLineKonva: DrawingTrainLineKonva;
  private readonly operationCollectionKonva: OperationCollectionKonva;
  private readonly selectionGroupManager: SelectionGroupManager;
  private readonly diagramProps: DiagramProps;
  private readonly mouseEventManager: MouseEventManager;

  private stagePosition = {
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
    scale: 0.8,
  };

  constructor(
    minTime: number,
    diagramProps: DiagramProps,
    private readonly viewStateManager: ViewStateManager,
    private readonly container: HTMLDivElement,
    private readonly stationViewKonva: StationViewKonva
  ) {
    this.stagePosition.x = Math.min(
      0,
      -(minTime - 10 * 60) * viewStateManager.getSecondWidth() * this.stagePosition.scale
    );

    this.stage = new Konva.Stage({
      container: container,
      id: 'mainStage',
    });

    this.layer = new Konva.Layer({ id: generateKonvaId() });
    this.stage.add(this.layer);

    this.diagramProps = {
      ...diagramProps,
      setClipboard: (clipboard: AppClipboard) => {
        this.diagramProps.clipboard = clipboard;
        diagramProps.setClipboard(clipboard);
      },
      crudTrain: setHookToCrudTrain(diagramProps.crudTrain, () => {
        const [inboundTrains, outboundTrains] = this.diagramProps.getTrainsWithDirections();
        this.diagramProps.inboundTrains = inboundTrains;
        this.diagramProps.outboundTrains = outboundTrains;
        this.operationCollectionKonva.updateShape();
      }),
    };
    this.mouseEventManager = new MouseEventManager(this.layer);
    this.dragRectKonva = new DragRectKonva(this.layer);
    this.selectionGroupManager = new SelectionGroupManager(
      this.layer,
      viewStateManager,
      this.diagramProps,
      this.mouseEventManager,
      this
    );
    const context = new DiagramKonvaContext(
      this.diagramProps,
      viewStateManager,
      this.dragRectKonva,
      this.layer,
      this.selectionGroupManager,
      this.mouseEventManager
    );
    this.trainCollectionKonva = new TrainCollectionKonva(context);
    this.timeGridKonva = new TimeGridKonva(context);
    this.drawingTrainLineKonva = new DrawingTrainLineKonva(context, this.trainCollectionKonva.commitDrawingLine);
    this.stationLineCollectionKonva = new StationLineCollectionKonva(context, this.drawingTrainLineKonva);
    this.operationCollectionKonva = new OperationCollectionKonva(context);
    this.trainCollectionKonva.updateShape();
    this.drawingTrainLineKonva.createShape();
    this.selectionGroupManager.createShapes();

    // stageに対するイベント
    this.stage.on('wheel', this.onWheel.bind(this));
    this.stage.on('mousedown', this.onMousedown.bind(this));
    this.stage.on('mouseup', (e) => {
      this.stage.stopDrag();
    });
    this.stage.on('dragmove', this.onDragmove.bind(this));

    this.mouseEventManager.registerClickHandler(this.stage.id(), (e) => {
      if (e.evt.button === 0) {
        this.selectionGroupManager.destroySelections();
        this.updateShape();
      } else if (e.evt.button === 2) {
        this.drawingTrainLineKonva.commitDrawingLine();
        this.updateShape();
      }
    });
    this.mouseEventManager.registerDragStartHandler(this.stage.id(), (e) => {
      if (e.evt.button === 0) {
        // 範囲選択開始
        this.dragRectKonva.setDragStartPoint(getPointerPosition(this.stage));
        this.updateShape();
      }
    });
    this.mouseEventManager.registerDragMoveHandler(this.stage.id(), (e) => {
      if (this.dragRectKonva.isDragging()) {
        const dragEndPoint = getPointerPosition(this.stage);
        this.dragRectKonva.setDraggingPoint(dragEndPoint);
        this.updateShape();
      }
    });
    this.mouseEventManager.registerDragEndHandler(this.stage.id(), (e) => {
      if (this.dragRectKonva.isDragging()) {
        this.selectionGroupManager.destroySelections();
        this.trainCollectionKonva.addSelectedTrainsWithinDragged();

        // if (diagramState.selections.length === 2) {
        //   console.log({
        //     reason: getReasonOfNotConnected(diagramState.selections[0].train, diagramState.selections[1].train),
        //   });
        // }

        this.dragRectKonva.finishDragging();
        this.updateShape();
      }
    });

    this.stationViewKonva.setStationPositionChangeHandler(() => {
      this.updateStationPositions();
    });

    this.stationViewKonva.adjustStationPosition(this.stagePosition);
    this.updateShape();
  }

  get scale() {
    return this.stagePosition.scale;
  }
  set width(width: number) {
    this.stagePosition.width = width;
    this.updateShape();
  }

  // zooming on scroll
  private onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();

    const scaleBy = 1.05;
    const pointerPosition = e.target.getStage()?.getPointerPosition();
    if (pointerPosition == null) return;

    const oldScale = this.stagePosition.scale;
    const mousePointTo = {
      x: pointerPosition.x / oldScale - this.stagePosition.x / oldScale,
      y: pointerPosition.y / oldScale - this.stagePosition.y / oldScale,
    };

    let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    if (newScale < 0.5) {
      newScale = 0.5;
    }
    if (newScale > 2.5) {
      newScale = 2.5;
    }

    const newX = -(mousePointTo.x - pointerPosition.x / newScale) * newScale;
    const newY = -(mousePointTo.y - pointerPosition.y / newScale) * newScale;

    this.stagePosition.x = newX;
    this.stagePosition.y = newY;
    this.stagePosition.scale = newScale;

    this.adjustStagePosition(this.stagePosition, this.container);
    this.stationViewKonva.adjustStationPosition(this.stagePosition);

    this.updateShape();
    this.selectionGroupManager.updateShape();
    this.timeGridKonva.updateShape();
  }

  private onMousedown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button === 2) {
      this.stage.startDrag();
    }
  }

  private onDragmove(e: Konva.KonvaEventObject<DragEvent>) {
    const stage = e.target;
    if (stage.id() !== 'mainStage') return;

    this.stagePosition.x = stage.x();
    this.stagePosition.y = stage.y();
    this.stagePosition.scale = stage.scaleX();

    this.adjustStagePosition(this.stagePosition, this.container);
    this.stationViewKonva.adjustStationPosition(this.stagePosition);

    this.updateShape();
    this.selectionGroupManager.updateShape();
    this.timeGridKonva.updateShape();
  }

  updateShape() {
    this.stage.x(this.stagePosition.x);
    this.stage.y(this.stagePosition.y);
    this.stage.width(this.stagePosition.width);
    this.stage.height(this.stagePosition.height);
    this.stage.scaleX(this.stagePosition.scale);
    this.stage.scaleY(this.stagePosition.scale);
  }

  updateStationPositions() {
    this.selectionGroupManager.updateIsExpanded();
    this.selectionGroupManager.updateShape();
    this.timeGridKonva.updateShape();
    this.trainCollectionKonva.updateShape();
    this.drawingTrainLineKonva.updateShape();
    this.operationCollectionKonva.updateShape();
    this.stationLineCollectionKonva.updateShape();
  }

  private adjustStagePosition(stage: StagePosition, container: HTMLDivElement) {
    const containerWidth = container.clientWidth;
    const scale = stage.scale;
    const stageX = stage.x;
    const stageRight = stageX + virtualCanvasWidth * scale;

    if (stageX > 0) {
      stage.x = 0;
    }
    if (stageRight < containerWidth) {
      stage.x = containerWidth - virtualCanvasWidth * scale;
    }

    const containerHeight = container.clientHeight;
    const stageY = stage.y;
    const stageBottom = stageY + virtualCanvasHeight * scale;

    if (stageY > 0) {
      stage.y = 0;
    }
    if (stageBottom < containerHeight) {
      stage.y = containerHeight - virtualCanvasHeight * scale;
    }
  }

  copySelections() {
    this.selectionGroupManager.copySelections();
  }
  pasteTrains() {
    const newTrains = pasteTrains(this.diagramProps);
    this.trainCollectionKonva.updateShape();
    this.trainCollectionKonva.addSelectedTrains(newTrains);
  }
  deleteSelections() {
    this.selectionGroupManager.deleteSelections();
    this.trainCollectionKonva.updateShape();
  }
  moveSelections(offsetX: number, offsetY: number) {
    this.selectionGroupManager.moveSelections(offsetX);
  }
}

export class MainViewKonvaManager {
  public stageKonva: StageKonva;

  constructor(
    container: HTMLDivElement,
    diagramProps: DiagramProps,
    viewStateManger: ViewStateManager,
    stationViewKonva: StationViewKonva
  ) {
    const minTime = Math.min(
      ...(diagramProps.inboundTrains
        .map((train) => train.diaTimes.map((diaTime) => [diaTime.arrivalTime, diaTime.departureTime]).flat())
        .concat(
          diagramProps.outboundTrains.map((train) =>
            train.diaTimes.map((diaTime) => [diaTime.arrivalTime, diaTime.departureTime]).flat()
          )
        )
        .flat()
        .filter((t) => t != null) as number[])
    );

    this.stageKonva = new StageKonva(minTime, diagramProps, viewStateManger, container, stationViewKonva);

    const fitStageIntoParentContainer = () => {
      const clientWidth = document.documentElement.clientWidth - 30; /* この値はなんとかして設定する */
      container.style.width = clientWidth + 'px';
      this.stageKonva.width = clientWidth;
    };

    fitStageIntoParentContainer();

    // ウィンドウリサイズ時にサイズを合わせる
    window.addEventListener('resize', fitStageIntoParentContainer);
  }

  copySelections() {
    this.stageKonva.copySelections();
  }
  pasteTrains() {
    this.stageKonva.pasteTrains();
  }
  deleteSelections() {
    this.stageKonva.deleteSelections();
  }
  moveSelections(offsetX: number, offsetY: number) {
    this.stageKonva.moveSelections(offsetX, offsetY);
  }
}
