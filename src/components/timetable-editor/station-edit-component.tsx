import { useState } from 'react';
import { DeepReadonly, assert } from 'ts-essentials';
import { StateUpdater, nn } from '../../common';
import {
  ContextData,
  PlatformLike,
  SettingData,
  Station,
  StationLike,
  TimetableDirection,
  Train,
  generateId,
} from '../../model';
import { ContextMenuComponent, EditableTextComponent, SetTimetable } from './common-component';
import { createNewStation } from './timetable-util';

function StationComponent({
  stationId,
  stations,
  setStation,
}: DeepReadonly<{
  stationId: string;
  stations: DeepReadonly<StationLike[]>;
  setStation: (station: DeepReadonly<StationLike>) => void;
}>) {
  return (
    <EditableTextComponent
      value={nn(stations.find((s) => s.stationId === stationId)).stationName}
      onChange={(value) => {
        const station = nn(stations.find((s) => s.stationId === stationId));
        setStation({ ...station, stationName: value });
        return false;
      }}
      height={24 * 3}
      width={100}
    />
  );
}

function StationContextMenuComponent({
  contextData,
  setContextData,
  stationIds,
  setStations,
  setTimetable,
  trains,
  otherDirectionTrains,
  selectedStationId,
  showStationDetail,
  timetableDirection,
}: DeepReadonly<{
  contextData: ContextData;
  setContextData: StateUpdater<ContextData>;
  stationIds: string[];
  setStations: (stations: StationLike[]) => void;
  setTimetable: SetTimetable;
  trains: readonly Train[];
  otherDirectionTrains: readonly Train[];
  selectedStationId: string | null;
  showStationDetail: (diaStation: DeepReadonly<string>) => void;
  timetableDirection: 'Inbound' | 'Outbound';
}>) {
  return (
    <ContextMenuComponent
      contextData={contextData}
      setContextData={setContextData}
      menuItems={[
        {
          label: '駅を削除',
          menuItemId: 'delete-station',
          onClick: () => {
            if (selectedStationId) {
              setTimetable((draftTimetable, trainData) => {
                draftTimetable.stationIds = draftTimetable.stationIds.filter(
                  (stationId) => stationId !== selectedStationId
                );
                assert(stationIds.length === draftTimetable.stationIds.length - 1);

                trainData.trains.forEach((train) => {
                  train.diaTimes = train.diaTimes.filter((diaTime) => diaTime.stationId !== selectedStationId);
                });
                trainData.otherDirectionTrains.forEach((train) => {
                  train.diaTimes = train.diaTimes.filter((diaTime) => diaTime.stationId !== selectedStationId);
                });
              });

              setContextData({ ...contextData, visible: false });
            }
          },
        },
        {
          label: 'オプション',
          menuItemId: 'option',
          onClick: () => {
            showStationDetail(selectedStationId!);
            setContextData({ ...contextData, visible: false });
          },
        },
        {
          label: '駅を追加',
          menuItemId: 'add-station',
          onClick: () => {
            // selectedStationの直前に挿入する
            const index = stationIds.findIndex((stationId) => stationId === selectedStationId);
            if (index === -1) {
              return;
            }

            setTimetable((draftTimetable, trainData) => {
              const newStation = createNewStation('-');
              draftTimetable.stationIds.splice(index, 0, newStation);

              createNewStationAndUpdate(trainData, newStation, timetableDirection);
            });
            setContextData({ ...contextData, visible: false });
          },
        },
      ]}
    />
  );
}

