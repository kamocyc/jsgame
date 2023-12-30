import { produce } from 'immer';
import { useState } from 'react';
import { DeepReadonly, assert } from 'ts-essentials';
import { nn } from '../../common';
import { Station, StationLike, TimetableDirection, Train, generateId } from '../../model';
import { ListSettingCommonComponent } from '../track-editor/ListSettingCommonComponent';
import { EditableTextComponent, SetTimetable } from './common-component';
import { createNewStation, fillMissingTimes } from './timetable-util';

export function StationEditorListEntryComponent({
  stationIds,
  setTimetable,
  stations,
}: DeepReadonly<{
  stationIds: string[];
  stations: Map<string, StationLike>;
  setTimetable: SetTimetable;
}>) {
  const [isStationEditorOpen, setIsStationEditorOpen] = useState<boolean>(false);

  return (
    <div>
      <button
        onClick={() => {
          setIsStationEditorOpen(!isStationEditorOpen);
        }}
      >
        駅の編集{isStationEditorOpen ? 'ー' : '＋'}
      </button>
      {isStationEditorOpen ? (
        <StationEditListComponent stationIds={stationIds} setTimetable={setTimetable} stations={stations} />
      ) : (
        <></>
      )}
    </div>
  );
}

export function StationEditListComponent({
  stationIds,
  setTimetable,
  stations,
}: DeepReadonly<{
  stationIds: string[];
  stations: Map<string, StationLike>;
  setTimetable: SetTimetable;
}>) {
  const setStation = (station: DeepReadonly<StationLike>) => {
    setTimetable((_, __, stations) => {
      nn(stations).set(station.stationId, station);
    });
  };

  return stationIds.length > 0 ? (
    <ListSettingCommonComponent<DeepReadonly<Station>>
      getKey={(station) => station.stationId}
      datas={nn(stationIds.map((stationId) => nn(stations.get(stationId)))) as Station[]}
      defaultData={nn(stations.get(stationIds[0])) as Station}
      setDatas={(newStations) => {
        setTimetable((draftTimetable, trainData, stationMap) => {
          const newStation = newStations.find((s) => !stations.has(s.stationId));
          if (newStation !== undefined) {
            // TODO:
            const newStationIds = [...stationIds, newStation.stationId];
            for (const train of trainData.trains) {
              train.diaTimes = fillMissingTimes(train.diaTimes, newStationIds);
            }
          }

          const deletedStation = stationIds.find((stationId) => !newStations.some((s) => s.stationId === stationId));
          if (deletedStation !== undefined) {
            trainData.trains.forEach((train) => {
              train.diaTimes = train.diaTimes.filter((diaTime) => diaTime.stationId !== deletedStation);
            });
            trainData.otherDirectionTrains.forEach((train) => {
              train.diaTimes = train.diaTimes.filter((diaTime) => diaTime.stationId !== deletedStation);
            });
          }

          draftTimetable.stationIds = newStations.map((s) => s.stationId);

          nn(stationMap).clear();
          for (const station of newStations) {
            nn(stationMap).set(station.stationId, station);
          }
        });
      }}
      selectData={() => {}}
      getSettingComponent={(station_) => {
        const station = nn(stations.get(station_.stationId)) as Station;
        return (
          <StationDetailComponent
            station={station}
            setStation={(updater) => {
              const newStation = produce(station, (stationDraft) => {
                updater(stationDraft);
              });
              setStation(newStation);
            }}
          />
        );
      }}
      getDisplayName={(station) => station.stationName}
      excludeFromDatas={(datas, data) => {
        return datas.filter((d) => d.stationId !== data.stationId);
      }}
      getNewData={() => {
        return createNewStation('-');
      }}
    />
  ) : (
    <></>
  );
}

export function getDefaultPlatformId(
  station: DeepReadonly<StationLike>,
  timetableDirection: TimetableDirection
): string {
  assert(station.stationType === 'Station');

  const firstPlatformId = station.platforms[0].platformId;
  return timetableDirection === 'Inbound'
    ? station.defaultInboundPlatformId ?? firstPlatformId
    : station.defaultOutboundPlatformId ?? firstPlatformId;
}

