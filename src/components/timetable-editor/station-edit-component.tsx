import { produce } from 'immer';
import { DeepReadonly, assert } from 'ts-essentials';
import { nn } from '../../common';
import { Station, StationLike, TimetableDirection, Train, generateId } from '../../model';
import { ListSettingCommonComponent } from '../track-editor/ListSettingCommonComponent';
import { EditableTextComponent, SetTimetable } from './common-component';
import { createNewStation } from './timetable-util';

// function StationComponent({
//   stationId,
//   stations,
//   setStation,
// }: DeepReadonly<{
//   stationId: string;
//   stations: Map<string, StationLike>;
//   setStation: (station: DeepReadonly<StationLike>) => void;
// }>) {
//   return (
//     <EditableTextComponent
//       value={nn(stations.get(stationId)).stationName}
//       onChange={(value) => {
//         const station = nn(stations.get(stationId));
//         setStation({ ...station, stationName: value });
//         return false;
//       }}
//       height={24 * 3}
//       width={100}
//     />
//   );
// }

// function StationContextMenuComponent({
//   contextData,
//   setContextData,
//   stationIds,
//   setTimetable,
//   selectedStationId,
//   showStationDetail,
//   timetableDirection,
// }: DeepReadonly<{
//   contextData: ContextData;
//   setContextData: StateUpdater<ContextData>;
//   stationIds: string[];
//   setTimetable: SetTimetable;
//   selectedStationId: string | null;
//   showStationDetail: (diaStation: DeepReadonly<string>) => void;
//   timetableDirection: 'Inbound' | 'Outbound';
// }>) {
//   return (
//     <ContextMenuComponent
//       contextData={contextData}
//       setContextData={setContextData}
//       menuItems={[
//         {
//           label: '駅を削除',
//           menuItemId: 'delete-station',
//           onClick: () => {
//             if (selectedStationId) {
//               setTimetable((draftTimetable, trainData) => {
//                 draftTimetable.stationIds = draftTimetable.stationIds.filter(
//                   (stationId) => stationId !== selectedStationId
//                 );
//                 assert(stationIds.length === draftTimetable.stationIds.length - 1);

//                 trainData.trains.forEach((train) => {
//                   train.diaTimes = train.diaTimes.filter((diaTime) => diaTime.stationId !== selectedStationId);
//                 });
//                 trainData.otherDirectionTrains.forEach((train) => {
//                   train.diaTimes = train.diaTimes.filter((diaTime) => diaTime.stationId !== selectedStationId);
//                 });
//               });

//               setContextData({ ...contextData, visible: false });
//             }
//           },
//         },
//         {
//           label: 'オプション',
//           menuItemId: 'option',
//           onClick: () => {
//             showStationDetail(selectedStationId!);
//             setContextData({ ...contextData, visible: false });
//           },
//         },
//         {
//           label: '駅を追加',
//           menuItemId: 'add-station',
//           onClick: () => {
//             // selectedStationの直前に挿入する
//             const index = stationIds.findIndex((stationId) => stationId === selectedStationId);
//             if (index === -1) {
//               return;
//             }

//             const newStation = createNewStation('-');

//             setTimetable((draftTimetable, trainData, stationMap) => {
//               draftTimetable.stationIds.splice(index, 0, newStation.stationId);

//               createNewStationAndUpdate(trainData, newStation, timetableDirection);

//               nn(stationMap).set(newStation.stationId, newStation);
//             });
//             setContextData({ ...contextData, visible: false });
//           },
//         },
//       ]}
//     />
//   );
// }

export function StationEditListComponent({
  stationIds,
  setTimetable,
  stations,
}: DeepReadonly<{
  stationIds: string[];
  stations: Map<string, StationLike>;
  setTimetable: SetTimetable;
}>) {
  // const [contextData, setContextData] = useState<ContextData>({
  //   visible: false,
  //   posX: 0,
  //   posY: 0,
  // });
  // const [selectedStationId, setSelectedStationId] = useState<DeepReadonly<string> | null>(null);
  // const [settingData, setSettingData] = useState<DeepReadonly<SettingData> | null>(null);

  // const showStationDetail = (stationId: DeepReadonly<string>) => {
  //   setSettingData({
  //     settingType: 'StationSetting',
  //     stationId: stationId,
  //   });
  // };

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
            createNewStationAndUpdate(trainData, newStation);
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
  // return (
  //   <div>
  //     {settingData == null ? (
  //       <></>
  //     ) : (
  //       <SettingColumnComponent setSettingData={setSettingData} width='250px'>
  //         {settingData != null && settingData.settingType === 'StationSetting' ? (
  //           (() => {
  //             const station = nn(stations.get(settingData.stationId)) as Station;
  //             return (
  //               <StationDetailComponent
  //                 station={station}
  //                 setStation={(updater) => {
  //                   const newStation = produce(station, (stationDraft) => {
  //                     updater(stationDraft);
  //                   });

  //                   setStation(newStation);
  //                 }}
  //               />
  //             );
  //           })()
  //         ) : (
  //           <></>
  //         )}
  //       </SettingColumnComponent>
  //     )}
  //     <StationContextMenuComponent
  //       contextData={contextData}
  //       setContextData={setContextData}
  //       stationIds={stationIds}
  //       setTimetable={setTimetable}
  //       selectedStationId={selectedStationId}
  //       showStationDetail={showStationDetail}
  //       // timetableDirection={timetableDirection}
  //     />
  //     <div
  //       onContextMenu={(e) => {
  //         const targetStation = (() => {
  //           for (const stationId of stationIds) {
  //             const id = 'dia-station-block-' + stationId;
  //             const elem = document.getElementById(id);
  //             if (elem && elem.contains(e.target as Node)) {
  //               return stationId;
  //             }
  //           }
  //           return null;
  //         })();

  //         if (targetStation) {
  //           e.preventDefault();
  //           setContextData({ visible: true, posX: e.pageX, posY: e.pageY });
  //           setSelectedStationId(targetStation);
  //         }
  //       }}
  //     >
  //       {stationIds.map((stationId) => (
  //         <div
  //           key={stationId}
  //           style={{ height: 24 * 3 + 'px', borderStyle: 'solid', borderWidth: '1px', paddingRight: '3px' }}
  //           id={'dia-station-block-' + stationId}
  //         >
  //           <StationComponent stationId={stationId} stations={stations} setStation={setStation} />
  //         </div>
  //       ))}
  //     </div>
  //     <div>
  //       <button
  //         onClick={() => {
  //           const newStation = createNewStation('-');

  //           setTimetable((draftTimetable, trainData, stationMap) => {
  //             draftTimetable.stationIds.push(newStation.stationId);

  //             createNewStationAndUpdate(trainData, newStation /* timetableDirection */);

  //             nn(stationMap).set(newStation.stationId, newStation);
  //           });
  //         }}
  //       >
  //         駅を追加
  //       </button>
  //     </div>
  //   </div>
  // );
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

export function StationDetailComponent({
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
