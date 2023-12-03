import { forwardRef } from 'react';
import { Line } from 'react-konva';
import { useRecoilValue } from 'recoil';
import { assert, nn } from '../../common';
import {
  drawingLineTimesAtom,
  getPositionFromTime,
  secondWidthAtom,
  stationPositionsAtom,
  tempDrawingLineTimeAtom,
} from './konva-util';

// export class DrawingTrainLineKonva {
//   private drawingTrainLine: Konva.Line;

//   private drawingLineTimes: { station: StationLike; time: number }[] = [];
//   private isDrawing: boolean = false;

//   private tempDrawingLineTime: { station: StationLike; time: number } | null = null;

//   constructor(private context: DiagramKonvaContext, private trainCollectionKonva: TrainCollectionKonva_) {
//     this.drawingTrainLine = new Konva.Line({
//       stroke: 'red',
//       strokeWidth: 1,
//       hitFunc: () => {},
//       id: generateKonvaId(),
//     });
//   }

//   moveShapesToTop() {
//     // この時点ではまだ登録されてない
//     // this.drawingTrainLine.moveToTop();
//   }

//   startDrawing(station: StationLike, newTime: number) {
//     this.drawingLineTimes = [
//       {
//         station: station,
//         time: newTime,
//       },
//     ];
//     this.context.topLayer.add(this.drawingTrainLine);
//     this.isDrawing = true;

//     this.updateShape();
//   }

//   getIsDrawing() {
//     return this.isDrawing;
//   }

//   addStationTemporarily(station: StationLike, newTime: number) {
//     this.tempDrawingLineTime = {
//       station: station,
//       time: newTime,
//     };

//     this.updateShape();
//   }

//   addStation(station: StationLike, newTime: number) {
//     // 整合性チェック
//     if (this.drawingLineTimes.some((drawingLineTime) => drawingLineTime.station.stationId === station.stationId)) {
//       // 既に同じ駅が追加されている。 => 分けないとデータ構造上。。
//       // TODO: 直前と同じなら、停車時間、発車時間
//       // this.commitDrawingLine();
//       return;
//     }

//     if (this.drawingLineTimes.length >= 2) {
//       const lastTime = this.drawingLineTimes[this.drawingLineTimes.length - 1].time;

//       if (this.drawingLineTimes[1].time < this.drawingLineTimes[0].time) {
//         // 時間が少なくなる方向に線を引いている
//         if (newTime > lastTime) {
//           // 既に線に追加されている駅の時刻よりも遅い時刻を追加しようとしている
//           return;
//         }
//       } else {
//         if (lastTime > newTime) {
//           // 既に線に追加されている駅の時刻よりも早い時刻を追加しようとしている
//           return;
//         }
//       }
//     }

//     this.drawingLineTimes.push({
//       station: station,
//       time: newTime,
//     });

//     this.updateShape();
//   }

//   commitDrawingLine() {
//     this.isDrawing = false;
//     this.trainCollectionKonva.commitDrawingLine(this.drawingLineTimes);
//     this.drawingLineTimes = [];
//     this.drawingTrainLine.remove();

//     this.updateShape();
//   }

//   updateShape() {
//     const points = this.drawingLineTimes
//       .concat(this.tempDrawingLineTime !== null ? [this.tempDrawingLineTime] : [])
//       .map(({ station, time }) => {
//         const stationPosition = this.context.viewStateManager.getStationPosition(station.stationId);
//         assert(stationPosition != null);
//         return [this.context.viewStateManager.getPositionFromTime(time), stationPosition];
//       })
//       .flat();
//     this.drawingTrainLine.points(points);
//   }
// }

export type DrawingTrainLineKonvaProps = {};

export const DrawingTrainLineKonva = forwardRef(function DrawingTrainLineKonvaProps(props: DrawingTrainLineKonvaProps) {
  const drawingLineTimes = useRecoilValue(drawingLineTimesAtom);
  // const isDrawing = useRecoilValue(isDrawingAtom);
  const secondWidth = useRecoilValue(secondWidthAtom);
  const stationPositions = useRecoilValue(stationPositionsAtom);
  const tempDrawingLineTime = useRecoilValue(tempDrawingLineTimeAtom);

  const points = drawingLineTimes
    .concat(tempDrawingLineTime !== null ? [tempDrawingLineTime] : [])
    .map(({ station, time }) => {
      const stationPosition = nn(stationPositions.find((s) => s.stationId === station.stationId)).diagramPosition;
      assert(stationPosition != null);
      return [getPositionFromTime(time, secondWidth), stationPosition];
    })
    .flat();

  return (
    <>
      <Line points={points} />
    </>
  );
});
