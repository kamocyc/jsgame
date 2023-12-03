// import { DiagramProps } from './drawer-util';
// import { ViewStateManager } from './konva-util';
// import { MainViewKonvaManager } from './stage-konva';
// import { StationViewKonva } from './station-view-konva';

// export class KonvaManager {
//   private stationViewKonva: StationViewKonva;
//   private mainKonva: MainViewKonvaManager;

//   private readonly stationCanvasWidth = 100;

//   constructor(stationContainer: HTMLDivElement, diagramProps: DiagramProps, mainContainer: HTMLDivElement) {
//     const viewStateManger = new ViewStateManager(diagramProps.stationIds, diagramProps.stations);

//     this.stationViewKonva = new StationViewKonva(stationContainer, this.stationCanvasWidth, viewStateManger);
//     this.mainKonva = new MainViewKonvaManager(mainContainer, diagramProps, viewStateManger, this.stationViewKonva);
//   }

//   copySelections() {
//     this.mainKonva.copySelections();
//   }
//   pasteTrains() {
//     this.mainKonva.pasteTrains();
//   }
//   deleteSelections() {
//     this.mainKonva.deleteSelections();
//   }
//   moveSelections(offsetX: number, offsetY: number) {
//     this.mainKonva.moveSelections(offsetX, offsetY);
//   }
// }
