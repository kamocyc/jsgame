import { forwardRef } from 'react';
import { Group, Line } from 'react-konva';
import { useRecoilValue } from 'recoil';
import { DeepReadonly } from 'ts-essentials';
import { assert, nn, upto } from '../../common';
import { StationLike } from '../../model';
import { DiagramProps, hitStrokeWidth } from './drawer-util';
import {
  gridColor,
  isStationExpandedAtom,
  stageStateAtom,
  stationPositionsAtom,
  virtualCanvasWidth,
} from './konva-util';
import { getPlatformPositions } from './station-view-konva';

// export class StationLineKonva {
//   private stationLine: Konva.Line;
//   private readonly platformGroup: Konva.Group;

//   constructor(
//     private context: DiagramKonvaContext,
//     private station: StationLike,
//     private drawingTrainLineKonva: DrawingTrainLineKonva
//   ) {
//     this.stationLine = new Konva.Line({
//       stroke: gridColor,
//       strokeWidth: 1,
//       hitStrokeWidth: hitStrokeWidth,
//       id: generateKonvaId(),
//     });
//     this.stationLine.on('mouseover', this.onMouseover.bind(this));
//     this.stationLine.on('click', this.onClick.bind(this));

//     this.platformGroup = this.createPlatformShapes(this.station, virtualCanvasWidth);
//     this.context.topLayer.add(this.platformGroup);
//     this.context.topLayer.add(this.stationLine);

//     this.updateShape();
//   }

//   private createPlatformShapes(station: StationLike, width: number): Konva.Group {
//     const platforms = station.platforms;
//     const [platformPositions, lastLinePosition] = getPlatformPositions(platforms);
//     const platformShapes: Konva.Shape[] = [];
//     for (let platformIndex = 0; platformIndex < platforms.length; platformIndex++) {
//       const platformPosition = platformPositions[platformIndex];
//       const platformLine = new Konva.Line({
//         points: [0, platformPosition, width, platformPosition],
//         stroke: gridColor,
//         strokeWidth: 1,
//         id: generateKonvaId(),
//       });
//       platformShapes.push(platformLine);
//     }

//     const platformLine = new Konva.Line({
//       points: [0, lastLinePosition, width, lastLinePosition],
//       stroke: gridColor,
//       strokeWidth: 1,
//       id: generateKonvaId(),
//     });
//     platformShapes.push(platformLine);

//     const group = new Konva.Group({
//       id: generateKonvaId(),
//       visible: false,
//     });
//     group.add(...platformShapes);
//     return group;
//   }

//   onMouseover(e: Konva.KonvaEventObject<MouseEvent>) {
//     if (this.drawingTrainLineKonva.getIsDrawing()) {
//       const mousePosition = getPointerPosition(e.target.getStage()!);
//       const newTime = this.context.viewStateManager.getPositionToTime(mousePosition.x);
//       this.drawingTrainLineKonva.addStationTemporarily(this.station, newTime);
//     }
//   }

//   onClick(e: Konva.KonvaEventObject<MouseEvent>) {
//     this.context.selectionGroupManager.destroySelections();

//     if (e.evt.button === 2) {
//       // 右クリック => 別のところでハンドリングしている
//       return;
//     }

//     const mousePosition = getPointerPosition(e.target.getStage()!);
//     const newTime = this.context.viewStateManager.getPositionToTime(mousePosition.x);
//     if (!this.drawingTrainLineKonva.getIsDrawing()) {
//       this.drawingTrainLineKonva.startDrawing(this.station, newTime);
//     } else {
//       this.drawingTrainLineKonva.addStation(this.station, newTime);
//     }
//   }

//   updateShape() {
//     const diagramPosition = this.context.viewStateManager.getStationPosition(this.station.stationId);
//     assert(diagramPosition != null);
//     this.stationLine.points([0, diagramPosition, virtualCanvasWidth, diagramPosition]);

//     if (this.context.viewStateManager.isStationExpanded(this.station.stationId)) {
//       this.platformGroup.y(diagramPosition);
//       this.platformGroup.visible(true);
//     } else {
//       this.platformGroup.visible(false);
//     }
//   }
// }

// 路線追加のイベントハンドラなどやりたい

export type StationPlatformLineKonvaProps = DeepReadonly<{
  station: StationLike;
}>;
export const StationPlatformLineKonva = forwardRef(function StationPlatformLineKonva(
  props: StationPlatformLineKonvaProps,
  ref: any
) {
  const { station } = props;
  const stageState = useRecoilValue(stageStateAtom);
  const stationPositions = useRecoilValue(stationPositionsAtom);
  const platforms = props.station.platforms;
  const [platformPositions, lastLinePosition] = getPlatformPositions(platforms);
  const stationPosition = nn(stationPositions.find((p) => p.stationId === station.stationId)).diagramPosition;

  return (
    <Group y={stationPosition}>
      {upto(platforms.length).map((platformIndex) => {
        const platformPosition = platformPositions[platformIndex];
        return (
          <Line
            key={platformIndex}
            points={[0, platformPosition, virtualCanvasWidth, platformPosition]}
            stroke={gridColor}
            strokeWidth={1}
          />
        );
      })}
      <Line points={[0, lastLinePosition, virtualCanvasWidth, lastLinePosition]} stroke={gridColor} strokeWidth={1} />
    </Group>
  );
});

export type StationLineKonvaProps = DeepReadonly<{
  station: StationLike;
}>;
export const StationLineKonva = forwardRef(function StationLineKonva(props: StationLineKonvaProps, ref: any) {
  const station = props.station;
  const isStationExpandedMap = useRecoilValue(isStationExpandedAtom);
  const isStationExpanded = isStationExpandedMap.get(station.stationId) ?? false;
  const stationPositions = useRecoilValue(stationPositionsAtom);
  const diagramPosition = stationPositions.find((x) => x.stationId === station.stationId)?.diagramPosition;
  assert(diagramPosition != null);

  return (
    <>
      <Line
        points={[0, diagramPosition, virtualCanvasWidth, diagramPosition]}
        stroke={gridColor}
        strokeWidth={1}
        hitStrokeWidth={hitStrokeWidth}
      />
      {isStationExpanded ? <>{<StationPlatformLineKonva station={station} />}</> : <></>}
    </>
  );
});

export type StationLineCollectionKonvaProps = DeepReadonly<{
  diagramProps: DiagramProps;
}>;
export const StationLineCollectionKonva = forwardRef(function StationLineCollectionKonva(
  props: StationLineCollectionKonvaProps,
  ref: any
) {
  const stations = props.diagramProps.stations;

  return (
    <>
      {[...stations.values()].map((station) => {
        return <StationLineKonva key={station.stationId} station={station} />;
      })}
    </>
  );
});
