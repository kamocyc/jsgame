import Konva from 'konva';
import { AppClipboard, Operation, Point, Station, Train } from '../../model';
import { Polygon, sat } from '../../sat';

export interface DiagramProps {
  diaStations: Station[];
  setUpdate: () => void;
  inboundTrains: Train[];
  outboundTrains: Train[];
  operations: Operation[];
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
}

export const hitStrokeWidth = 10;

let editMode: 'Edit' | 'Create' = 'Edit';

export interface StationPosition {
  station: Station;
  diagramPosition: number;
}

export interface TrainSelection {
  shape: Konva.Line;
  lineGroup: Konva.Group;
  train: Train;
}
export interface DiagramState {
  // props: DiagramProps;
  // stationCanvasWidth: number;
  // stationCanvas: HTMLCanvasElement;
  // mainCanvas: HTMLCanvasElement;
  layer: Konva.Layer;
  stationPositions: { station: Station; diagramPosition: number }[];
  secondWidth: number;
  // 線を伸ばしている途中の線
  drawingLine: Konva.Line | null;
  drawingLineTimes: { station: Station; time: number }[];
  selections: TrainSelection[];
  selectionGroup: Konva.Group;
  dragStartPoint: Point | null;
  dragRect: Konva.Rect | null;
}

export const diagramState: DiagramState = {
  drawingLine: null,
  drawingLineTimes: [],
  layer: null as any,
  stationPositions: [],
  secondWidth: 0,
  selections: [],
  selectionGroup: new Konva.Group({
    draggable: true,
  }),
  dragStartPoint: null,
  dragRect: null,
};

function areOverlapped(rect: Konva.Rect, trainLine: Konva.Line) {
  // rectの頂点の配列
  const width = rect.width() !== 0 ? rect.width() : 0.001;
  const height = rect.height() !== 0 ? rect.height() : 0.001;

  const rectPoints = [
    { x: rect.x(), y: rect.y() },
    { x: rect.x() + width, y: rect.y() },
    { x: rect.x() + width, y: rect.y() + height },
    { x: rect.x(), y: rect.y() + height },
  ];
  const rectPolygon = new Polygon(rectPoints);

  const segments = [];
  let previousPoint = { x: trainLine.points()[0] + trainLine.x(), y: trainLine.points()[1] + trainLine.y() };
  for (let i = 2; i < trainLine.points().length; i += 2) {
    const currentPoint = { x: trainLine.points()[i] + trainLine.x(), y: trainLine.points()[i + 1] + trainLine.y() };
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

export function getOverlappedTrainLines(rect: Konva.Rect) {
  const { layer } = diagramState;
  const trainLines: Konva.Line[] = layer.find('.trainLine');
  const overlappedTrainLines = trainLines.filter((trainLine) => areOverlapped(rect, trainLine as Konva.Line));
  return overlappedTrainLines;
}
