import { useState } from 'preact/hooks';
import { toStringFromSeconds } from '../../common';
import { Operation, Train } from '../../model';
import { ListSettingCommonComponent } from '../track-editor/ListSettingCommonComponent';
import './operation-table.css';

export interface DiagramOperationProps {
  setUpdate: () => void;
  inboundTrains: Train[];
  outboundTrains: Train[];
  operations: Operation[];
}

interface DiagramOperationSubProps extends DiagramOperationProps {
  operation: Operation;
}

export function DiagramOperationComponent(props: DiagramOperationProps) {
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);

  console.log(props.operations);
  return (
    <ListSettingCommonComponent<Operation>
      datas={props.operations}
      setDatas={(operations) => {
        props.setUpdate();
      }}
      selectData={(operation) => {
        setSelectedOperationId(operation.operationId);
      }}
      getSettingComponent={(operation) => {
        return <DiagramOperationSubComponent {...props} operation={operation} />;
      }}
      getDisplayName={(operation) => {
        return operation.operationCode;
      }}
      excludeFromDatas={(operations, operation) => {
        return operations.filter((o) => o.operationId !== operation.operationId);
      }}
      getNewData={null}
      settingColumnWidth='700px'
    />
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
            // 上り -> 下り を 左 -> 右 にする
            const [diaTime1, direction, diaTime2] =
              train.direction === 'Inbound'
                ? [train.diaTimes[0], '→', train.diaTimes[train.diaTimes.length - 1]]
                : [train.diaTimes[train.diaTimes.length - 1], '←', train.diaTimes[0]];
            const [time1, time2] =
              train.direction === 'Inbound'
                ? [diaTime1.departureTime, diaTime2.arrivalTime]
                : [diaTime1.arrivalTime, diaTime2.departureTime];
            return (
              <tr key={i}>
                <td>{train.trainCode}</td>
                <td>{train.trainType?.trainTypeName}</td>
                <td>{train.trainName}</td>
                <td>{diaTime1.station.stationName}</td>
                <td>{time1 !== null ? toStringFromSeconds(time1) : ''}</td>
                <td>{direction}</td>
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
