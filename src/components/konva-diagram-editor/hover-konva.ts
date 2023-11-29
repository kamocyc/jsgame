import Konva from 'konva';
import { DiagramKonvaContext } from './konva-util';

type PartialContext = Pick<DiagramKonvaContext, 'topLayer'>;

export class HoverKonva {
  private hoverLabel: Konva.Text;
  private hoverBox: Konva.Rect;

  constructor(private context: PartialContext, stageKonva: { scale: number }) {
    this.hoverLabel = new Konva.Text({
      fontSize: 16 / stageKonva.scale,
      listening: false,
      fontFamily: 'Calibri',
      fill: 'black',
    });
    this.hoverBox = new Konva.Rect({
      fill: 'white',
      listening: false,
      stroke: 'black',
      strokeWidth: 0.5,
      padding: 5 / stageKonva.scale,
      shadowColor: 'black',
      shadowBlur: 5 / stageKonva.scale,
      shadowOffset: { x: 5 / stageKonva.scale, y: 5 / stageKonva.scale },
      shadowOpacity: 0.5,
    });
  }

  showHoverLabel(x: number, y: number) {
    this.hoverBox.position({ x, y });
    this.hoverBox.width(this.hoverLabel.width());
    this.hoverBox.height(this.hoverLabel.height());
    this.context.topLayer.add(this.hoverBox);

    this.hoverLabel.position({ x, y });
    this.context.topLayer.add(this.hoverLabel);
  }

  hideHoverLabel() {
    this.hoverLabel.remove();
    this.hoverBox.remove();
  }

  setHoverLabel(text: string) {
    this.hoverLabel.text(text);
  }

  destroy() {
    this.hoverLabel.destroy();
    this.hoverBox.destroy();
  }
}

export class WarningKonva {
  private warningLabel: Konva.Text;
  private hoverKonva: HoverKonva;

  constructor(private context: PartialContext, stageKonva: { scale: number }, message: string, x: number, y: number) {
    this.warningLabel = new Konva.Text({
      text: '⚠',
      x: x,
      y: y,
      fontSize: 18 / stageKonva.scale,
      fontFamily: 'Calibri',
      fill: 'red',
    });

    this.context.topLayer.add(this.warningLabel);

    this.hoverKonva = new HoverKonva(this.context, stageKonva);
    this.hoverKonva.setHoverLabel(message);

    this.warningLabel.on('mouseenter', () => {
      this.hoverKonva.showHoverLabel(this.warningLabel.x(), this.warningLabel.y());
    });
    this.warningLabel.on('mouseleave', () => {
      this.hoverKonva.hideHoverLabel();
    });
  }

  destroy() {
    this.warningLabel.destroy();
    this.hoverKonva.destroy();
  }
}
