import { Train, cloneTrain } from '../../model';
import { AddingNewTrain, getDirection } from '../../outlinedTimetableData';
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

  console.log('copied: ' + trains.length);
}

export function deleteTrains(props: DiagramProps, selectedTrains: Train[]) {
  props.crudTrain.deleteTrains(selectedTrains.map((selectedTrain) => selectedTrain.trainId));
}

export function pasteTrains(props: DiagramProps): Train[] {
  if (props.clipboard.trains.length === 0) {
    return [];
  }

  const addingNewTrains: AddingNewTrain[] = [];
  let i = 0;

  for (const train of props.clipboard.trains) {
    // 重なると見えないので2分だけずらす
    for (const diaTime of train.diaTimes) {
      if (diaTime.arrivalTime != null) diaTime.arrivalTime += 2 * 60;
      if (diaTime.departureTime != null) diaTime.departureTime += 2 * 60;
    }
    const originalTrain = props.clipboard.originalTrains[i];
    const direction = getDirection(props.timetable, originalTrain.trainId);
    addingNewTrains.push({
      train: train,
      beforeTrainId: null,
      direction: direction,
    });

    // selectedTrains.push(train);
    // const line = drawTrain(train);
    // addTrainSelection(line, train);
  }

  props.crudTrain.addTrains(addingNewTrains);

  const newTrains = addingNewTrains.map((addingNewTrain) => addingNewTrain.train);

  copyTrains(props, newTrains);

  return newTrains;
}
