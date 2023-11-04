import { DiagramProps } from './drawer-util';
import { MainViewKonvaManager } from './stage-konva';
import { StationViewKonva } from './station-view-konva';

export class KonvaManager {
  private stationViewKonva: StationViewKonva;
  private mainKonva: MainViewKonvaManager;

  private readonly stationCanvasWidth = 100;

  constructor(stationContainer: HTMLDivElement, private diagramProps: DiagramProps, mainContainer: HTMLDivElement) {
    this.stationViewKonva = new StationViewKonva(stationContainer, this.stationCanvasWidth, diagramProps.stations);

    this.mainKonva = new MainViewKonvaManager(mainContainer, diagramProps, this.stationViewKonva);
  }

  copySelections() {
    this.mainKonva.copySelections();
  }
  pasteTrains() {
    this.mainKonva.pasteTrains();
  }
  deleteSelections() {
    this.mainKonva.deleteSelections();
  }
  moveSelections(offsetX: number, offsetY: number) {
    this.mainKonva.moveSelections(offsetX, offsetY);
  }
}
