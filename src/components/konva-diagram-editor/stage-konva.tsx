import { produce } from 'immer';
import Konva from 'konva';
import { Shape } from 'konva/lib/Shape';
import { useEffect, useRef, useState } from 'react';
import { Layer, Stage } from 'react-konva';
import { SetterOrUpdater, useRecoilState, useRecoilValue } from 'recoil';
import { DeepReadonly } from 'ts-essentials';
import { nn } from '../../common';
import { PlatformLike, Point, StationLike, Train, generateId, getDefaultConnectionType } from '../../model';
import { OutlinedTimetable, getDirection } from '../../outlinedTimetableData';
import { Polygon, sat } from '../../sat';
import { fillMissingTimes } from '../timetable-editor/timetable-util';
import { getNewTrainCode } from '../timetable-editor/train-component';
import { DragRectKonva, DragRectKonvaProps } from './drag-rect-konva';
import { DiagramProps } from './drawer-util';
import {
  DrawingTrainLineKonva,
  getDiaTimeFromDrawingTrainLine,
  getDirectionOfDrawingTrainLine,
} from './drawing-train-line-konva';
import {
  DrawingTrainLine,
  RectState,
  ViewState,
  allTrainsMapAtom,
  createPositionDiaTimeMap,
  drawingTrainLineAtom,
  getMouseEventManager,
  getPointerPosition,
  getPositionToTime,
  secondWidthAtom,
  selectedTrainIdsAtom,
  stageStateAtom,
  stationCanvasWidthAtom,
  stationMapSelector,
  stationsAtom,
  useViewStateValues,
  virtualCanvasHeightSelector,
  virtualCanvasWidth,
} from './konva-util';
import { OperationCollectionKonva } from './operation-konva';
import { getPlatformUnderCursor } from './selection-group-manager';
import { StationLineCollectionKonva } from './station-line-konva';
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

// export class StageKonva_ {
//   private readonly stage: Konva.Stage;
//   private readonly layer: Konva.Layer;
//   private readonly dragRectKonva: DragRectKonva;
//   private readonly timeGridKonva: TimeGridKonva_;
//   private readonly stationLineCollectionKonva: StationLineCollectionKonva;
//   private readonly trainCollectionKonva: TrainCollectionKonva_;
//   private readonly drawingTrainLineKonva: DrawingTrainLineKonva;
//   private readonly operationCollectionKonva: OperationCollectionKonva_;
//   private readonly selectionGroupManager: SelectionGroupManager;
//   private readonly diagramProps: DiagramProps;
//   private readonly mouseEventManager: MouseEventManager_;

//   private stagePosition = {
//     x: 0,
//     y: 0,
//     width: canvasWidth,
//     height: canvasHeight,
//     scale: 0.8,
//   };

//   constructor(
//     minTime: number,
//     diagramProps: DiagramProps,
//     private readonly viewStateManager: ViewStateManager,
//     private readonly container: HTMLDivElement,
//     private readonly stationViewKonva: StationViewKonva
//   ) {
//     this.stagePosition.x = Math.min(
//       0,
//       -(minTime - 10 * 60) * viewStateManager.getSecondWidth() * this.stagePosition.scale
//     );

//     this.stage = new Konva.Stage({
//       container: container,
//       id: 'mainStage',
//     });

//     this.layer = new Konva.Layer({ id: generateKonvaId() });
//     this.stage.add(this.layer);

