import Konva from 'konva';
import { Stage } from 'konva/lib/Stage';
import { assert } from '../../common';
import { StationLike } from '../../model';

export class StationKonva {
  private stationText: Konva.Text;
  private stationLine: Konva.Line;
  private shape: Konva.Group;

  private readonly fontSize = 20;

  constructor(
    private stationName: string,
    private stationId: string,
    private stationPosition: number,
    private canvasWidth: number
  ) {
    this.stationText = new Konva.Text({
      x: 0,
      fontSize: this.fontSize,
      fontFamily: 'Calibri',
      fill: 'black',
    });
    this.stationLine = new Konva.Line({
      stroke: 'black',
      strokeWidth: 1,
    });

    this.shape = new Konva.Group();
    this.shape.add(this.stationText);
    this.shape.add(this.stationLine);

    this.updateShape();
  }

  getShape() {
    return this.shape;
  }
  getStationId() {
    return this.stationId;
  }
  setStationPosition(stationPosition: number) {
    this.stationPosition = stationPosition;
    this.updateShape();
  }
  setStationName(stationName: string) {
    this.stationName = stationName;
    this.updateShape();
  }

  updateShape() {
    this.stationText.y(this.stationPosition - this.fontSize);
    this.stationText.text(this.stationName);
    this.stationLine.points([0, this.stationPosition, this.canvasWidth, this.stationPosition]);
  }
}

export class StationViewKonva {
  private stage: Stage;
  private stationPositions: (StationLike & { diagramPosition: number })[];

  private y = 0;
  private scale = 1;
  private height = 1000; // dummy

  private stationKonvas: StationKonva[];

  constructor(container: HTMLDivElement, canvasWidth: number, stations: StationLike[]) {
    const stage = new Konva.Stage({
      container: container,
      width: canvasWidth,
      height: this.height,
    });

    const layer = new Konva.Layer({ id: 'station-layer' });
    stage.add(layer);

    this.stationPositions = stations.map((station, index) => ({
      ...station,
      diagramPosition: index * 50 + 50,
    }));

    this.stationKonvas = [];
    for (const stationPosition of this.stationPositions) {
      this.stationKonvas.push(
        new StationKonva(
          stationPosition.stationName,
          stationPosition.stationId,
          stationPosition.diagramPosition,
          canvasWidth
        )
      );
    }

    this.stage = stage;
  }

  updateShape() {
    this.stage.height(this.height);
    this.stage.x(0);
    this.stage.y(this.y);

    for (const stationKonva of this.stationKonvas) {
      const position = this.stationPositions.find((s) => s.stationId === stationKonva.getStationId());
      assert(position != null);
      stationKonva.setStationPosition(position.diagramPosition * this.scale);
    }

    this.stage.draw();
  }

  adjustStationPosition(diagramStageState: DiagramStageState) {
    this.y = diagramStageState.y;
    this.scale = diagramStageState.scale;
    this.height = diagramStageState.height;

    this.updateShape();
  }
}

export interface DiagramStageState {
  y: number;
  scale: number;
  height: number;
}
