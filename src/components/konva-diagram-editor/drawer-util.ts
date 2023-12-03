import { DeepReadonly } from 'ts-essentials';
import { OperationError, RailwayLine } from '../../mapEditorModel';
import { AppClipboard, CrudTrain, StationLike, Train } from '../../model';
import { OutlinedTimetable } from '../../outlinedTimetableData';

export type DiagramProps = DeepReadonly<{
  stationIds: string[];
  stations: Map<string, StationLike>;
  crudTrain: CrudTrain;
  inboundTrains: readonly Train[];
  outboundTrains: readonly Train[];
  trains: Map<string, Train>;
  setTrains: (f: (trains: Map<string, Train>) => void) => void;
  timetable: OutlinedTimetable;
  clipboard: AppClipboard;
  railwayLine: RailwayLine;
  errors: readonly OperationError[];
  setClipboard: (clipboard: AppClipboard) => void;
  getTrainsWithDirections: () => DeepReadonly<[Train[], Train[]]>;
}>;

export const hitStrokeWidth = 10;

// let editMode: 'Edit' | 'Create' = 'Edit';

export interface StationPosition {
  stationId: string;
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
