import Konva from 'konva';
import { forwardRef, useRef } from 'react';
import { Group, Layer, Line, Text } from 'react-konva';
import { useRecoilState, useRecoilValue } from 'recoil';
import { DeepReadonly } from 'ts-essentials';
import { nn, upto } from '../../common';
import { PlatformLike, StationLike } from '../../model';
import {
  gridColor,
  isStationExpandedAtom,
  stageStateAtom,
  stationCanvasWidthAtom,
  stationMapSelector,
  stationPositionsAtom,
} from './konva-util';

const initialScale = 1;
const platformFontSize = 18;

export function getPlatformPositions(platforms: DeepReadonly<PlatformLike[]>): [number[], number] {
  return [platforms.map((_, index) => 20 * (index + 1)), (platforms.length + 1) * 20];
}

// export class StationKonva_ {
//   private readonly stationText: Konva.Text;
//   private readonly stationLine: Konva.Line;
//   readonly expandIcon: Konva.Text;
//   private readonly platformGroup: Konva.Group;
//   private readonly shape: Konva.Group;
//   private readonly fontSize = 20;

//   constructor(
//     layer: Konva.Layer,
//     private readonly station: StationLike,
//     private readonly viewStateManger: ViewStateManager,
//     private readonly canvasWidth: number,
//     private readonly stationViewKonva: StationViewKonva_
//   ) {
//     this.stationText = new Konva.Text({
//       x: 0,
//       fontSize: this.fontSize,
//       fontFamily: 'Calibri',
//       fill: 'black',
//       id: generateKonvaId(),
//     });
//     this.stationLine = new Konva.Line({
//       stroke: gridColor,
//       strokeWidth: 1,
//       id: generateKonvaId(),
//     });
//     this.expandIcon = new Konva.Text({
//       x: this.canvasWidth - platformFontSize,
//       y: 0,
//       text: '▼',
//       fontSize: platformFontSize,
//       fontFamily: 'Calibri',
//       fill: 'black',
//       id: `${this.station.stationId}-expand-icon`,
//     });
//     this.platformGroup = this.createPlatformShapes(this.station);

//     this.shape = new Konva.Group({
//       id: generateKonvaId(),
//     });
//     this.shape.add(this.stationText);
//     this.shape.add(this.stationLine);
//     this.shape.add(this.expandIcon);
//     layer.add(this.shape);

//     this.updateShape();
//   }

//   onClick(target: Konva.Text) {
//     const isExpanded = target;
//     assert(isExpanded != null);
//     const isExpandedValue = isExpanded.text() !== '▼';
//     this.expandIcon.text(isExpandedValue ? '▼' : '▶');

//     this.viewStateManger.setStationIsExpanded(this.station.stationId, !isExpandedValue);
//     if (!isExpandedValue) {
//       this.shape.add(this.platformGroup);
//     } else {
//       this.platformGroup.remove();
//     }

//     this.stationViewKonva.updateStationPositions();
//   }

//   private createPlatformShapes(station: StationLike): Konva.Group {
//     const platforms = station.platforms;
//     const platformShapes: Konva.Shape[] = [];
//     for (let platformIndex = 0; platformIndex < platforms.length; platformIndex++) {
//       const platform = platforms[platformIndex];
//       const platformLine = new Konva.Line({
//         stroke: gridColor,
//         strokeWidth: 1,
//         id: `platformLine-${platform.platformId}`,
//       });
//       platformShapes.push(platformLine);
//       const platformText = new Konva.Text({
//         x: 0,
//         text: platform.platformName,
//         fontSize: platformFontSize,
//         fontFamily: 'Calibri',
//         fill: 'black',
//         id: `platformText-${platform.platformId}`,
//       });
//       platformShapes.push(platformText);
//     }

//     const platformLine = new Konva.Line({
//       stroke: gridColor,
//       strokeWidth: 1,
//       id: `platformLine-lastLine-${station.stationId}`,
//     });
//     platformShapes.push(platformLine);

//     const group = new Konva.Group({
//       id: generateKonvaId(),
//     });
//     group.add(...platformShapes);
//     return group;
//   }

