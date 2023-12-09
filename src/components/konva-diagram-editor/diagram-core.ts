import { DeepReadonly } from 'ts-essentials';
import { Train, cloneTrain } from '../../model';
import { AddingNewTrain, getDirection } from '../../outlinedTimetableData';
import { DiagramProps } from './drawer-util';

export function copyTrains(props: DiagramProps, selectedTrains: DeepReadonly<Train[]>) {
  const trains = [];
  for (const selection of selectedTrains) {
    trains.push(cloneTrain(selection));
  }

  props.setClipboard({
    trains: trains,
    originalTrainIds: selectedTrains.map((t) => t.trainId),
  });

  console.log('copied: ' + trains.length);
}

export function deleteTrains(props: DiagramProps, selectedTrains: DeepReadonly<Train[]>) {
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
    const originalTrainId = props.clipboard.originalTrainIds[i];
    const direction = getDirection(props.timetable, originalTrainId);
    addingNewTrains.push({
      train: train as Train,
      beforeTrainId: null,
      direction: direction,
    });
  }

  props.crudTrain.addTrains(addingNewTrains);

  const newTrains = addingNewTrains.map((addingNewTrain) => addingNewTrain.train);

  copyTrains(props, newTrains);

  return newTrains;
}
