import { AppClipboard, CrudTrain, Operation, StationLike, Train } from '../../model';

export interface DiagramProps {
  stations: StationLike[];
  crudTrain: CrudTrain;
  inboundTrains: Train[];
  outboundTrains: Train[];
  operations: Operation[];
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
}

export const hitStrokeWidth = 10;

// let editMode: 'Edit' | 'Create' = 'Edit';

export interface StationPosition {
  station: StationLike;
  diagramPosition: number;
}

// export interface TrainSelection {
//   shape: Konva.Line;
//   train: Train;
// }
// export interface DiagramState {
//   layer: Konva.Layer;
//   stationPositions: StationPosition[];
//   secondWidth: number;
//   // 線を伸ばしている途中の線
//   drawingLine: Konva.Line | null;
//   drawingLineTimes: { station: StationLike; time: number }[];
//   dragStartPoint: Point | null;
//   dragRect: Konva.Rect | null;
// }

// export const diagramState: DiagramState = {
//   drawingLine: null,
//   drawingLineTimes: [],
//   layer: null as any,
//   stationPositions: [],
//   secondWidth: 0,
//   dragStartPoint: null,
//   dragRect: null,
// };