//     this.diagramProps = {
//       ...diagramProps,
//       setClipboard: (clipboard: AppClipboard) => {
//         this.diagramProps.clipboard = clipboard;
//         diagramProps.setClipboard(clipboard);
//       },
//       crudTrain: setHookToCrudTrain(diagramProps.crudTrain, () => {
//         const [inboundTrains, outboundTrains] = this.diagramProps.getTrainsWithDirections();
//         this.diagramProps.inboundTrains = inboundTrains;
//         this.diagramProps.outboundTrains = outboundTrains;
//         this.operationCollectionKonva.updateShape();
//       }),
//     };
//     this.mouseEventManager = new MouseEventManager_(this.layer);
//     this.dragRectKonva = new DragRectKonva(this.layer);
//     this.selectionGroupManager = new SelectionGroupManager(
//       this.layer,
//       viewStateManager,
//       this.diagramProps,
//       this.mouseEventManager,
//       this
//     );
//     const context = new DiagramKonvaContext(
//       this.diagramProps,
//       viewStateManager,
//       this.dragRectKonva,
//       this.layer,
//       this.selectionGroupManager,
//       this.mouseEventManager
//     );
//     this.trainCollectionKonva = new TrainCollectionKonva_(context);
//     this.timeGridKonva = new TimeGridKonva_(context);
//     this.drawingTrainLineKonva = new DrawingTrainLineKonva(context, this.trainCollectionKonva);
//     this.stationLineCollectionKonva = new StationLineCollectionKonva(context, this.drawingTrainLineKonva);
//     this.operationCollectionKonva = new OperationCollectionKonva_(context);
//     this.selectionGroupManager.setTrainCollectionKonva(this.trainCollectionKonva);
//     this.trainCollectionKonva.moveShapesToTop;
//     this.drawingTrainLineKonva.moveShapesToTop();
//     this.selectionGroupManager.moveShapesToTop();

//     // // stageに対するイベント
//     // this.stage.on('wheel', this.onWheel.bind(this));
//     // this.stage.on('mousedown', this.onMousedown.bind(this));
//     // this.stage.on('mouseup', (e) => {
//     //   this.stage.stopDrag();
//     // });
//     // this.stage.on('dragmove', this.onDragmove.bind(this));

//     this.mouseEventManager.registerClickHandler(this.stage.id(), (e) => {
//       if (e.evt.button === 0) {
//         this.selectionGroupManager.destroySelections();
//         this.updateShape();
//       } else if (e.evt.button === 2) {
//         this.drawingTrainLineKonva.commitDrawingLine();
//         this.updateShape();
//       }
//     });
//     this.mouseEventManager.registerDragStartHandler(this.stage.id(), (e) => {
//       if (e.evt.button === 0) {
//         // 範囲選択開始
//         this.dragRectKonva.setDragStartPoint(getPointerPosition(this.stage));
//         this.updateShape();
//       }
//     });
//     this.mouseEventManager.registerDragMoveHandler(this.stage.id(), (e) => {
//       if (this.dragRectKonva.isDragging()) {
//         const dragEndPoint = getPointerPosition(this.stage);
//         this.dragRectKonva.setDraggingPoint(dragEndPoint);
//         this.updateShape();
//       }
//     });
//     this.mouseEventManager.registerDragEndHandler(this.stage.id(), (e) => {
//       if (this.dragRectKonva.isDragging()) {
//         this.selectionGroupManager.destroySelections();
//         this.trainCollectionKonva.addSelectedTrainsWithinDragged();

//         // if (diagramState.selections.length === 2) {
//         //   console.log({
//         //     reason: getReasonOfNotConnected(diagramState.selections[0].train, diagramState.selections[1].train),
//         //   });
//         // }

//         this.dragRectKonva.finishDragging();
//         this.updateShape();
//       }
//     });

//     this.stationViewKonva.setStationPositionChangeHandler(() => {
//       this.updateStationPositions();
//     });

//     this.stationViewKonva.adjustStationPosition(this.stagePosition);
//     this.updateShape();
//   }

//   get scale() {
//     return this.stagePosition.scale;
//   }
//   set width(width: number) {
//     this.stagePosition.width = width;
//     this.updateShape();
//   }

//   // zooming on scroll
//   // private onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
//   //   e.evt.preventDefault();

//   //   const scaleBy = 1.05;
//   //   const pointerPosition = e.target.getStage()?.getPointerPosition();
//   //   if (pointerPosition == null) return;

