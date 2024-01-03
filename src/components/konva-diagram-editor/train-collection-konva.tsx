import { Group } from 'react-konva';
import { useRecoilValue } from 'recoil';
import { DeepReadonly, assert } from 'ts-essentials';
import { nn } from '../../common';
import { DiaTime, Train } from '../../model';
import { DiagramProps } from './drawer-util';
import {
  allTrainsMapAtom,
  getPointerPosition,
  secondWidthAtom,
  selectedTrainIdsAtom,
  shouldChangeAfterTimeAtom,
  stationMapSelector,
  timeUnitAtom,
  useViewStateValues,
} from './konva-util';
import { MouseEventManager } from './mouse-event-manager';
import { getPlatformUnderCursor } from './selection-group-manager';
import { TrainKonva } from './train-konva';

export type TrainCollectionKonvaProps = DeepReadonly<{
  diagramProps: DiagramProps;
  mouseEventManager: MouseEventManager;
}>;

function getNewTime(
  train: Train,
  diaTime: DiaTime,
  orgTime: number,
  timeDiff: number,
  arrivalOrDeparture: 'ArrivalTime' | 'DepartureTime',
  shouldChangeAfterTime: boolean,
  timeUnit: number
): number {
  let newTime = orgTime + (timeUnit === 1 ? timeDiff : Math.round(timeDiff / timeUnit) * timeUnit);

  // 前の時間以降にする
  const diaTimes = train.diaTimes;
  const index = diaTimes.findIndex((d) => d.diaTimeId === diaTime.diaTimeId);
  assert(index !== -1);
  // console.log({ index, newTime, orgTime: orgTime });

  if (arrivalOrDeparture === 'ArrivalTime') {
    // 後の時刻を一緒に変更するときは、出発時刻も変えるので、制限をかけない
    if (!shouldChangeAfterTime) {
      const departureTime = diaTimes[index].departureTime;
      if (departureTime !== null) {
        if (newTime > departureTime) {
          newTime = departureTime;
        }
      }
    }
  } else if (arrivalOrDeparture === 'DepartureTime') {
    const arrivalTime = diaTimes[index].arrivalTime;
    if (arrivalTime !== null) {
      if (newTime < arrivalTime) {
        newTime = arrivalTime;
      }
    }
  }

  if (index > 0) {
    const prevDiaTime = diaTimes[index - 1];
    const prevTime = Math.max(prevDiaTime.arrivalTime ?? 0, prevDiaTime.departureTime ?? 0);
    if (newTime < prevTime) {
      newTime = prevTime;
    }
  }

  if (index < diaTimes.length - 1) {
    const nextDiaTime = diaTimes[index + 1];
    const nextTime = Math.min(nextDiaTime.arrivalTime ?? Infinity, nextDiaTime.departureTime ?? Infinity);
    if (newTime > nextTime) {
      newTime = nextTime;
    }
  }

  return newTime;
}

