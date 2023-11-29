import { OperationError, RailwayLine } from '../../mapEditorModel';
import { AppClipboard, CrudTrain, StationLike, Train } from '../../model';
import { OutlinedTimetable } from '../../outlinedTimetableData';

export interface DiagramProps {
  stations: StationLike[];
  crudTrain: CrudTrain;
  inboundTrains: readonly Train[];
  outboundTrains: readonly Train[];
  timetable: OutlinedTimetable;
  clipboard: AppClipboard;
  railwayLine: RailwayLine;
  errors: readonly OperationError[];
  setClipboard: (clipboard: AppClipboard) => void;
  getTrainsWithDirections: () => [readonly Train[], readonly Train[]];
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
