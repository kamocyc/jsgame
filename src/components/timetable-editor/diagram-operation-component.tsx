import { toStringFromSeconds, upto } from '../../common';
import { Operation, Train } from '../../model';
import { OutlinedTimetable, getDirection } from '../../outlinedTimetableData';
import { ListSettingCommonComponent } from '../track-editor/ListSettingCommonComponent';
import './operation-table.css';

export interface DiagramOperationProps {
  setUpdate: () => void;
  inboundTrains: readonly Train[];
  outboundTrains: readonly Train[];
  operations: Operation[];
  timetable: OutlinedTimetable;
}

interface DiagramOperationSubProps extends DiagramOperationProps {
  operation: Operation;
}

type OperationTypeAll = { type: 'all'; operationCode: 'all' };

export function DiagramOperationComponent(props: DiagramOperationProps) {
  const operations = [{ type: 'all', operationCode: '一覧' } as Operation | OperationTypeAll].concat(props.operations);

  return (
    <ListSettingCommonComponent<Operation | OperationTypeAll>
      datas={operations}
      defaultData={operations[0]}
      setDatas={() => {}}
      selectData={() => {}}
      getSettingComponent={(operation) => {
        if ('type' in operation) {
          return <DiagramOperationSubAllComponent operations={props.operations} />;
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

export function DiagramOperationSubAllComponent({ operations }: { operations: Operation[] }) {
  const maxTrainCount = Math.max(...operations.map((operation) => operation.trains.length));
  return (
    <>
      <table class='operation-table'>
        <thead>
          <tr>
            <th>運用番号</th>
            {upto(maxTrainCount).map((i) => (
              <>
                <th key={(i + 1).toString()} colSpan={2}>
                  {i + 1}
                </th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {operations.map((operation, i) => {
            return (
              <>
                {/* 列車番号 */}
                <tr class='operation-row' key={i.toString() + '_01'}>
                  <th rowSpan={3}>{operation.operationCode}</th>
                  {upto(maxTrainCount).map((i) => {
                    const train = operation.trains[i];
                    if (train === undefined) {
                      return (
                        <>
                          <td style={{ height: '19.1px' }}></td>
                          <td></td>
                        </>
                      );
                    } else {
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
                <tr class='operation-row' key={i.toString() + '_02'}>
                  {upto(maxTrainCount).map((i) => {
                    const train = operation.trains[i];
                    if (train === undefined || train.diaTimes.length === 0) {
                      return (
                        <>
                          <td></td>
                          <td></td>
                        </>
                      );
                    } else {
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
                <tr class='operation-row' key={i.toString() + '_03'}>
                  {upto(maxTrainCount).map((i) => {
                    const train = operation.trains[i];
                    if (train === undefined || train.diaTimes.length === 0) {
                      return (
                        <>
                          <td></td>
                          <td></td>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <td>{train.diaTimes[0].station.stationName}</td>
                          <td>{train.diaTimes[train.diaTimes.length - 1].station.stationName}</td>
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

export function DiagramOperationSubComponent(props: DiagramOperationSubProps) {
  const operation = props.operation;
  return (
    <>
      <table class='operation-table'>
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
          {operation.trains.map((train, i) => {
            const direction = getDirection(props.timetable, train.trainId);
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
                <td>{diaTime1.station.stationName}</td>
                <td>{time1 !== null ? toStringFromSeconds(time1) : ''}</td>
                <td>{directionText}</td>
                <td>{diaTime2.station.stationName}</td>
                <td>{time2 !== null ? toStringFromSeconds(time2) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