//   //   const oldScale = this.stagePosition.scale;
//   //   const mousePointTo = {
//   //     x: pointerPosition.x / oldScale - this.stagePosition.x / oldScale,
//   //     y: pointerPosition.y / oldScale - this.stagePosition.y / oldScale,
//   //   };

//   //   let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
//   //   if (newScale < 0.5) {
//   //     newScale = 0.5;
//   //   }
//   //   if (newScale > 2.5) {
//   //     newScale = 2.5;
//   //   }

//   //   const newX = -(mousePointTo.x - pointerPosition.x / newScale) * newScale;
//   //   const newY = -(mousePointTo.y - pointerPosition.y / newScale) * newScale;

//   //   this.stagePosition.x = newX;
//   //   this.stagePosition.y = newY;
//   //   this.stagePosition.scale = newScale;

//   //   this.adjustStagePosition(this.stagePosition, this.container);
//   //   this.stationViewKonva.adjustStationPosition(this.stagePosition);

//   //   this.updateShape();
//   //   this.selectionGroupManager.updateShape();
//   //   this.timeGridKonva.updateShape();
//   // }

//   // private onMousedown(e: Konva.KonvaEventObject<MouseEvent>) {
//   //   if (e.evt.button === 2) {
//   //     this.stage.startDrag();
//   //   }
//   // }

//   // private onDragmove(e: Konva.KonvaEventObject<DragEvent>) {
//   //   const stage = e.target;
//   //   if (stage.id() !== 'mainStage') return;

//   //   this.stagePosition.x = stage.x();
//   //   this.stagePosition.y = stage.y();
//   //   this.stagePosition.scale = stage.scaleX();

//   //   this.adjustStagePosition(this.stagePosition, this.container);
//   //   this.stationViewKonva.adjustStationPosition(this.stagePosition);

//   //   this.updateShape();
//   //   this.selectionGroupManager.updateShape();
//   //   this.timeGridKonva.updateShape();
//   // }

//   updateShape() {
//     this.stage.x(this.stagePosition.x);
//     this.stage.y(this.stagePosition.y);
//     this.stage.width(this.stagePosition.width);
//     this.stage.height(this.stagePosition.height);
//     this.stage.scaleX(this.stagePosition.scale);
//     this.stage.scaleY(this.stagePosition.scale);
//   }

//   updateStationPositions() {
//     this.selectionGroupManager.updateIsExpanded();
//     this.selectionGroupManager.updateShape();
//     this.timeGridKonva.updateShape();
//     this.trainCollectionKonva.updateShape();
//     this.drawingTrainLineKonva.updateShape();
//     this.operationCollectionKonva.updateShape();
//     this.stationLineCollectionKonva.updateShape();
//   }

//   // private adjustStagePosition(stage: StagePosition, container: HTMLDivElement) {
//   //   const containerWidth = container.clientWidth;
//   //   const scale = stage.scale;
//   //   const stageX = stage.x;
//   //   const stageRight = stageX + virtualCanvasWidth * scale;

//   //   if (stageX > 0) {
//   //     stage.x = 0;
//   //   }
//   //   if (stageRight < containerWidth) {
//   //     stage.x = containerWidth - virtualCanvasWidth * scale;
//   //   }

//   //   const containerHeight = container.clientHeight;
//   //   const stageY = stage.y;
//   //   const stageBottom = stageY + virtualCanvasHeight * scale;

//   //   if (stageY > 0) {
//   //     stage.y = 0;
//   //   }
//   //   if (stageBottom < containerHeight) {
//   //     stage.y = containerHeight - virtualCanvasHeight * scale;
//   //   }
//   // }

//   copySelections() {
//     this.selectionGroupManager.copySelections();
//   }
//   pasteTrains() {
//     const newTrains = pasteTrains(this.diagramProps);
//     this.trainCollectionKonva.updateShape();
//     this.trainCollectionKonva.addSelectedTrains(newTrains);
//   }
//   deleteSelections() {
//     this.selectionGroupManager.deleteSelections();
//     this.trainCollectionKonva.updateShape();
//   }
//   moveSelections(offsetX: number, offsetY: number) {
//     this.selectionGroupManager.moveSelections(offsetX);
//   }
// }

