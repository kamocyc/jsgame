import { useState } from 'react';
import { DeepReadonly } from 'ts-essentials';
import { nn } from '../../common';
import { importOutdiaFile } from '../../file';
import { OperationError, RailwayLine } from '../../mapEditorModel';
import { AppClipboard, CrudTrain, SettingData, StationLike, TimetableDirection, Train, TrainType } from '../../model';
import {
  AddingNewTrain,
  OutlinedTimetable,
  OutlinedTimetableData,
  OutlinedTimetableFunc,
} from '../../outlinedTimetableData';
import {
  MapInfo,
  SetTimetable,
  SettingColumnComponent,
  TabComponent,
  getStationMap,
  reverseArray,
} from './common-component';
import { KonvaCanvas } from './diagram-component';
import { DiagramOperationComponent } from './diagram-operation-component';
// import { SetTimetable, StationListComponent } from './station-component';
import { RecoilRoot } from 'recoil';
import { StationListComponent } from './station-component';
import { StationTimetablePageComponent } from './timetable-component';
import './timetable-editor.css';
import { getInitialTimetable } from './timetable-util';
import { TrainListComponent } from './train-component';
import { TrainTypeSettingComponent } from './traintype-component';

export function TrainListRowHeaderComponent({ stationIds }: { stationIds: DeepReadonly<string[]> }) {
  return (
    <div>
      {stationIds.map((stationId) => (
        <div key={stationId} style={{ height: 24 * 3 + 'px', borderStyle: 'solid', borderWidth: '1px', width: '32px' }}>
          <div style={{ height: 24 + 'px' }}>着</div>
          <div style={{ height: 24 + 'px' }}>番線</div>
          <div style={{ height: 24 + 'px' }}>発</div>
        </div>
      ))}
    </div>
  );
}

export function TimetableEditorTableComponent({
  stationIds,
  trains,
  otherDirectionTrains,
  setTimetable,
  crudTrain,
  timetableDirection,
  trainTypes,
  setSettingData,
  clipboard,
  setClipboard,
  railwayLine,
  timetable,
  errors,
  stations,
}: TimetableEditorDirectedProps) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '15px' }}></div>
        <div style={{ height: '24px' }}>列車番号</div>
        <div style={{ height: '24px' }}>列車名</div>
        <div style={{ height: '24px' }}>列車種別</div>
        {/* <div style={{ height: '24px' }}>始発駅作業</div>
        <div style={{ height: '24px' }}>終着駅作業</div> */}
        <StationListComponent
          stationIds={stationIds}
          stations={stations}
          trains={trains}
          setTimetable={setTimetable}
          otherDirectionTrains={otherDirectionTrains}
          timetableDirection={timetableDirection}
          setSettingData={setSettingData}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '15px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        {/* <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div> */}
        <TrainListRowHeaderComponent stationIds={stationIds} />
      </div>
      <TrainListComponent
        stations={stations}
        setTimetable={setTimetable}
        errors={errors}
        stationIds={stationIds}
        trains={trains}
        otherDirectionTrains={otherDirectionTrains}
        crudTrain={crudTrain}
        timetableDirection={timetableDirection}
        trainTypes={trainTypes}
        setSettingData={setSettingData}
        clipboard={clipboard}
        setClipboard={setClipboard}
        railwayLine={railwayLine}
        timetable={timetable}
      />
    </div>
  );
}

export type TimetableEditorDirectedProps = {
  readonly stationIds: DeepReadonly<string[]>;
  // readonly setStations: (diaStations: StationLike[]) => void;
  readonly stations: DeepReadonly<StationLike[]>;
  readonly trains: DeepReadonly<Train[]>;
  readonly otherDirectionTrains: DeepReadonly<readonly Train[]>;
  readonly crudTrain: DeepReadonly<CrudTrain>;
  readonly setTimetable: SetTimetable;
  readonly timetableDirection: DeepReadonly<TimetableDirection>;
  readonly trainTypes: DeepReadonly<TrainType[]>;
  readonly setSettingData: (settingData: DeepReadonly<SettingData>) => void;
  readonly clipboard: AppClipboard;
  readonly setClipboard: (clipboard: AppClipboard) => void;
  readonly railwayLine: DeepReadonly<RailwayLine>;
  readonly timetable: DeepReadonly<OutlinedTimetable>;
  readonly errors: DeepReadonly<OperationError[]>;
};