// 1つの点のみをドラッグしたとき
// ドラッグ開始時の時刻点を記録しておく
function setDraggingPointForTime(
  timeDiff: number,
  train: Train,
  diaTimeId: string,
  arrivalOrDeparture: 'arrivalTime' | 'departureTime',
  movePlatform: boolean,
  newPlatformId: string | null,
  dragStartTrainTimes: DeepReadonly<{ trainId: string; diaTimes: DiaTime[] }[]>,
  shouldChangeAfterTime: boolean,
  timeUnit: number
) {
  const diaTime = train.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTimeId);
  assert(diaTime !== undefined);

  const startTimes = dragStartTrainTimes.find((t) => t.trainId === train.trainId);
  assert(startTimes != null);
  const startTime = startTimes.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTimeId);
  assert(startTime !== undefined);

  let orgDepartureTime: number | null = null;
  let orgArrivalTime: number | null = null;

  if (arrivalOrDeparture === 'departureTime') {
    if (diaTime.departureTime != null) {
      orgDepartureTime = startTime.departureTime;
      assert(orgDepartureTime != null);
    }
  } else if (arrivalOrDeparture === 'arrivalTime') {
    if (diaTime.arrivalTime != null) {
      orgArrivalTime = startTime.arrivalTime;
      assert(orgArrivalTime != null);
    }
  }

  let actualTimeDiff: null | number = null;
  if (orgDepartureTime !== null) {
    diaTime.departureTime = getNewTime(
      train,
      diaTime,
      orgDepartureTime,
      timeDiff,
      'DepartureTime',
      shouldChangeAfterTime,
      timeUnit
    );
    actualTimeDiff = diaTime.departureTime - orgDepartureTime;
  }
  if (orgArrivalTime !== null) {
    diaTime.arrivalTime = getNewTime(
      train,
      diaTime,
      orgArrivalTime,
      timeDiff,
      'ArrivalTime',
      shouldChangeAfterTime,
      timeUnit
    );
    actualTimeDiff = diaTime.arrivalTime - orgArrivalTime;
  }

  if (shouldChangeAfterTime && actualTimeDiff !== null) {
    const diaTimeIndex = train.diaTimes.findIndex((diaTime) => diaTime.diaTimeId === diaTimeId);
    assert(diaTimeIndex !== -1);

    const orgTrainTimesMap: Map<string, DiaTime> = new Map(
      dragStartTrainTimes
        .filter((tt) => tt.trainId === train.trainId)
        .flatMap((tt) => tt.diaTimes)
        .map((diaTime) => [diaTime.diaTimeId, diaTime])
    );

    // 到着時間を変更していて、発車時間が設定されているとき
    const orgDepartureTime = nn(orgTrainTimesMap.get(diaTime.diaTimeId)).departureTime;
    if (arrivalOrDeparture === 'arrivalTime' && orgDepartureTime !== null) {
      if (diaTime.departureTime !== null && orgDepartureTime !== null) {
        diaTime.departureTime = getNewTime(
          train,
          diaTime,
          orgDepartureTime,
          actualTimeDiff,
          'DepartureTime',
          shouldChangeAfterTime,
          timeUnit
        );
      }
    }

    for (let i = diaTimeIndex + 1; i < train.diaTimes.length; i++) {
      const diaTime = train.diaTimes[i];
      const orgArrivalTime = nn(orgTrainTimesMap.get(diaTime.diaTimeId)).arrivalTime;
      if (diaTime.arrivalTime !== null && orgArrivalTime !== null) {
        diaTime.arrivalTime = getNewTime(
          train,
          diaTime,
          orgArrivalTime,
          actualTimeDiff,
          'ArrivalTime',
          shouldChangeAfterTime,
          timeUnit
        );
      }
      const orgDepartureTime = nn(orgTrainTimesMap.get(diaTime.diaTimeId)).departureTime;
      if (diaTime.departureTime !== null && orgDepartureTime !== null) {
        diaTime.departureTime = getNewTime(
          train,
          diaTime,
          orgDepartureTime,
          actualTimeDiff,
          'DepartureTime',
          shouldChangeAfterTime,
          timeUnit
        );
      }
    }
  }

  if (movePlatform && newPlatformId !== null) {
    diaTime.platformId = newPlatformId;
  }
}

// スジ全体をドラッグしたとき
export function setDraggingPoint(
  selectedTrainIds: DeepReadonly<string[]>,
  trains: Map<string, Train>,
  timeDiff: number,
  dragStartTrainTimes: DeepReadonly<
    { trainId: string; diaTimes: { diaTimeId: string; departureTime: number | null; arrivalTime: number | null }[] }[]
  >
): void {
  for (const trainId of selectedTrainIds) {
    const startTimes = dragStartTrainTimes.find((t) => t.trainId === trainId);
    assert(startTimes != null);

    const train = nn(trains.get(trainId));
    let i = 0;
    for (const diaTime of train.diaTimes) {
      if (diaTime.departureTime != null) {
        const orgTime = startTimes.diaTimes[i].departureTime;
        assert(orgTime != null);
        diaTime.departureTime = orgTime + timeDiff;
      }
      if (diaTime.arrivalTime != null) {
        const orgTime = startTimes.diaTimes[i].arrivalTime;
        assert(orgTime != null);
        diaTime.arrivalTime = orgTime + timeDiff;
      }
      i++;
    }
  }
}