// export class MainViewKonvaManager_ {
//   public stageKonva: StageKonva_;

//   constructor(
//     container: HTMLDivElement,
//     diagramProps: DiagramProps,
//     viewStateManger: ViewStateManager,
//     stationViewKonva: StationViewKonva
//   ) {
//     const minTime = Math.min(
//       ...(diagramProps.inboundTrains
//         .map((train) => train.diaTimes.map((diaTime) => [diaTime.arrivalTime, diaTime.departureTime]).flat())
//         .concat(
//           diagramProps.outboundTrains.map((train) =>
//             train.diaTimes.map((diaTime) => [diaTime.arrivalTime, diaTime.departureTime]).flat()
//           )
//         )
//         .flat()
//         .filter((t) => t != null) as number[])
//     );

//     this.stageKonva = new StageKonva_(minTime, diagramProps, viewStateManger, container, stationViewKonva);

//     const fitStageIntoParentContainer = () => {
//       const clientWidth = document.documentElement.clientWidth - 30; /* この値はなんとかして設定する */
//       container.style.width = clientWidth + 'px';
//       this.stageKonva.width = clientWidth;
//     };

//     fitStageIntoParentContainer();

//     // ウィンドウリサイズ時にサイズを合わせる
//     window.addEventListener('resize', fitStageIntoParentContainer);
//   }

//   copySelections() {
//     this.stageKonva.copySelections();
//   }
//   pasteTrains() {
//     this.stageKonva.pasteTrains();
//   }
//   deleteSelections() {
//     this.stageKonva.deleteSelections();
//   }
//   moveSelections(offsetX: number, offsetY: number) {
//     this.stageKonva.moveSelections(offsetX, offsetY);
//   }
// }

// export type StageKonvaProps = DeepReadonly<{
//   minTIme: number;
// }>;

function areOverlapped(linePoints: number[], rect: RectState) {
  // rectの頂点の配列
  const width = rect.width !== 0 ? rect.width : 0.001;
  const height = rect.height !== 0 ? rect.height : 0.001;

  const rectPoints = [
    { x: rect.x, y: rect.y },
    { x: rect.x + width, y: rect.y },
    { x: rect.x + width, y: rect.y + height },
    { x: rect.x, y: rect.y + height },
  ];
  const rectPolygon = new Polygon(rectPoints);

  const segments = [];
  let previousPoint = { x: linePoints[0], y: linePoints[1] };
  for (let i = 2; i < linePoints.length; i += 2) {
    const currentPoint = { x: linePoints[i], y: linePoints[i + 1] };
    segments.push([previousPoint, currentPoint]);
    previousPoint = currentPoint;
  }

  for (const segment of segments) {
    const overlapped = sat(rectPolygon, new Polygon(segment));
    if (overlapped) {
      return true;
    }
  }

  return false;
}

function getOverlappedTrains(
  diagramProps: DeepReadonly<DiagramProps>,
  stationMap: DeepReadonly<Map<string, StationLike>>,
  viewState: DeepReadonly<ViewState>,
  trains: DeepReadonly<Train[]>,
  dragRectState: RectState
) {
  const overlappedTrains = trains.filter((train) => {
    const direction = getDirection(diagramProps.timetable, train.trainId);
    const points = createPositionDiaTimeMap(stationMap, viewState, train.diaTimes, direction)
      .map(({ x, y }) => [x, y])
      .flat();
    return areOverlapped(points, dragRectState);
  });

  return overlappedTrains;
}

function getTrainsWithinDragged(
  diagramProps: DeepReadonly<DiagramProps>,
  stationMap: DeepReadonly<Map<string, StationLike>>,
  viewState: DeepReadonly<ViewState>,
  trains: DeepReadonly<Train[]>,
  dragRectState: DragRectKonvaProps
) {
  if (dragRectState.isDragging) {
    const rectState = {
      x: dragRectState.dragStartX,
      y: dragRectState.dragStartY,
      width: dragRectState.width,
      height: dragRectState.height,
    };
    return getOverlappedTrains(diagramProps, stationMap, viewState, trains, rectState);
  }
  return [];
}

