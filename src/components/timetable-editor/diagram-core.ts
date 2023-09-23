import { Train, cloneTrain } from '../../model';
import { DiagramProps } from './drawer-util';

export function copyTrains(props: DiagramProps, selectedTrains: Train[]) {
  const trains = [];
  for (const selection of selectedTrains) {
    trains.push(cloneTrain(selection));
  }

  props.setClipboard({
    trains: trains,
    originalTrains: selectedTrains,
  });
}

export function deleteTrains(props: DiagramProps, selectedTrains: Train[]) {
  for (const selection of selectedTrains) {
    const train = selection;
    if (train.direction === 'Inbound') {
      // 破壊的に削除する
      const index = props.inboundTrains.findIndex((t) => t.trainId === train.trainId);
      if (index >= 0) props.inboundTrains.splice(index, 1);
    } else {
      const index = props.outboundTrains.findIndex((t) => t.trainId === train.trainId);
      if (index >= 0) props.outboundTrains.splice(index, 1);
    }
  }

  props.setUpdate();
}

export function pasteTrains(props: DiagramProps): Train[] {
  const newTrains = [];

  for (const train of props.clipboard.trains) {
    // 重なると見えないので2分だけずらす
    for (const diaTime of train.diaTimes) {
      if (diaTime.arrivalTime != null) diaTime.arrivalTime += 2 * 60;
      if (diaTime.departureTime != null) diaTime.departureTime += 2 * 60;
    }
    if (train.direction === 'Inbound') {
      props.inboundTrains.push(train);
    } else {
      props.outboundTrains.push(train);
    }
    newTrains.push(train);
    // selectedTrains.push(train);
    // const line = drawTrain(train);
    // addTrainSelection(line, train);
  }

  props.setUpdate();
  copyTrains(props, newTrains);

  return newTrains;
}