//   updateShape() {
//     const scale = this.stationViewKonva.scale;
//     const stationPosition = nn(this.viewStateManger.getStationPosition(this.station.stationId)) * scale;
//     this.stationText.y(stationPosition - this.fontSize);
//     this.stationText.text(this.station.stationName);
//     this.expandIcon.y(stationPosition + 2);
//     this.stationLine.points([0, stationPosition, this.canvasWidth, stationPosition]);

//     this.platformGroup.y(stationPosition);
//     const [platformPositions, lastLinePosition] = getPlatformPositions(this.station.platforms);
//     for (let i = 0; i < this.station.platforms.length; i++) {
//       const line = this.platformGroup.find(`#platformLine-${this.station.platforms[i].platformId}`)[0] as Konva.Line;
//       assert(line != null);
//       line.points([0, platformPositions[i] * scale, this.canvasWidth, platformPositions[i] * scale]);

//       const text = this.platformGroup.find(`#platformText-${this.station.platforms[i].platformId}`)[0] as Konva.Text;
//       assert(text != null);
//       text.y(platformPositions[i] * scale - platformFontSize);
//     }

//     const lastLine = this.platformGroup.find(`#platformLine-lastLine-${this.station.stationId}`)[0] as Konva.Line;
//     assert(lastLine != null);
//     lastLine.points([0, lastLinePosition * scale, this.canvasWidth, lastLinePosition * scale]);
//   }
// }

// export class StationViewKonva_ {
//   private stage: Stage;
//   private readonly scaleText: Konva.Text;
//   scale: number;
//   private stationPositionChangeHandler: (() => void) | undefined;
//   private y = 0;
//   private height = 1000; // dummy

//   private stationKonvas: StationKonva[];

//   constructor(container: HTMLDivElement, canvasWidth: number, private viewStateManger: ViewStateManager) {
//     this.scale = initialScale;

//     const stage = new Konva.Stage({
//       container: container,
//       width: canvasWidth,
//       height: this.height,
//       id: generateKonvaId(),
//     });

//     const layer = new Konva.Layer({ id: 'station-layer' });
//     stage.add(layer);

//     stage.on('click', (e) => {
//       // なぜか標準では取得できないことがあったので、自前で取得する
//       const stageX = e.evt.offsetX;
//       const stageY = e.evt.offsetY - this.stage.y();
//       const target = this.stationKonvas.find((stationKonva) => {
//         const iconY = stationKonva.expandIcon.y();
//         return iconY <= stageY && stageY <= iconY + platformFontSize && stageX >= canvasWidth - platformFontSize;
//       });

//       if (target) {
//         target.onClick(target.expandIcon);
//       }
//     });

//     this.scaleText = new Konva.Text({
//       x: 0,
//       y: 0,
//       text: '',
//       fontSize: 14,
//       fontFamily: 'Calibri',
//       fill: 'black',
//       id: generateKonvaId(),
//     });
//     layer.add(this.scaleText);

//     this.stationKonvas = [];
//     for (const stationPosition of this.viewStateManger.getStationPositions()) {
//       this.stationKonvas.push(new StationKonva(layer, stationPosition.stationId, viewStateManger, canvasWidth, this));
//     }

//     this.stage = stage;

//     this.updateShape();
//   }

//   setStationPositionChangeHandler(handler: () => void) {
//     this.stationPositionChangeHandler = handler;
//   }

//   updateStationPositions() {
//     if (this.stationPositionChangeHandler) {
//       this.stationPositionChangeHandler();
//     }

//     for (const stationKonva of this.stationKonvas) {
//       stationKonva.updateShape();
//     }
//   }

//   updateShape() {
//     this.scaleText.text((this.scale * 100).toFixed(0) + '%');

//     for (const stationKonva of this.stationKonvas) {
//       stationKonva.updateShape();
//     }

//     this.stage.height(this.height);
//     this.stage.x(0);
//     this.stage.y(this.y);
//   }

//   adjustStationPosition(diagramStageState: DiagramStageState) {
//     this.y = diagramStageState.y;
//     this.height = diagramStageState.height;
//     this.scale = diagramStageState.scale;

