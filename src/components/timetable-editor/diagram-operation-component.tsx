import { DeepReadonly } from 'ts-essentials';
import { nn, toStringFromSeconds, upto } from '../../common';
import { Operation, StationLike, Train } from '../../model';
import { OutlinedTimetable, getDirection } from '../../outlinedTimetableData';
import { ListSettingCommonComponent } from '../track-editor/ListSettingCommonComponent';
import './operation-table.css';

export interface DiagramOperationProps {
  inboundTrains: readonly Train[];
  outboundTrains: readonly Train[];
  operations: Operation[];
  timetable: OutlinedTimetable;
  stations: Map<string, StationLike>;
}

interface DiagramOperationSubProps extends DiagramOperationProps {
  operation: Operation;
}

type OperationTypeAll = { type: 'all'; operationCode: 'all' };

export function DiagramOperationComponent(props: DeepReadonly<DiagramOperationProps>) {
  const operations = [{ type: 'all', operationCode: '一覧' } as Operation | OperationTypeAll].concat(props.operations);

  return (
    <ListSettingCommonComponent<Operation | OperationTypeAll>
      getKey={(operation) => {
        return 'type' in operation ? operation.type : operation.operationId;
      }}
      datas={operations}
      defaultData={operations[0]}
      setDatas={() => {}}
      selectData={() => {}}
      getSettingComponent={(operation) => {
        if ('type' in operation) {
          return <DiagramOperationSubAllComponent {...props} operations={props.operations} />;
        } else {
          return <DiagramOperationSubComponent {...props} operation={operation} />;
        }
      }}
      getDisplayName={(operation) => {
        return operation.operationCode;
      }}
      excludeFromDatas={null}
      getNewData={null}
      settingColumnWidth='700px'
    />
  );
}

export function DiagramOperationSubAllComponent(props: DeepReadonly<DiagramOperationProps>) {
  const maxTrainCount = Math.max(...props.operations.map((operation) => operation.trainIds.length));
  return (
    <>
      <table className='operation-table'>
        <thead>
          <tr>
            <th>運用番号</th>
            {upto(maxTrainCount).map((i) => (
              <th key={(i + 1).toString()} colSpan={2}>
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.operations.map((operation, i) => {
            return (
              <>
                {/* 列車番号 */}
                <tr className='operation-row' key={i.toString() + '_01'}>
                  <th rowSpan={3}>{operation.operationCode}</th>
                  {upto(maxTrainCount).map((i) => {
                    const trainId = operation.trainIds[i];
                    if (trainId === undefined) {
                      return (
                        <>
                          <td style={{ height: '19.1px' }}></td>
                          <td></td>
                        </>
                      );
                    } else {
                      const train = nn(getTrain(props, trainId));
                      return (
                        <>
                          <td>{train.trainCode}</td>
                          <td>{train.trainName}</td>
                        </>
                      );
                    }
                  })}
                </tr>
                {/* 始発、終了時刻 */}
                <tr className='operation-row' key={i.toString() + '_02'}>
                  {upto(maxTrainCount).map((i) => {
                    const trainId = operation.trainIds[i];
                    if (trainId === undefined || getTrain(props, trainId)?.diaTimes.length === 0) {
                      return (
                        <>
                          <td></td>
                          <td></td>
                        </>
                      );
                    } else {
                      const train = nn(getTrain(props, trainId));
                      const departureTime = train.diaTimes[0].departureTime;
                      const arrivalTime = train.diaTimes[train.diaTimes.length - 1].arrivalTime;
                      return (
                        <>
                          <td>{departureTime !== null ? toStringFromSeconds(departureTime) : ''}</td>
                          <td>{arrivalTime !== null ? toStringFromSeconds(arrivalTime) : ''}</td>
                        </>
                      );
                    }
                  })}
                </tr>
                {/* 始発、終了駅 */}
                <tr className='operation-row' key={i.toString() + '_03'}>
                  {upto(maxTrainCount).map((i) => {
                    const trainId = operation.trainIds[i];
                    if (trainId === undefined || getTrain(props, trainId)?.diaTimes.length === 0) {
                      return (
                        <>
                          <td></td>
                          <td></td>
                        </>
                      );
                    } else {
                      const train = nn(getTrain(props, trainId));
                      return (
                        <>
                          <td>{nn(props.stations.get(train.diaTimes[0].stationId)).stationName}</td>
                          <td>
                            {nn(props.stations.get(train.diaTimes[train.diaTimes.length - 1].stationId)).stationName}
                          </td>
                        </>
                      );
                    }
                  })}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function getTrain(
  props: DeepReadonly<{ inboundTrains: Train[]; outboundTrains: Train[] }>,
  trainId: string
): DeepReadonly<Train> | undefined {
  const train = props.inboundTrains.find((train) => train.trainId === trainId);
  if (train !== undefined) {
    return train;
  }
  return props.outboundTrains.find((train) => train.trainId === trainId);
}

export function DiagramOperationSubComponent(props: DeepReadonly<DiagramOperationSubProps>) {
  const operation = props.operation;
  return (
    <>
      <table className='operation-table'>
        <thead>
          <tr>
            <th>列車番号</th>
            <th>列車種別</th>
            <th>列車名</th>
            <th>駅名</th>
            <th>駅時刻</th>
            <th>{/* 方向 */}</th>
            <th>駅名</th>
            <th>駅時刻</th>
          </tr>
        </thead>
        <tbody>
          {operation.trainIds.map((trainId, i) => {
            const train = nn(getTrain(props, trainId));
            const direction = getDirection(props.timetable, trainId);
            // 上り -> 下り を 左 -> 右 にする
            const [diaTime1, directionText, diaTime2] =
              direction === 'Inbound'
                ? [train.diaTimes[0], '→', train.diaTimes[train.diaTimes.length - 1]]
                : [train.diaTimes[train.diaTimes.length - 1], '←', train.diaTimes[0]];
            const [time1, time2] =
              direction === 'Inbound'
                ? [diaTime1.departureTime, diaTime2.arrivalTime]
                : [diaTime1.arrivalTime, diaTime2.departureTime];
            return (
              <tr key={i}>
                <td>{train.trainCode}</td>
                <td>{train.trainType?.trainTypeName}</td>
                <td>{train.trainName}</td>
                <td>{nn(props.stations.get(diaTime1.stationId)).stationName}</td>
                <td>{time1 !== null ? toStringFromSeconds(time1) : ''}</td>
                <td>{directionText}</td>
                <td>{nn(props.stations.get(diaTime2.stationId)).stationName}</td>
                <td>{time2 !== null ? toStringFromSeconds(time2) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
