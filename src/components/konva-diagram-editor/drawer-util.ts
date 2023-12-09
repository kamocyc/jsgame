import { DeepReadonly } from 'ts-essentials';
import { OperationError, RailwayLine } from '../../mapEditorModel';
import { AppClipboard, CrudTrain } from '../../model';
import { OutlinedTimetable } from '../../outlinedTimetableData';

export type DiagramProps = {
  readonly stationIds: DeepReadonly<string[]>;
  readonly crudTrain: DeepReadonly<CrudTrain>;
  readonly timetable: DeepReadonly<OutlinedTimetable>;
  readonly clipboard: AppClipboard;
  readonly railwayLine: DeepReadonly<RailwayLine>;
  readonly errors: DeepReadonly<OperationError[]>;
  readonly setClipboard: (clipboard: AppClipboard) => void;
};

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
