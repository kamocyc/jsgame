import { useEffect } from 'preact/hooks';
import { assert } from '../../common';
import { StationLike, StationOperation, Track, Train } from '../../model';
import { TimeInputComponent } from './common-component';
import { getDefaultPlatform } from './timetable-util';

// 入出区等の作業設定
// 複雑な回送設定などができない。それをやるにはやはりそれ自体を列車として設定する必要がある。 => それのためには、回送に設定する機能だけ追加すれば良さそう。
// 簡易な設定として残すのはありかも。実際にも車両基地に隣接した駅から始発したりとか、駅に耐泊した列車がそのまま出発とかある。
// やはり分岐駅設定は欲しい。oudiaを参考に作りたい。
export function StationOperationSettingComponent({
  stations,
  train,
  tracks,
  stationOperation,
  setStationOperation,
}: {
  stations: StationLike[];
  train: Train;
  tracks: Track[];
  stationOperation: StationOperation | undefined;
  setStationOperation: (stationOperation: StationOperation) => void;
}) {
  useEffect(() => {
    setStationOperation({ stationOperationType: 'Connection' });
  }, [stationOperation !== undefined]);

  function getPlatformData(platformId: string) {
    const platform = tracks.find((track) => track.track.platform?.platformId === platformId);
    assert(platform !== undefined);
    return {
      platformId: platformId,
      trackId: platform.trackId,
    };
  }

  const stationOperation_ = stationOperation ?? { stationOperationType: 'Connection' };

  return (
    <>
      <div>
        作業種別:
        <>
          <select
            value={stationOperation_.stationOperationType}
            onChange={(e) => {
              const stationOperationType = (e.target as HTMLSelectElement).value;
              if (stationOperationType === 'Connection') {
                setStationOperation({
                  ...stationOperation_,
                  stationOperationType: 'Connection',
                });
              } else if (stationOperationType === 'InOut') {
                assert(train.diaTimes.length > 0);
                assert(train.direction != null);

                const firstStationDepartureTime =
                  train.diaTimes[0].departureTime === null ? 10 * 60 * 60 : train.diaTimes[0].departureTime;
                const platformId =
                  train.diaTimes[0].platform?.platformId ??
                  getDefaultPlatform(train.diaTimes[0].station, train.direction).platformId;

                setStationOperation({
                  stationOperationType: 'InOut',
                  trainId: train.trainId,
                  operationTime: firstStationDepartureTime,
                  stationId: train.diaTimes[0].station.stationId,
                  ...getPlatformData(platformId),
                });
              }
            }}
          >
            <option value='Connection'>接続</option>
            <option value='InOut'>入出区</option>
          </select>
        </>
      </div>
      {stationOperation_.stationOperationType === 'InOut' ? (
        <>
          <div>
            駅/車両基地:
            <>
              <select
                value={stationOperation_.stationId}
                onChange={(e) => {
                  const stationId = (e.target as HTMLSelectElement).value;
                  const station = stations.find((station) => station.stationId === stationId);
                  assert(station !== undefined);
                  assert(station.platforms.length > 0);
                  const platformId = station.platforms[0].platformId;

                  setStationOperation({
                    ...stationOperation_,
                    ...getPlatformData(platformId),
                    stationId: stationId,
                  });
                }}
              >
                {stations.map((station) => (
                  <option value={station.stationId}>{station.stationName}</option>
                ))}
              </select>
            </>
          </div>
          <div>
            番線:
            <>
              <select
                value={stationOperation_.platformId}
                onChange={(e) => {
                  const platformId = (e.target as HTMLSelectElement).value;
                  setStationOperation({
                    ...stationOperation_,
                    ...getPlatformData(platformId),
                  });
                }}
              >
                {stations
                  .find((station) => station.stationId === stationOperation_.stationId)
                  ?.platforms.map((platform) => (
                    <option value={platform.platformId}>{platform.platformName}</option>
                  ))}
              </select>
            </>
          </div>
          <div>
            開始時刻:
            <>
              <TimeInputComponent
                time={stationOperation_.operationTime}
                setTime={(operationTime) => {
                  if (operationTime != null) {
                    setStationOperation({
                      ...stationOperation_,
                      operationTime: operationTime,
                    });
                  }
                }}
              />
            </>
          </div>
        </>
      ) : (
        <></>
      )}
    </>
  );
}
