import Konva from 'konva';
import { deepEqual } from '../../common';
import { pasteTrains } from './diagram-core';
import { DragRectKonva } from './drag-rect-konva';
import { DiagramProps } from './drawer-util';
import { DrawingTrainLineKonva } from './drawing-train-line-konva';
import {
  DiagramKonvaContext,
  ViewStateManager,
  canvasHeight,
  canvasWidth,
  getPointerPosition,
  virtualCanvasHeight,
  virtualCanvasWidth,
} from './konva-util';
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

export class StageKonva {
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private dragRectKonva: DragRectKonva;
  private timeGridKonva: TimeGridKonva;
  private stationLineCollectionKonva: StationLineCollectionKonva;
  private trainCollectionKonva: TrainCollectionKonva;
  private drawingTrainLineKonva: DrawingTrainLineKonva;
  private operationCollectionKonva: OperationCollectionKonva;
  private selectionGroupManager: SelectionGroupManager;
  private diagramProps: DiagramProps;

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
    private viewStateManager: ViewStateManager,
    private container: HTMLDivElement,
    private stationViewKonva: StationViewKonva
  ) {
    this.stagePosition.x = Math.min(
      0,
      -(minTime - 10 * 60) * viewStateManager.getSecondWidth() * this.stagePosition.scale
    );

    this.stage = new Konva.Stage({
      container: container,
      id: 'mainStage',
    });

    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    this.diagramProps = {
      ...diagramProps,
      updateTrains: () => {
        diagramProps.updateTrains();
        this.operationCollectionKonva.updateShape();
      },
    };
    this.dragRectKonva = new DragRectKonva(this.layer);
    this.selectionGroupManager = new SelectionGroupManager(this.layer, viewStateManager, this.diagramProps, this);
    const context = new DiagramKonvaContext(
      this.diagramProps,
      viewStateManager,
      this.dragRectKonva,
      this.layer,
      this.selectionGroupManager
    );
    this.timeGridKonva = new TimeGridKonva(context);
    this.trainCollectionKonva = new TrainCollectionKonva(context);
    this.drawingTrainLineKonva = new DrawingTrainLineKonva(context, this.trainCollectionKonva);
    this.stationLineCollectionKonva = new StationLineCollectionKonva(context, this.drawingTrainLineKonva);
    this.operationCollectionKonva = new OperationCollectionKonva(context);

    // stageに対するイベント
    this.stage.on('wheel', this.onWheel.bind(this));
    this.stage.on('mousedown', this.onMousedown.bind(this));
    this.stage.on('mousemove', this.onMousemove.bind(this));
    // this.stage.on('click', this.onClick.bind(this));
    this.stage.on('mouseup', this.onMouseup.bind(this));
    this.stage.on('dragmove', this.onDragmove.bind(this));

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
  }

  private onMousedown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button === 2) {
      this.stage.startDrag();
      this.updateShape();
    } else if (e.evt.button === 0 && e.target === this.stage) {
      // 範囲選択開始
      this.dragRectKonva.setDragStartPoint(getPointerPosition(this.stage));
      this.updateShape();
    }
  }

  private onMousemove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (this.selectionGroupManager.isDragging()) {
      const dragPoint = getPointerPosition(this.stage);
      this.selectionGroupManager.setDraggingPoint(dragPoint);
      this.updateShape();
    } else if (this.dragRectKonva.isDragging()) {
      const dragEndPoint = getPointerPosition(this.stage);
      this.dragRectKonva.setDraggingPoint(dragEndPoint);
      this.updateShape();
    }
  }

  // private onClick(e: Konva.KonvaEventObject<MouseEvent>) {
  //   if (e.evt.button === 2) {
  //   } else if (e.target === this.stage) {
  //     this.selectionGroupManager.destroySelections();
  //     this.updateShape();
  //   }
  //   e.cancelBubble = true;
  // }

  private onMouseup(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button === 2) {
      // 右クリック
      this.drawingTrainLineKonva.commitDrawingLine();
      this.updateShape();
    } else if (this.selectionGroupManager.isDragging()) {
      this.selectionGroupManager.endDragging();
      this.updateShape();
      e.cancelBubble = true;
    } else if (this.dragRectKonva.isDragging()) {
      const currentPointerPoint = getPointerPosition(this.stage);
      if (deepEqual(currentPointerPoint, this.dragRectKonva.getDragStartPoint())) {
        this.dragRectKonva.finishDragging();
        this.updateShape();
        return;
      }

      this.selectionGroupManager.destroySelections();
      this.trainCollectionKonva.addSelectedTrains();

      // if (diagramState.selections.length === 2) {
      //   console.log({
      //     reason: getReasonOfNotConnected(diagramState.selections[0].train, diagramState.selections[1].train),
      //   });
      // }

      this.dragRectKonva.finishDragging();
      this.updateShape();
      e.cancelBubble = true;
    } else if (e.target === this.stage) {
      this.selectionGroupManager.destroySelections();
      this.updateShape();
      e.cancelBubble = true;
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
  }

  updateShape() {
    this.stage.x(this.stagePosition.x);
    this.stage.y(this.stagePosition.y);
    this.stage.width(this.stagePosition.width);
    this.stage.height(this.stagePosition.height);
    this.stage.scaleX(this.stagePosition.scale);
    this.stage.scaleY(this.stagePosition.scale);
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
    pasteTrains(this.diagramProps);
  }
  deleteSelections() {
    this.selectionGroupManager.deleteSelections();
  }
}

export class MainViewKonvaManager {
  public stageKonva: StageKonva;

  constructor(container: HTMLDivElement, diagramProps: DiagramProps, stationViewKonva: StationViewKonva) {
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

    const secondWidth = virtualCanvasWidth / 24 / 60 / 60;
    const stationPositions = diagramProps.stations.map((station, index) => ({
      station,
      diagramPosition: index * 50 + 50,
    }));
    const viewStateManger = new ViewStateManager(secondWidth, stationPositions);

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
}