export function getDragStartTimes(
  selectedTrainIds: DeepReadonly<string[]>,
  trains: DeepReadonly<Map<string, Train>>
): {
  trainId: string;
  diaTimes: {
    diaTimeId: string;
    arrivalTime: number | null;
    departureTime: number | null;
  }[];
}[] {
  const dragStartTrainTimes = [];
  for (const trainId of selectedTrainIds) {
    const train = nn(trains.get(trainId));
    const partialDiaTimes = train.diaTimes.map((diaTime) => ({
      diaTimeId: diaTime.diaTimeId,
      arrivalTime: diaTime.arrivalTime,
      departureTime: diaTime.departureTime,
    }));
    dragStartTrainTimes.push({
      trainId: train.trainId,
      diaTimes: partialDiaTimes,
    });
  }
  return dragStartTrainTimes;
}

export function TrainCollectionKonva(props: TrainCollectionKonvaProps) {
  const { diagramProps, mouseEventManager } = props;
  const secondWidth = useRecoilValue(secondWidthAtom);
  const viewState = useViewStateValues();
  const selectedTrainIds = useRecoilValue(selectedTrainIdsAtom);
  const trains = useRecoilValue(allTrainsMapAtom);
  const stationMap = useRecoilValue(stationMapSelector);
  const shouldChangeAfterTime = useRecoilValue(shouldChangeAfterTimeAtom);
  const timeUnit = useRecoilValue(timeUnitAtom);

  mouseEventManager.registerDragStartHandler('train-line-group', (e) => {
    if (e.evt.button !== 0) return null;
    return getDragStartTimes(selectedTrainIds, trains);
  });

  mouseEventManager.registerDragMoveHandler('train-line-group', (e, target, dragStartPoint, dragStartTimes_) => {
    const stage = e.target.getStage();
    if (stage === null) return;
    if (e.evt.button !== 0) return;

    if (!dragStartTimes_) return;
    const dragStartTimes = dragStartTimes_ as { trainId: string; diaTimes: DiaTime[] }[];

    const dragPoint = getPointerPosition(stage);
    if (dragStartPoint == null) return;

    const x = Math.round(dragPoint.x / secondWidth) * secondWidth;
    const platformId = getPlatformUnderCursor(dragPoint.y, stationMap, viewState)?.platform?.platformId;

    const timeDiff = Math.round((x - dragStartPoint.x) / secondWidth);
    if (target.id().substring(0, 8) === 'timeBox-') {
      // 1つの時刻のみ
      const [_, trainId, diaTimeId, platformOrStation, timeType] = target.id().split('-');
      assert(timeType === 'arrivalTime' || timeType === 'departureTime');
      assert(
        trainId !== undefined && diaTimeId !== undefined && platformOrStation !== undefined && timeType !== undefined
      );
      diagramProps.crudTrain.updateTrain(trainId, (train) => {
        setDraggingPointForTime(
          timeDiff,
          train,
          diaTimeId,
          timeType,
          platformOrStation === 'platform',
          platformId ?? null,
          dragStartTimes,
          shouldChangeAfterTime,
          timeUnit
        );
      });
    } else {
      // スジ全体
      diagramProps.crudTrain.setTrains((trains) => {
        setDraggingPoint(selectedTrainIds, trains, timeDiff, dragStartTimes);
      });
    }
  });

  return (
    <Group id={'train-line-group'}>
      {[...trains.values()].map((train) => (
        <TrainKonva
          key={train.trainId}
          mouseEventManager={mouseEventManager}
          diagramProps={diagramProps}
          train={train}
        />
      ))}
    </Group>
  );
}