export type MainViewKonvaProps = DeepReadonly<{
  diagramProps: DiagramProps;
  clientWidth: number;
  clientHeight: number;
  minTime: number;
}>;

function getStageTarget(target: Konva.Stage | Shape<Konva.ShapeConfig>) {
  if ((target instanceof Konva.Text || target instanceof Konva.Line) && target.id().substring(0, 10) === 'grid-line-') {
    target = nn(target.getStage());
  }
  return target;
}

function commitDrawingLine(
  drawingLineTimes: DeepReadonly<{ stationId: string; platformId: string; time: number }[]>,
  stations: DeepReadonly<StationLike[]>,
  diagramProps: DeepReadonly<DiagramProps>,
  allTrains: DeepReadonly<Map<string, Train>>
): void {
  if (drawingLineTimes.length >= 2) {
    const diaTimes = getDiaTimeFromDrawingTrainLine(drawingLineTimes, diagramProps);
    const direction = getDirectionOfDrawingTrainLine(drawingLineTimes, stations);
    const trains = (
      direction === 'Inbound' ? diagramProps.timetable.inboundTrainIds : diagramProps.timetable.outboundTrainIds
    ).map((trainId) => nn(allTrains.get(trainId)));

    const newTrain: Train = {
      trainId: generateId(),
      trainName: '',
      trainType: undefined,
      diaTimes: diaTimes,
      trainCode: getNewTrainCode(trains),
      firstStationOperation: getDefaultConnectionType(),
      lastStationOperation: getDefaultConnectionType(),
    };

    newTrain.diaTimes = fillMissingTimes(
      newTrain.diaTimes,
      stations.map((s) => s.stationId)
    );

    diagramProps.crudTrain.addTrain(newTrain, direction);
  }
}