export type TimetableEditorComponentProps = DeepReadonly<{
  timetableData: OutlinedTimetableData;
  setTimetableData: (f: (draftTimetableData: OutlinedTimetableData) => void) => void;
  timetable: OutlinedTimetable;
  railwayLine: RailwayLine;
  mapInfo: MapInfo;
  setToast: (message: string) => void;
  errors: OperationError[];
}>;

// const getTrainsWithDirections: (
//   timetable: OutlinedTimetable,
//   timetableData: OutlinedTimetableData
// ) => [readonly Train[], readonly Train[]] = (timetable: OutlinedTimetable, timetableData: OutlinedTimetableData) => {
//   return [
//     timetable.inboundTrainIds.map((trainId) => OutlinedTimetableFunc.getTrain(timetableData, trainId)),
//     timetable.outboundTrainIds.map((trainId) => OutlinedTimetableFunc.getTrain(timetableData, trainId)),
//   ];
// };

export function TimetableEditorComponent({
  timetableData,
  timetable,
  railwayLine,
  mapInfo,
  setTimetableData,
  errors,
}: TimetableEditorComponentProps) {
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');
  const [clipboard, setClipboard] = useState<AppClipboard>({
    trains: [],
    originalTrainIds: [],
  });
  const [settingData, setSettingData] = useState<DeepReadonly<SettingData> | null>(null);

  const [resetSeed, setResetSeed] = useState(1);
  const reset = () => {
    setResetSeed(Math.random());
  };

  // function mergeTimetable(diagram: [OutlinedTimetable, Train[]]) {
  //   const [outlinedTimetable, trains] = diagram;

  //   // 存在しないstationがある
  //   if (
  //     outlinedTimetable.stationIds.some(
  //       (station) => !timetable.stationIds.some((station2) => station.stationId === station2.stationId)
  //     )
  //   ) {
  //     return {
  //       error: '存在しない駅があります',
  //     };
  //   }

  //   timetable.inboundTrainIds = outlinedTimetable.inboundTrainIds;
  //   timetable.outboundTrainIds = outlinedTimetable.outboundTrainIds;
  //   timetable.operations = outlinedTimetable.operations;
  //   timetable.trainTypes = outlinedTimetable.trainTypes;
  //   timetableData.getTrains().push(...trains); // なんか重複するのもできそうな気がするが... とりあえず問題になったら考え

  //   return true;
  // }

  const [inboundTrains, outboundTrains] = [
    timetable.inboundTrainIds.map((trainId) => nn(timetableData._trains.get(trainId))),
    timetable.outboundTrainIds.map((trainId) => nn(timetableData._trains.get(trainId))),
  ];

  const setTimetable: (f: (draftTimetable: OutlinedTimetable) => void) => void = (
    timetableFunction: (oldTimetable: OutlinedTimetable) => void
  ) => {
    setTimetableData((draftTimetableData) => {
      return OutlinedTimetableFunc.updateTimetable(draftTimetableData, timetable.timetableId, timetableFunction);
    });
  };

  // const setStations = (stations: StationLike[]) => {

  //   setTimetableData((draftTimetableData) => {
  //     return OutlinedTimetableFunc.updateTimetable(draftTimetableData, timetable.timetableId, (draftTimetable) => {);
  //   });

  //   setTimetable((draftTimetable) => {
  //     draftTimetable.stationIds = stations;
  //   });
  // };

  // const setStation = (stationId: string) => (f: (station: Station) => void) => {
  //   setTimetable((draftTimetable) => {
  //     const station = draftTimetable.stationIds.find((stationId_) => stationId_ === stationId);
  //     assert(station !== undefined, 'stationIdが見つかりません');
  //     assert(station.stationType === 'Station', 'stationTypeがStationではありません');
  //     f(station);
  //   });
  // };

  // const setDepot = (stationId: string) => (f: (station: Depot) => void) => {
  //   setTimetable((draftTimetable) => {
  //     const station = draftTimetable.stationIds.find((stationId_) => stationId_ === stationId);
  //     assert(station !== undefined, 'stationIdが見つかりません');
  //     assert(station.stationType === 'Depot', 'stationTypeがDepotではありません');
  //     f(station);
  //   });
  // };

  const setTrainTypes = (trainTypes: TrainType[]) => {
    setTimetable((draftTimetable) => {
      draftTimetable.trainTypes = trainTypes;
    });
  };

  const timetableTrains = new Map(
    [...timetable.inboundTrainIds, ...timetable.outboundTrainIds].map((trainId) => [
      trainId,
      nn(timetableData._trains.get(trainId)),
    ])
  );

  const crudTrain: CrudTrain = {
    addTrains: (addingNewTrains: AddingNewTrain[]) => {
      setTimetableData((draftTimetableData) => {
        return OutlinedTimetableFunc.addTrains(draftTimetableData, timetable.timetableId, addingNewTrains);
      });
    },
    addTrain: (train: Train, direction: 'Inbound' | 'Outbound') => {
      setTimetableData((draftTimetableData) => {
        return OutlinedTimetableFunc.addTrain(draftTimetableData, timetable.timetableId, train, direction);
      });
    },
    deleteTrains: (trainIds: string[]) => {
      setTimetableData((draftTimetableData) => {
        return OutlinedTimetableFunc.deleteTrains(draftTimetableData, timetable.timetableId, trainIds);
      });
    },
    updateTrain: (trainId, updater) => {
      setTimetableData((draftTimetableData) => {
        OutlinedTimetableFunc.updateTrain(draftTimetableData, timetable.timetableId, trainId, updater);
      });
    },
    setTrains: (setter) => {
      setTimetableData((draftTimetableData) => {
        const trains = new Map(
          [...draftTimetableData._trains.values()]
            .filter((train) => timetableTrains.has(train.trainId))
            .map((t) => [t.trainId, t])
        );
        setter(trains);
      });
    },
  };

  const getInboundAndOutboundTrains = (draftTimetableData: OutlinedTimetableData) => {
    const draftTimetable = nn(
      draftTimetableData._timetables.find((timetable_) => timetable_.timetableId === timetable.timetableId)
    );
    const [inboundTrains, outboundTrains] = [
      draftTimetable.inboundTrainIds.map((trainId) => nn(draftTimetableData._trains.get(trainId))),
      draftTimetable.outboundTrainIds.map((trainId) => nn(draftTimetableData._trains.get(trainId))),
    ];

    return [draftTimetable, inboundTrains, outboundTrains] as const;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div>
        <div
          style={{
            display: 'inline-block',
            borderStyle: 'solid',
            borderWidth: '1px',
            padding: '2px',
          }}
        >
          OudiaSecondV2 Import
          <input
            type='file'
            id='file-selector'
            accept='.oud2'
            onChange={async (event) => {
              // TODO
              // @ts-ignore
              const diagram = await importOutdiaFile(event);
              if (diagram != null) {
                // TODO
                // timetableData.clearTimetable(timetable.timetableId);
                // const result = mergeTimetable(diagram);
                // if (result !== true) {
                //   setToast(result.error);
                // }
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            setTimetableData((draftTimetableData) => {
              return OutlinedTimetableFunc.reverseTimetableDirection(draftTimetableData, timetable.timetableId);
            });
            // reset();
          }}
        >
          上り下りを反転
        </button>
        <button
          onClick={() => {
            if (!confirm('全てクリアしますか？')) {
              return;
            }

            setTimetableData((draftTimetableData) => {
              OutlinedTimetableFunc.clearTimetable(draftTimetableData, timetable.timetableId);
              const [newTimetable, newTrains] = getInitialTimetable(
                getStationMap(draftTimetableData._stations),
                railwayLine
              );
              OutlinedTimetableFunc.addTimetable(draftTimetableData, newTimetable, newTrains);
              return undefined;
            });
          }}
        >
          初期化
        </button>
        <button
          onClick={() => {
            setTimetableData((draftTimetableData) => {
              OutlinedTimetableFunc.repeatTrainsInTimetable(draftTimetableData, timetable.timetableId);
              return undefined;
            });
          }}
        >
          繰り返し
        </button>
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: '1 1 auto' }}>
          <TabComponent
            key={resetSeed}
            onTabChange={(tabId) => {
              setTimetableDirection(tabId === 1 ? 'Inbound' : 'Outbound');
            }}
            tabs={[
              {
                tabId: 1,
                tabText: '上り',
                component: () => (
                  <TimetableEditorTableComponent
                    stations={timetableData._stations}
                    stationIds={timetable.stationIds}
                    trains={inboundTrains}
                    otherDirectionTrains={outboundTrains}
                    setTimetable={(f) => {
                      setTimetableData((draftTimetableData) => {
                        const [draftTimetable, inboundTrains, outboundTrains] =
                          getInboundAndOutboundTrains(draftTimetableData);
                        f(draftTimetable, { trains: inboundTrains, otherDirectionTrains: outboundTrains });
                        return undefined;
                      });
                    }}
                    crudTrain={crudTrain}
                    timetableDirection={timetableDirection}
                    trainTypes={timetable.trainTypes}
                    setSettingData={setSettingData}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    railwayLine={railwayLine}
                    timetable={timetable}
                    errors={errors}
                  />
                ),
              },
              {
                tabId: 2,
                tabText: '下り',
                component: () => (
                  <TimetableEditorTableComponent
                    stations={reverseArray(timetableData._stations)}
                    stationIds={reverseArray(timetable.stationIds)}
                    trains={outboundTrains}
                    otherDirectionTrains={inboundTrains}
                    setTimetable={(f) => {
                      setTimetableData((draftTimetableData) => {
                        const [draftTimetable, inboundTrains, outboundTrains] =
                          getInboundAndOutboundTrains(draftTimetableData);
                        f(draftTimetable, { trains: outboundTrains, otherDirectionTrains: inboundTrains });
                        return undefined;
                      });
                    }}
                    crudTrain={crudTrain}
                    timetableDirection={timetableDirection}
                    trainTypes={timetable.trainTypes}
                    setSettingData={setSettingData}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    railwayLine={railwayLine}
                    timetable={timetable}
                    errors={errors}
                  />
                ),
              },
              {
                tabId: 3,
                tabText: '種別の設定',
                component: () => (
                  <TrainTypeSettingComponent trainTypes={timetable.trainTypes} setTrainTypes={setTrainTypes} />
                ),
              },
              {
                tabId: 4,
                tabText: '駅時刻表',
                component: () => (
                  <StationTimetablePageComponent
                    stationMap={getStationMap(timetableData._stations)}
                    stationIds={timetable.stationIds}
                    inboundTrains={inboundTrains}
                    outboundTrains={outboundTrains}
                  />
                ),
              },
              {
                tabId: 5,
                tabText: 'ダイヤグラム',
                component: () => {
                  return (
                    <RecoilRoot>
                      <KonvaCanvas
                        timetable={timetable}
                        stations={timetableData._stations}
                        stationIds={timetable.stationIds}
                        trains={timetableTrains}
                        crudTrain={crudTrain}
                        clipboard={clipboard}
                        setClipboard={setClipboard}
                        railwayLine={railwayLine}
                        errors={errors}
                      />
                    </RecoilRoot>
                  );
                },
              },
              {
                tabId: 6,
                tabText: '運用表',
                component: () => (
                  <DiagramOperationComponent
                    inboundTrains={inboundTrains}
                    outboundTrains={outboundTrains}
                    operations={timetable.operations}
                    timetable={timetable}
                    stationMap={getStationMap(timetableData._stations)}
                  />
                ),
              },
            ]}
          />
        </div>
        {settingData == null ? (
          <></>
        ) : (
          <SettingColumnComponent setSettingData={setSettingData} width='250px'>
            {settingData.settingType === 'StationSetting' ? (
              <></>
            ) : // TODO: あとで実装
            // settingData.stationId.stationType === 'Station' ? (
            //   <StationDetailComponent
            //     diaStation={settingData.stationId}
            //     setStation={setStation(settingData.stationId.stationId)}
            //   />
            // ) : (
            //   <DepotDetailComponent
            //     depot={settingData.stationId}
            //     setDepot={setDepot(settingData.stationId.stationId)}
            //   />
            // )
            settingData.settingType === 'StationOperationSetting' ? (
              // <StationOperationSettingComponent
              //   timetable={timetable}
              //   firstOrLast={settingData.firstOrLast}
              //   setStationOperation={(stationOperation) => {
              //     if (settingData.firstOrLast === 'First') {
              //       settingData.train.firstStationOperation = stationOperation;
              //     } else {
              //       settingData.train.lastStationOperation = stationOperation;
              //     }
              //     update();
              //   }}
              //   stationOperation={
              //     settingData.firstOrLast === 'First'
              //       ? settingData.train.firstStationOperation
              //       : settingData.train.lastStationOperation
              //   }
              //   stations={timetable.stations}
              //   mapInfo={mapInfo}
              //   train={settingData.train}
              // />
              <></>
            ) : (
              <></>
            )}
          </SettingColumnComponent>
        )}
      </div>
    </div>
  );
}