//     this.updateShape();
//   }
// }

type Props = DeepReadonly<{
  station: StationLike;
  isStationExpanded: boolean;
  canvasWidth: number;
}>;

export const StationKonva = forwardRef<Konva.Text | null, Props>(function StationKonva(
  { station, isStationExpanded, canvasWidth }: Props,
  ref
) {
  const fontSize = 16;
  const stageState = useRecoilValue(stageStateAtom);
  const stationPositions = useRecoilValue(stationPositionsAtom);
  const scale = stageState.scale;
  const stationPosition = nn(stationPositions.find((p) => p.stationId === station.stationId)).diagramPosition * scale;
  const [platformPositions, lastLinePosition] = getPlatformPositions(station.platforms);

  return (
    <Group>
      <Text fontSize={fontSize} text={station.stationName} x={0} y={stationPosition - fontSize} />
      <Text
        fontSize={fontSize}
        text={isStationExpanded ? '▶' : '▼'}
        x={canvasWidth - platformFontSize}
        y={stationPosition + 2}
        ref={ref}
      />
      <Line points={[0, stationPosition, canvasWidth, stationPosition]} stroke={gridColor} strokeWidth={1} />
      {/* platform group */}
      {isStationExpanded ? (
        <Group y={stationPosition}>
          {upto(station.platforms.length).map((i) => {
            const platform = station.platforms[i];
            return (
              <Group key={platform.platformId}>
                <Line
                  points={[0, platformPositions[i] * scale, canvasWidth, platformPositions[i] * scale]}
                  stroke={gridColor}
                  strokeWidth={1}
                />
                <Text
                  fontSize={platformFontSize}
                  text={platform.platformName}
                  x={0}
                  y={platformPositions[i] * scale - platformFontSize + 2}
                />
              </Group>
            );
          })}
          <Line
            points={[0, lastLinePosition * scale, canvasWidth, lastLinePosition * scale]}
            stroke={gridColor}
            strokeWidth={1}
          />
        </Group>
      ) : (
        <></>
      )}
    </Group>
  );
});

// selectedTrains: string[];
// setSelectedTrains: (selectedTrains: string[]) => void;

export type StationViewKonvaProps = DeepReadonly<{}>;

export function StationViewKonva({}: StationViewKonvaProps) {
  const stationKonvaRef = useRef<(Konva.Text | null)[]>([]);
  const stationPositions = useRecoilValue(stationPositionsAtom);
  const [isStationExpanded, setIsStationExpanded] = useRecoilState(isStationExpandedAtom);
  const stationMap = useRecoilValue(stationMapSelector);
  const stationCanvasWidth = useRecoilValue(stationCanvasWidthAtom);
  const stageState = useRecoilValue(stageStateAtom);

  const stationKonvas = stationPositions.map((stationPosition, i) => {
    const station = nn(stationMap.get(stationPosition.stationId));
    return (
      <StationKonva
        ref={(el) => (stationKonvaRef.current[i] = el)}
        key={stationPosition.stationId}
        isStationExpanded={isStationExpanded.get(stationPosition.stationId) ?? false}
        station={station}
        canvasWidth={stationCanvasWidth}
      />
    );
  });

  return (
    <Layer
      onClick={(e) => {
        // なぜか標準では取得できないことがあったので、自前で取得するonClick
        const stageX = e.evt.offsetX;
        const stageY = e.evt.offsetY - stageState.y;
        const targetIndex = stationPositions.findIndex((_, i) => {
          const iconY = stationKonvaRef.current[i]?.y();
          return (
            iconY != null &&
            iconY <= stageY &&
            stageY <= iconY + platformFontSize &&
            stageX >= stationCanvasWidth - platformFontSize
          );
        });
        if (targetIndex !== -1) {
          const stationId = stationPositions[targetIndex].stationId;
          const map = new Map(isStationExpanded);
          map.set(stationId, !isStationExpanded.get(stationId));
          setIsStationExpanded(map);
        }
      }}
    >
      <Text text={(stageState.scale * 100).toFixed(0) + '%'} />
      {stationKonvas}
    </Layer>
  );
}
