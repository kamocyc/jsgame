import Konva from 'konva';
import { Stage } from 'konva/lib/Stage';
import { Station } from '../../model';

function drawStations(
  layer: Konva.Layer,
  stationPositions: (Station & { diagramPosition: number })[],
  canvasWidth: number
) {
  const stations = new Konva.Group();
  layer.add(stations);

  for (const stationPosition of stationPositions) {
    const station = new Konva.Group();
    stations.add(station);

    const stationText = new Konva.Text({
      x: 0,
      y: stationPosition.diagramPosition - 20,
      text: stationPosition.stationName,
      fontSize: 20,
      fontFamily: 'Calibri',
      fill: 'black',
    });
    station.add(stationText);

    const stationLine = new Konva.Line({
      points: [0, stationPosition.diagramPosition, canvasWidth, stationPosition.diagramPosition],
      stroke: 'black',
      strokeWidth: 1,
    });
    station.add(stationLine);
  }
}

export class StationKonvaManager {
  private stage: Stage;
  private stationPositions: (Station & { diagramPosition: number })[];

  constructor(container: HTMLDivElement, canvasWidth: number, diaStations: Station[]) {
    const stage = new Konva.Stage({
      container: container,
      width: canvasWidth,
      height: 1000, // dummy
    });

    const layer = new Konva.Layer({ id: 'station-layer' });
    stage.add(layer);

    this.stationPositions = diaStations.map((station, index) => ({
      ...station,
      diagramPosition: index * 50 + 50,
    }));

    drawStations(layer, this.stationPositions, canvasWidth * 2);

    this.stage = stage;
  }

  adjustStationPosition(diagramStage: Stage) {
    const y = diagramStage.y();
    const scale = diagramStage.scaleX();

    this.stage.height(diagramStage.height());
    this.stage.x(0);
    this.stage.y(y);

    console.log({ y, scale });

    for (let i = 0; i < this.stationPositions.length; i++) {
      this.stationPositions[i].diagramPosition = (i * 50 + 50) * scale;
    }
    this.stage.findOne('#station-layer').destroy();
    const layer = new Konva.Layer({ id: 'station-layer' });
    this.stage.add(layer);

    drawStations(this.stage.findOne('#station-layer'), this.stationPositions, this.stage.width() * 2);

    this.stage.draw();
  }
}