export function StationListComponent({
  stationIds,
  setStations,
  setTimetable,
  stations,
  trains,
  otherDirectionTrains,
  timetableDirection,
  setSettingData,
}: DeepReadonly<{
  stationIds: string[];
  stations: DeepReadonly<StationLike[]>;
  setStations: (stations: StationLike[]) => void;
  setTimetable: SetTimetable;
  trains: readonly Train[];
  otherDirectionTrains: readonly Train[];
  timetableDirection: 'Inbound' | 'Outbound';
  setSettingData: (settingData: DeepReadonly<SettingData>) => void;
}>) {
  const [contextData, setContextData] = useState<ContextData>({
    visible: false,
    posX: 0,
    posY: 0,
  });
  const [selectedStationId, setSelectedStationId] = useState<DeepReadonly<string> | null>(null);

  const showStationDetail = (stationId: DeepReadonly<string>) => {
    setSettingData({
      settingType: 'StationSetting',
      stationId: stationId,
    });
  };

  return (
    <div>
      <StationContextMenuComponent
        contextData={contextData}
        setContextData={setContextData}
        stationIds={stationIds}
        setStations={setStations}
        trains={trains}
        setTimetable={setTimetable}
        otherDirectionTrains={otherDirectionTrains}
        selectedStationId={selectedStationId}
        showStationDetail={showStationDetail}
        timetableDirection={timetableDirection}
      />
      <div
        onContextMenu={(e) => {
          const targetStation = (() => {
            for (const stationId of stationIds) {
              const id = 'dia-station-block-' + stationId;
              const elem = document.getElementById(id);
              if (elem && elem.contains(e.target as Node)) {
                return stationId;
              }
            }
            return null;
          })();

          if (targetStation) {
            e.preventDefault();
            setContextData({ visible: true, posX: e.pageX, posY: e.pageY });
            setSelectedStationId(targetStation);
          }
        }}
      >
        {stationIds.map((stationId) => (
          <div
            key={stationId}
            style={{ height: 24 * 3 + 'px', borderStyle: 'solid', borderWidth: '1px', paddingRight: '3px' }}
            id={'dia-station-block-' + stationId}
          >
            <StationComponent stationId={stationId} stations={stations} setDiaStation={setDiaStation} />
          </div>
        ))}
      </div>
      <div>
        <button
          onClick={() => {
            (stationUpdater) => {
              const newStation = createNewStation('-');
              stations.push(newStation);
              createNewStationAndUpdate(trains, newStation, timetableDirection);
              setStations([...stations]);
            };
          }}
        >
          駅を追加
        </button>
      </div>
    </div>
  );
}

function getDefaultPlatform(station: StationLike, timetableDirection: TimetableDirection): PlatformLike {
  return station.platforms[0];
}

function createNewStationAndUpdate(
  trainData: { trains: Train[]; otherDirectionTrains: Train[] },
  newStation: StationLike,
  timetableDirection: TimetableDirection
) {
  trainData.trains.forEach((train) => {
    train.diaTimes.push({
      diaTimeId: generateId(),
      arrivalTime: null,
      departureTime: null,
      isPassing: false,
      stationId: newStation.stationId,
      platformId: getDefaultPlatform(newStation, timetableDirection).platformId,
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
      platformId: getDefaultPlatform(newStation, timetableDirection).platformId,
      isInService: true,
      trackId: null,
    });
  });
}

export function StationDetailComponent({
  diaStation,
  setStation,
}: DeepReadonly<{
  diaStation: Station;
  setStation: (f: (station: Station) => void) => void;
}>) {
  return (
    <div>
      <div>
        駅名:{' '}
        <EditableTextComponent
          value={diaStation.stationName}
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
      {diaStation.stationType === 'Station' ? (
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
              {diaStation.platforms.map((diaPlatform) => (
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                  <EditableTextComponent
                    value={diaPlatform.platformName}
                    onChange={(value) => {
                      setStation((station) => {
                        station.platforms.forEach((diaPlatform_) => {
                          if (diaPlatform_.platformId === diaPlatform.platformId) {
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
                    value={diaPlatform.platformId}
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
                    value={diaPlatform.platformId}
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
                          (diaPlatform_) => diaPlatform_.platformId !== diaPlatform.platformId
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
