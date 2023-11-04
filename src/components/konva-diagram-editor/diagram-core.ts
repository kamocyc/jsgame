import { Train, cloneTrain } from '../../model';
import { OutlinedTimetableData } from '../../outlinedTimetableData';
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
  props.crudTrain.deleteTrains(selectedTrains.map((selectedTrain) => selectedTrain.trainId));
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

  props.updateTrains();
  copyTrains(props, newTrains);

  return newTrains;
}

export function getDirection(train: Train, timetableData: OutlinedTimetableData) {
  timetableData.
}