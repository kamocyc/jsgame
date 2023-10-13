import { Station, StationOperation, Train } from '../../model';

// 入出区等の作業設定
// 複雑な回送設定などができない。それをやるにはやはりそれ自体を列車として設定する必要がある。 => それのためには、回送に設定する機能だけ追加すれば良さそう。
// 簡易な設定として残すのはありかも。実際にも車両基地に隣接した駅から始発したりとか、駅に耐泊した列車がそのまま出発とかある。
// やはり分岐駅設定は欲しい。oudiaを参考に作りたい。
export function StationOperationSettingComponent({
  stations,
  train,
  stationOperation,
  setStationOperation,
}: {
  stations: Station[];
  train: Train;
  stationOperation: StationOperation;
  setStationOperation: (stationOperation: StationOperation) => void;
}) {
  return (
    <>
      <>
        作業種別:
        <>
          <select
            onChange={(e) => {
              const stationOperationType = (e.target as HTMLSelectElement).value;
              if (stationOperationType === 'Connection') {
                setStationOperation({
                  ...stationOperation,
                  stationOperationType: 'Connection',
                });
              } else if (stationOperationType === 'InOut') {
                setStationOperation({
                  ...stationOperation,
                  stationOperationType: 'InOut',
                  trainId: train.trainId,
                  operationTime: operationTime,
                });
              }
            }}
          >
            <option value='Connection'>接続</option>
            <option value='InOut'>入出区</option>
          </select>
        </>
      </>
      {stationOperation.stationOperationType === 'Connection' ? (
        <>
          <>
            駅/車両基地:
            <>
              <select
                onChange={(e) => {
                  const stationId = (e.target as HTMLSelectElement).value;
                  setStationOperation({
                    ...stationOperation,
                    stationId: stationId,
                  });
                }}
              >
                {stations.map((station) => (
                  <option value={station.stationId}>{station.stationName}</option>
                ))}
              </select>
            </>
          </>
          <>
            番線:
            <>
              <select
                onChange={(e) => {
                  const platformId = (e.target as HTMLSelectElement).value;
                  setStationOperation({
                    ...stationOperation,
                    platformId: platformId,
                  });
                }}
              >
                {stations
                  .find((station) => station.stationId === stationOperation.stationId)
                  ?.platforms.map((platform) => (
                    <option value={platform.platformId}>{platform.platformName}</option>
                  ))}
              </select>
            </>
          </>
          <>
            開始時刻:
            <>
              <input
                type='time'
                value={stationOperation.arrivalTime}
                onChange={(e) => {
                  const arrivalTime = (e.target as HTMLInputElement).value;
                  setStationOperation({
                    ...stationOperation,
                    arrivalTime: arrivalTime,
                  });
                }}
              />
            </>
          </>
        </>
      ) : (
        <></>
      )}
    </>
  );
}
