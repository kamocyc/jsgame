import Konva from 'konva';
import { Stage } from 'konva/lib/Stage';
import { assert, nn } from '../../common';
import { PlatformLike, StationLike } from '../../model';
import { ViewStateManager, generateKonvaId } from './konva-util';

const initialScale = 1;
const platformFontSize = 18;

export function getPlatformPositions(platforms: PlatformLike[]): number[] {
  return platforms.map((_, index) => 20 * (index + 1));
}

export class StationKonva {
  private readonly stationText: Konva.Text;
  private readonly stationLine: Konva.Line;
  private readonly expandIcon: Konva.Text;
  private readonly platformGroup: Konva.Group;
  private readonly shape: Konva.Group;
  private readonly fontSize = 20;

  constructor(
    layer: Konva.Layer,
    private readonly station: StationLike,
    private readonly viewStateManger: ViewStateManager,
    private readonly canvasWidth: number,
    private readonly stationViewKonva: StationViewKonva
  ) {
    this.stationText = new Konva.Text({
      x: 0,
      fontSize: this.fontSize,
      fontFamily: 'Calibri',
      fill: 'black',
      id: generateKonvaId(),
    });
    this.stationLine = new Konva.Line({
      stroke: 'black',
      strokeWidth: 1,
      id: generateKonvaId(),
    });
    this.expandIcon = new Konva.Text({
      x: this.canvasWidth - this.fontSize,
      y: 0,
      text: '▼',
      fontSize: this.fontSize,
      fontFamily: 'Calibri',
      fill: 'black',
      id: `${this.station.stationId}-expand-icon`,
    });
    this.platformGroup = this.createPlatformShapes(this.station);

    this.expandIcon.on('click', () => {
      const isExpanded = layer.find(`#${this.station.stationId}-expand-icon`)[0] as Konva.Text;
      assert(isExpanded != null);
      const isExpandedValue = isExpanded.text() !== '▼';
      this.expandIcon.text(isExpandedValue ? '▼' : '▶');

      viewStateManger.setStationIsExpanded(this.station.stationId, !isExpandedValue);
      if (!isExpandedValue) {
        this.shape.add(this.platformGroup);
      } else {
        this.platformGroup.remove();
      }

      this.stationViewKonva.updateStationPositions();
    });

    this.shape = new Konva.Group({
      id: generateKonvaId(),
    });
    this.shape.add(this.stationText);
    this.shape.add(this.stationLine);
    this.shape.add(this.expandIcon);
    layer.add(this.shape);

    this.updateShape();
  }

  private createPlatformShapes(station: StationLike): Konva.Group {
    const platforms = station.platforms;
    const platformShapes: Konva.Shape[] = [];
    for (let platformIndex = 0; platformIndex < platforms.length; platformIndex++) {
      const platform = platforms[platformIndex];
      const platformLine = new Konva.Line({
        stroke: 'black',
        strokeWidth: 1,
        id: `platformLine-${platform.platformId}`,
      });
      platformShapes.push(platformLine);
      const platformText = new Konva.Text({
        x: 0,
        text: platform.platformName,
        fontSize: platformFontSize,
        fontFamily: 'Calibri',
        fill: 'black',
        id: `platformText-${platform.platformId}`,
      });
      platformShapes.push(platformText);
    }

    const group = new Konva.Group({
      id: generateKonvaId(),
    });
    group.add(...platformShapes);
    return group;
  }

  updateShape() {
    const scale = this.stationViewKonva.scale;
    const stationPosition = nn(this.viewStateManger.getStationPosition(this.station.stationId)) * scale;
    this.stationText.y(stationPosition - this.fontSize);
    this.expandIcon.y(stationPosition + 2);
    this.stationText.text(this.station.stationName);
    this.stationLine.points([0, stationPosition, this.canvasWidth, stationPosition]);

    this.platformGroup.y(stationPosition);
    const platformPositions = getPlatformPositions(this.station.platforms);
    for (let i = 0; i < this.station.platforms.length; i++) {
      const line = this.platformGroup.find(`#platformLine-${this.station.platforms[i].platformId}`)[0] as Konva.Line;
      assert(line != null);
      line.points([0, platformPositions[i] * scale, this.canvasWidth, platformPositions[i] * scale]);

      const text = this.platformGroup.find(`#platformText-${this.station.platforms[i].platformId}`)[0] as Konva.Text;
      assert(text != null);
      text.y(platformPositions[i] * scale - platformFontSize);
    }
  }
}

export class StationViewKonva {
  private stage: Stage;
  scale: number;
  private stationPositionChangeHandler: (() => void) | undefined;
  private y = 0;
  private height = 1000; // dummy

  private stationKonvas: StationKonva[];

  constructor(container: HTMLDivElement, canvasWidth: number, private viewStateManger: ViewStateManager) {
    this.scale = initialScale;

    const stage = new Konva.Stage({
      container: container,
      width: canvasWidth,
      height: this.height,
      id: generateKonvaId(),
    });

    const layer = new Konva.Layer({ id: 'station-layer' });
    stage.add(layer);

    this.stationKonvas = [];
    for (const stationPosition of this.viewStateManger.getStationPositions()) {
      this.stationKonvas.push(new StationKonva(layer, stationPosition.station, viewStateManger, canvasWidth, this));
    }

    this.stage = stage;

    this.updateShape();
  }

  setStationPositionChangeHandler(handler: () => void) {
    this.stationPositionChangeHandler = handler;
  }

  updateStationPositions() {
    if (this.stationPositionChangeHandler) {
      this.stationPositionChangeHandler();
    }

    for (const stationKonva of this.stationKonvas) {
      stationKonva.updateShape();
    }
  }

  updateShape() {
    this.stage.height(this.height);
    this.stage.x(0);
    this.stage.y(this.y);

    for (const stationKonva of this.stationKonvas) {
      stationKonva.updateShape();
    }

    this.stage.draw();
  }

  adjustStationPosition(diagramStageState: DiagramStageState) {
    this.y = diagramStageState.y;
    this.height = diagramStageState.height;
    this.scale = diagramStageState.scale;

    this.updateShape();
  }
}

export interface DiagramStageState {
  y: number;
  scale: number;
  height: number;
}
