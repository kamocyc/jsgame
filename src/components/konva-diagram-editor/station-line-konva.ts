import Konva from 'konva';
import { assert } from '../../common';
import { StationLike } from '../../model';
import { hitStrokeWidth } from './drawer-util';
import { DrawingTrainLineKonva } from './drawing-train-line-konva';
import { DiagramKonvaContext, getPointerPosition, virtualCanvasWidth } from './konva-util';

export class StationLineKonva {
  private stationLine: Konva.Line;

  constructor(
    private context: DiagramKonvaContext,
    private station: StationLike,
    private drawingTrainLineKonva: DrawingTrainLineKonva
  ) {
    this.stationLine = new Konva.Line({
      stroke: 'black',
      strokeWidth: 1,
      hitStrokeWidth: hitStrokeWidth,
    });
    this.stationLine.on('mouseover', this.onMouseover.bind(this));
    this.stationLine.on('click', this.onClick.bind(this));

    this.context.topLayer.add(this.stationLine);

    this.updateShape();
  }

  onMouseover(e: Konva.KonvaEventObject<MouseEvent>) {
    if (this.drawingTrainLineKonva.getIsDrawing()) {
      const mousePosition = getPointerPosition(e.target.getStage()!);
      const newTime = this.context.viewStateManager.getPositionToTime(mousePosition.x);
      this.drawingTrainLineKonva.addStationTemporarily(this.station, newTime);
    }
  }

  onClick(e: Konva.KonvaEventObject<MouseEvent>) {
    this.context.selectionGroupManager.destroySelections();

    if (e.evt.button === 2) {
      // 右クリック
      this.drawingTrainLineKonva.commitDrawingLine();
      return;
    }

    const mousePosition = getPointerPosition(e.target.getStage()!);
    const newTime = this.context.viewStateManager.getPositionToTime(mousePosition.x);
    if (!this.drawingTrainLineKonva.getIsDrawing()) {
      this.drawingTrainLineKonva.startDrawing(this.station, newTime);
    } else {
      this.drawingTrainLineKonva.addStation(this.station, newTime);
    }
  }

  updateShape() {
    const diagramPosition = this.context.viewStateManager.getStationPosition(this.station.stationId);
    assert(diagramPosition != null);
    this.stationLine.points([0, diagramPosition, virtualCanvasWidth, diagramPosition]);
  }
}

export class StationLineCollectionKonva {
  private stationLine: Map<string, StationLineKonva> = new Map();

  constructor(private context: DiagramKonvaContext, private drawingTrainLineKonva: DrawingTrainLineKonva) {
    this.updateShape();
  }

  updateShape() {
    const notUsedStationIds = new Set<string>(this.stationLine.keys());

    for (const station of this.context.diagramProps.stations) {
      let stationLine = this.stationLine.get(station.stationId);
      if (stationLine == null) {
        stationLine = new StationLineKonva(this.context, station, this.drawingTrainLineKonva);
        this.stationLine.set(station.stationId, stationLine);
      }

      stationLine.updateShape();

      notUsedStationIds.delete(station.stationId);
    }
  }
}