function createNewStationAndUpdate(
  trainData: { trains: Train[]; otherDirectionTrains: Train[] },
  newStation: DeepReadonly<StationLike>
) {
  trainData.trains.forEach((train) => {
    train.diaTimes.push({
      diaTimeId: generateId(),
      arrivalTime: null,
      departureTime: null,
      isPassing: false,
      stationId: newStation.stationId,
      platformId: getDefaultPlatformId(newStation, 'Inbound'),
      isInService: true,
      trackId: null,
    });
  });

  trainData.otherDirectionTrains.forEach((train) => {
    train.diaTimes.unshift({
      diaTimeId: generateId(),
      arrivalTime: null,
      departureTime: null,
      isPassing: false,
      stationId: newStation.stationId,
      platformId: getDefaultPlatformId(newStation, 'Outbound'),
      isInService: true,
      trackId: null,
    });
  });
}

function StationDetailComponent({
  station,
  setStation,
}: DeepReadonly<{
  station: Station;
  setStation: (f: (station: Station) => void) => void;
}>) {
  return (
    <div>
      <div>
        駅名:{' '}
        <EditableTextComponent
          value={station.stationName}
          onChange={(value) => {
            setStation((station) => {
              station.stationName = value;
            });
            return true;
          }}
          height={24}
          width={100}
        />
      </div>
      {station.stationType === 'Station' ? (
        <div>
          番線リスト:
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <div style={{ width: 100 + 'px', textAlign: 'center' }}>番線名</div>
              <div style={{ width: 50 + 'px', textAlign: 'center' }}>
                <span style={{ display: 'inline-block' }}>上り</span>
                <span style={{ display: 'inline-block' }}>主本線</span>
              </div>
              <div style={{ width: 50 + 'px', textAlign: 'center' }}>
                <span style={{ display: 'inline-block' }}>下り</span>
                <span style={{ display: 'inline-block' }}>主本線</span>
              </div>
            </div>
            <div>
              {station.platforms.map((platform, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'row' }}>
                  <EditableTextComponent
                    value={platform.platformName}
                    onChange={(value) => {
                      setStation((station) => {
                        station.platforms.forEach((diaPlatform_) => {
                          if (diaPlatform_.platformId === platform.platformId) {
                            diaPlatform_.platformName = value;
                          }
                        });
                      });
                      return true;
                    }}
                    height={24}
                    width={100}
                  />
                  <input
                    type='radio'
                    name='default-inbound-platform'
                    style={{ width: 50 + 'px', margin: '0' }}
                    value={platform.platformId}
                    checked={station.defaultInboundPlatformId === platform.platformId}
                    onChange={(e) => {
                      if ((e.target as HTMLInputElement)?.value) {
                        const targetPlatformId = (e.target as HTMLInputElement).value;
                        setStation((station) => {
                          if ('defaultInboundPlatformId' in station) {
                            station.defaultInboundPlatformId = targetPlatformId;
                          }
                        });
                      }
                    }}
                  />
                  <input
                    type='radio'
                    name='default-outbound-platform'
                    style={{ width: 50 + 'px', margin: '0' }}
                    value={platform.platformId}
                    checked={station.defaultOutboundPlatformId === platform.platformId}
                    onChange={(e) => {
                      if ((e.target as HTMLInputElement)?.value) {
                        const targetPlatformId = (e.target as HTMLInputElement).value;
                        setStation((station) => {
                          if ('defaultOutboundPlatformId' in station) {
                            station.defaultOutboundPlatformId = targetPlatformId;
                          }
                        });
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      setStation((station) => {
                        station.platforms = station.platforms.filter(
                          (diaPlatform_) => diaPlatform_.platformId !== platform.platformId
                        );
                      });
                    }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
            <div>
              <button
                onClick={() => {
                  setStation((station) => {
                    station.platforms.push({
                      platformType: 'Platform',
                      platformId: generateId(),
                      platformName:
                        station.platforms.length === 0
                          ? '1'
                          : Math.max(
                              ...station.platforms.map((p) => {
                                const n = Number(p.platformName);
                                if (isNaN(n)) {
                                  return 0;
                                } else {
                                  return n;
                                }
                              })
                            ) +
                            1 +
                            '',
                      stationId: station.stationId,
                    });
                  });
                }}
              >
                番線を追加
              </button>
            </div>
          </div>
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}
