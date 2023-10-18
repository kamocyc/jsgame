import { copyTrains, pasteTrains } from './diagram-core';
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
    this.mainKonva.stageKonva.selectionGroupManager.destroySelections();
    copyTrains(
      this.diagramProps,
      this.mainKonva.stageKonva.selectionGroupManager.getSelections().map((s) => s.train)
    );
  }

  pasteTrains() {
    const newTrains = pasteTrains(props);
    updateTrains(diagramState.layer, newTrains);
  }

  deleteSelections() {
    destroySelections(diagramState.selections);
    const trains = diagramState.selections.map((s) => s.train);
    deleteTrains(props, trains);
    updateDeleteTrains(diagramState.layer, trains);
  }
}
