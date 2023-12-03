// import Konva from 'konva';
// import { Train } from '../../model';
// import { getDirection } from '../../outlinedTimetableData';
// import { Polygon, sat } from '../../sat';
// import { DiagramKonvaContext, RectState, createPositionDiaTimeMap } from './konva-util';

// export type TrainKonvaProps = Readonly<{ context: DiagramKonvaContext; train: Train }>;

// export function TrainKonvaComponent({ context, train }: TrainKonvaProps) {}

// export class TrainKonva_ {
//   private trainLine: Konva.Line;
//   private isSelected: boolean = false;

//   areOverlapped(rect: RectState) {
//     // rectの頂点の配列
//     const width = rect.width !== 0 ? rect.width : 0.001;
//     const height = rect.height !== 0 ? rect.height : 0.001;

//     const rectPoints = [
//       { x: rect.x, y: rect.y },
//       { x: rect.x + width, y: rect.y },
//       { x: rect.x + width, y: rect.y + height },
//       { x: rect.x, y: rect.y + height },
//     ];
//     const rectPolygon = new Polygon(rectPoints);

//     const points = this.getPoints();
//     const segments = [];
//     let previousPoint = { x: points[0], y: points[1] };
//     for (let i = 2; i < points.length; i += 2) {
//       const currentPoint = { x: points[i], y: points[i + 1] };
//       segments.push([previousPoint, currentPoint]);
//       previousPoint = currentPoint;
//     }

//     for (const segment of segments) {
//       const overlapped = sat(rectPolygon, new Polygon(segment));
//       if (overlapped) {
//         return true;
//       }
//     }

//     return false;
//   }
// }