export function MainViewKonva(props: MainViewKonvaProps, ref: any) {
  const { diagramProps } = props;

  const [stageState, setStageState] = useRecoilState(stageStateAtom);
  const secondWidth = useRecoilValue(secondWidthAtom);
  const [dragRectState, setDragRectState] = useState({
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    width: 0,
    height: 0,
  });
  const viewState = useViewStateValues();
  const trains = useRecoilValue(allTrainsMapAtom);
  const [selectedTrainIds, setSelectedTrainIds] = useRecoilState(selectedTrainIdsAtom);

  const [dragStartStagePosition, setDragStartStagePosition] = useState<Point | null>(null);
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
  const [dragStartPointWithOffset, setDragStartPointWithOffset] = useState<Point | null>(null);
  const stationMap = useRecoilValue(stationMapSelector);
  const stationCanvasWidth = useRecoilValue(stationCanvasWidthAtom);
  const virtualCanvasHeight = useRecoilValue(virtualCanvasHeightSelector);
  const [drawingLineTimes, setDrawingLineTimes] = useRecoilState(drawingTrainLineAtom);
  const stations = useRecoilValue(stationsAtom);

  useEffect(() => {
    const fitStageIntoParentContainer = () => {
      const clientWidth = document.documentElement.clientWidth - stationCanvasWidth - 40;
      setStageState((state) => ({ ...state, width: clientWidth }));
    };

    fitStageIntoParentContainer();

    // ウィンドウリサイズ時にサイズを合わせる
    window.addEventListener('resize', fitStageIntoParentContainer);

    setStageState((state) => ({
      ...state,
      x: Math.min(0, -(props.minTime - 10 * 60) * secondWidth * stageState.scale),
    }));

    return () => {
      window.removeEventListener('resize', fitStageIntoParentContainer);
    };
  }, []);

  const stageRef = useRef<Konva.Stage>(null);
  const mouseEventManager = getMouseEventManager();

  useEffect(() => {
    if (stageRef.current !== null) {
      mouseEventManager.setStage(stageRef.current);
    }
  }, [stageRef.current]);

  mouseEventManager.registerClickHandler('mainStage', (e, target) => {
    target = getStageTarget(target);

    if (target instanceof Konva.Stage) {
      if (e.evt.button === 0) {
        if (selectedTrainIds.length > 0) {
          setSelectedTrainIds([]);
        }

        if (drawingLineTimes.isDrawing) {
          const mousePosition = getPointerPosition(target);
          const newTime = getPositionToTime(mousePosition.x, secondWidth);
          const stationOrPlatform = getPlatformUnderCursor(mousePosition.y, stationMap, viewState);
          if (stationOrPlatform !== null) {
            handleDrawingTrainLine(stationOrPlatform, newTime, setDrawingLineTimes, stationMap);
          }
        }
      }
    }
  });

  mouseEventManager.registerDblClickHandler('mainStage', (e, target) => {
    target = getStageTarget(target);

    if (target instanceof Konva.Stage) {
      console.log('mousemove', { target });
      if (drawingLineTimes.isDrawing) {
        {
          const mousePosition = getPointerPosition(target);
          const newTime = getPositionToTime(mousePosition.x, secondWidth);
          const stationOrPlatform = getPlatformUnderCursor(mousePosition.y, stationMap, viewState);
          if (stationOrPlatform !== null) {
            handleDrawingTrainLine(stationOrPlatform, newTime, setDrawingLineTimes, stationMap);
          }
        }

        commitDrawingLine(drawingLineTimes.drawingLineTimes, stations, diagramProps, trains);

        setDrawingLineTimes({ isDrawing: false, drawingLineTimes: [], tempDrawingLineTime: null });
      } else {
        const mousePosition = getPointerPosition(target);
        const newTime = getPositionToTime(mousePosition.x, secondWidth);
        const stationOrPlatform = getPlatformUnderCursor(mousePosition.y, stationMap, viewState);
        if (stationOrPlatform !== null) {
          handleDrawingTrainLine(stationOrPlatform, newTime, setDrawingLineTimes, stationMap);
        }
      }
    }
  });

  mouseEventManager.registerMousemoveHandler('mainStage', (e, target) => {
    target = getStageTarget(target);

    if (target instanceof Konva.Stage && drawingLineTimes.isDrawing) {
      const mousePosition = getPointerPosition(target);
      const newTime = getPositionToTime(mousePosition.x, secondWidth);
      const stationOrPlatform = getPlatformUnderCursor(mousePosition.y, stationMap, viewState);
      if (stationOrPlatform !== null) {
        setTemporaryTime(stationOrPlatform, newTime, setDrawingLineTimes, stationMap);
      } else if (drawingLineTimes.tempDrawingLineTime !== null) {
        setDrawingLineTimes((prev) => ({ ...prev, tempDrawingLineTime: null }));
      }
    }
  });

  mouseEventManager.registerDragStartHandler('mainStage', (e, target) => {
    if (e.evt.button === 2) {
      if (stageRef.current !== null) {
        setDragStartStagePosition({ x: stageRef.current.x(), y: stageRef.current!.y() });
        const stagePointer = stageRef.current.getPointerPosition()!;
        setDragStartPoint({ x: stagePointer.x, y: stagePointer.y });
      }
    } else if (target instanceof Konva.Stage) {
      if (e.evt.button === 0) {
        setDragStartPointWithOffset(getPointerPosition(target));
      }
    }
  });

  mouseEventManager.registerDragMoveHandler('mainStage', (e, target) => {
    if (dragStartStagePosition !== null && stageRef.current !== null) {
      // ステージのドラッグ
      const stagePointer = stageRef.current.getPointerPosition()!;
      const dragPoint = { x: stagePointer.x, y: stagePointer.y };

      setStageState((prev) => {
        const newStagePosition = { ...prev };
        if (dragStartStagePosition !== null && dragStartPoint != null) {
          newStagePosition.x = dragStartStagePosition!.x + (dragPoint.x - dragStartPoint.x);
          newStagePosition.y = dragStartStagePosition!.y + (dragPoint.y - dragStartPoint.y);
        }

        return adjustStagePosition(newStagePosition);
      });
    } else if (target instanceof Konva.Stage) {
      // 範囲選択
      if (dragStartPointWithOffset !== null) {
        const dragEndPoint = getPointerPosition(target);

        setDragRectState({
          isDragging: true,
          dragStartX: dragStartPointWithOffset.x,
          dragStartY: dragStartPointWithOffset.y,
          width: dragEndPoint.x - dragStartPointWithOffset.x,
          height: dragEndPoint.y - dragStartPointWithOffset.y,
        });
      }
    }
  });

  mouseEventManager.registerDragEndHandler('mainStage', (e) => {
    if (dragRectState.isDragging) {
      const rectSelectedTrains = getTrainsWithinDragged(
        diagramProps,
        stationMap,
        viewState,
        [...trains.values()],
        dragRectState
      );

      setSelectedTrainIds(rectSelectedTrains.map((train) => train.trainId));
    }

    setDragStartStagePosition(null);
    setDragStartPoint(null);
    setDragStartPointWithOffset(null);

    setDragRectState({
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      width: 0,
      height: 0,
    });
  });

  const adjustStagePosition = (stage_: StagePosition) => {
    const stage = { ...stage_ };

    const containerWidth = props.clientWidth;
    const scale = stage.scale;
    const stageX = stage.x;
    const stageRight = stageX + virtualCanvasWidth * scale;

    if (stageX > 0) {
      stage.x = 0;
    }
    if (stageRight < containerWidth) {
      stage.x = containerWidth - virtualCanvasWidth * scale;
    }

    const containerHeight = props.clientHeight;
    const stageY = stage.y;
    const stageBottom = stageY + virtualCanvasHeight * scale;

    if (stageY > 0) {
      stage.y = 0;
    }
    if (stageBottom < containerHeight) {
      stage.y = containerHeight - virtualCanvasHeight * scale;
    }
    if (stage.y > 0) {
      stage.y = 0;
    }

    return stage;
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const scaleBy = 1.1;
    const pointerPosition = e.target.getStage()?.getPointerPosition();
    if (pointerPosition == null) return;

    const oldScale = stageState.scale;
    const mousePointTo = {
      x: pointerPosition.x / oldScale - stageState.x / oldScale,
      y: pointerPosition.y / oldScale - stageState.y / oldScale,
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

    setStageState((prev) =>
      adjustStagePosition({
        ...prev,
        x: newX,
        y: newY,
        scale: newScale,
      })
    );
  };

  return (
    <Stage
      ref={stageRef}
      onWheel={onWheel}
      id='mainStage'
      x={stageState.x}
      y={stageState.y}
      scaleX={stageState.scale}
      scaleY={stageState.scale}
      width={stageState.width}
      height={stageState.height}
    >
      {/* time and station grid */}
      <Layer>
        <TimeGridKonva layerHeight={virtualCanvasHeight} />
        <StationLineCollectionKonva />
      </Layer>
      {/* object */}
      <Layer>
        <TrainCollectionKonva mouseEventManager={mouseEventManager} diagramProps={diagramProps} />
        <OperationCollectionKonva diagramProps={diagramProps} />
        <DrawingTrainLineKonva diagramProps={diagramProps} />
        <DragRectKonva
          isDragging={dragRectState.isDragging}
          dragStartX={dragRectState.dragStartX}
          dragStartY={dragRectState.dragStartY}
          width={dragRectState.width}
          height={dragRectState.height}
        />
      </Layer>
    </Stage>
  );
}

function getStationIdAndPlatformId(
  stationOrPlatform: { platform: PlatformLike; stationId: null } | { platform: null; stationId: string },
  stationMap: DeepReadonly<Map<string, StationLike>>
): { stationId: string; platformId: string } {
  let stationId: string;
  let platformId: string;
  if (stationOrPlatform.stationId !== null) {
    stationId = stationOrPlatform.stationId;
    platformId = getDefaultPlatform(stationId, stationMap);
  } else {
    stationId = stationOrPlatform.platform.stationId;
    platformId = stationOrPlatform.platform.platformId;
  }

  return { stationId, platformId };
}

function setTemporaryTime(
  stationOrPlatform: { platform: PlatformLike; stationId: null } | { platform: null; stationId: string },
  newTime: number,
  setDrawingLineTimes: SetterOrUpdater<DrawingTrainLine>,
  stationMap: DeepReadonly<Map<string, StationLike>>
): void {
  setDrawingLineTimes((prev) => {
    return produce(prev, (next) => {
      if (!prev.isDrawing) return next;

      const { stationId, platformId } = getStationIdAndPlatformId(stationOrPlatform, stationMap);

      if (!canAddNewTime(next, stationId, platformId, newTime)) {
        return next;
      }

      next.tempDrawingLineTime = {
        stationId,
        platformId,
        time: newTime,
      };
      return next;
    });
  });
}

function handleDrawingTrainLine(
  stationOrPlatform: { platform: PlatformLike; stationId: null } | { platform: null; stationId: string },
  newTime: number,
  setDrawingLineTimes: SetterOrUpdater<DrawingTrainLine>,
  stationMap: DeepReadonly<Map<string, StationLike>>
): void {
  setDrawingLineTimes((prev) => {
    return produce(prev, (next) => {
      const { stationId, platformId } = getStationIdAndPlatformId(stationOrPlatform, stationMap);
      if (!canAddNewTime(next, stationId, platformId, newTime)) return next;

      if (!next.isDrawing) {
        // 新規に列車を作る
        next.drawingLineTimes = [
          {
            stationId,
            platformId,
            time: newTime,
          },
        ];
        next.isDrawing = true;
      } else {
        next.drawingLineTimes.push({
          stationId: stationId,
          platformId: platformId,
          time: newTime,
        });
      }

      return next;
    });
  });
}

function canAddNewTime(next: DrawingTrainLine, stationId: string, platformId: string, newTime: number): boolean {
  // 整合性チェック
  const isStationValid = () => {
    if (next.drawingLineTimes.length === 0) return true;

    const lastDrawingLineTime = next.drawingLineTimes[next.drawingLineTimes.length - 1];
    if (lastDrawingLineTime.stationId === stationId && lastDrawingLineTime.platformId === platformId) {
      // 直前と同じ駅を選択している
      if (next.drawingLineTimes.length === 1) return true; // 発車時刻として追加

      const lastLastDrawingLineTime = next.drawingLineTimes[next.drawingLineTimes.length - 2];
      if (lastDrawingLineTime.stationId !== lastLastDrawingLineTime.stationId) return true; // 発車時刻として追加

      return false;
    }

    if (next.drawingLineTimes.some((drawingLineTime) => drawingLineTime.stationId === stationId)) {
      // その他で既に同じ駅が追加されている
      return false;
    }

    return true;
  };

  if (!isStationValid()) return false;

  if (next.drawingLineTimes.length >= 2) {
    const lastTime = next.drawingLineTimes[next.drawingLineTimes.length - 1].time;

    if (next.drawingLineTimes[1].time < next.drawingLineTimes[0].time) {
      // 時間が少なくなる方向に線を引いている
      if (newTime > lastTime) {
        // 既に線に追加されている駅の時刻よりも遅い時刻を追加しようとしている
        return false;
      }
    } else {
      if (lastTime > newTime) {
        // 既に線に追加されている駅の時刻よりも早い時刻を追加しようとしている
        return false;
      }
    }
  }

  return true;
}

function getDefaultPlatform(stationId: string, stationMap: DeepReadonly<Map<string, StationLike>>): string {
  const station = nn(stationMap.get(stationId));
  return station.platforms[0].platformId;
}
