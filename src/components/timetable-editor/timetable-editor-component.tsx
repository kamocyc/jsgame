import { produce } from 'immer';
import { useState } from 'preact/hooks';
import { DeepReadonly, assert } from 'ts-essentials';
import { nn } from '../../common';
import { importOutdiaFile } from '../../file';
import { OperationError, RailwayLine } from '../../mapEditorModel';
import {
  AppClipboard,
  CrudTrain,
  Depot,
  SettingData,
  Station,
  StationLike,
  TimetableDirection,
  Train,
  TrainType,
} from '../../model';
import {
  AddingNewTrain,
  HistoryItem,
  OutlinedTimetable,
  OutlinedTimetableData,
  OutlinedTimetableFunc,
} from '../../outlinedTimetableData';
import { MapInfo, SettingColumnComponent, TabComponent, reverseArray } from './common-component';
import { KonvaCanvas } from './diagram-component';
import { DiagramOperationComponent } from './diagram-operation-component';
import { DepotDetailComponent, SetTimetable, StationDetailComponent, StationListComponent } from './station-component';
import { StationTimetablePageComponent } from './timetable-component';
import './timetable-editor.css';
import { getInitialTimetable } from './timetable-util';
import { TrainListComponent } from './train-component';
import { TrainTypeSettingComponent } from './traintype-component';

export function TrainListRowHeaderComponent({ stations }: { stations: DeepReadonly<StationLike[]> }) {
  return (
    <div>
      {stations.map((_) => (
        <div style={{ height: 24 * 3 + 'px', borderStyle: 'solid', borderWidth: '1px', width: '32px' }}>
          <div style={{ height: 24 + 'px' }}>着</div>
          <div style={{ height: 24 + 'px' }}>番線</div>
          <div style={{ height: 24 + 'px' }}>発</div>
        </div>
      ))}
    </div>
  );
}

export function TimetableEditorTableComponent({
  stations,
  setStations,
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
          stations={stations}
          trains={trains}
          setTimetable={setTimetable}
          otherDirectionTrains={otherDirectionTrains}
          setStations={setStations}
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
        <TrainListRowHeaderComponent stations={stations} />
      </div>
      <TrainListComponent
        setTimetable={setTimetable}
        errors={errors}
        stations={stations}
        setStations={setStations}
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

export type TimetableEditorDirectedProps = DeepReadonly<{
  stations: StationLike[];
  setStations: (diaStations: StationLike[]) => void;
  trains: readonly Train[];
  otherDirectionTrains: readonly Train[];
  crudTrain: CrudTrain;
  setTimetable: SetTimetable;
  timetableDirection: TimetableDirection;
  trainTypes: TrainType[];
  setSettingData: (settingData: DeepReadonly<SettingData>) => void;
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
  railwayLine: RailwayLine;
  timetable: OutlinedTimetable;
  errors: readonly OperationError[];
}>;

export type TimetableEditorComponentProps = DeepReadonly<{
  timetableData: OutlinedTimetableData;
  setTimetableData: (f: (draftTimetableData: OutlinedTimetableData) => undefined | HistoryItem) => void;
  timetable: OutlinedTimetable;
  railwayLine: RailwayLine;
  mapInfo: MapInfo;
  setToast: (message: string) => void;
  update: () => void;
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
    originalTrains: [],
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
  //     outlinedTimetable.stations.some(
  //       (station) => !timetable.stations.some((station2) => station.stationId === station2.stationId)
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
    timetable.inboundTrainIds.map((trainId) => nn(timetableData._trains.find((t) => t.trainId === trainId))),
    timetable.outboundTrainIds.map((trainId) => nn(timetableData._trains.find((t) => t.trainId === trainId))),
  ];

  const setTimetable: (f: (draftTimetable: OutlinedTimetable) => void) => void = (
    timetableFunction: (oldTimetable: OutlinedTimetable) => void
  ) => {
    setTimetableData((draftTimetableData) => {
      return OutlinedTimetableFunc.updateTimetable(draftTimetableData, timetable.timetableId, timetableFunction);
    });
    const newTimetable = produce(timetable, timetableFunction);
    // timetableData.updateTimetable(newTimetable);
    // update();
  };

  const setStations = (stations: StationLike[]) => {
    setTimetable((draftTimetable) => {
      draftTimetable.stations = stations;
    });
  };

  const setStation = (stationId: string) => (f: (station: Station) => void) => {
    setTimetable((draftTimetable) => {
      const station = draftTimetable.stations.find((station_) => station_.stationId === stationId);
      assert(station !== undefined, 'stationIdが見つかりません');
      assert(station.stationType === 'Station', 'stationTypeがStationではありません');
      f(station);
    });
  };

  const setDepot = (stationId: string) => (f: (station: Depot) => void) => {
    setTimetable((draftTimetable) => {
      const station = draftTimetable.stations.find((station_) => station_.stationId === stationId);
      assert(station !== undefined, 'stationIdが見つかりません');
      assert(station.stationType === 'Depot', 'stationTypeがDepotではありません');
      f(station);
    });
  };

  const setTrainTypes = (trainTypes: TrainType[]) => {
    setTimetable((draftTimetable) => {
      draftTimetable.trainTypes = trainTypes;
    });
  };

  // const updateTrain = (historyItem: HistoryItem) => {
  //   timetableData.commitTrain(historyItem);
  //   update();
  // };

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
    updateTrain: (trainId, redo, undo) => {
      setTimetableData((draftTimetableData) => {
        return OutlinedTimetableFunc.updateTrain(draftTimetableData, timetable.timetableId, trainId, redo, undo);
      });
    },
  };

  const getInboundAndOutboundTrains = (draftTimetableData: OutlinedTimetableData) => {
    const draftTimetable = nn(
      draftTimetableData._timetables.find((timetable_) => timetable_.timetableId === timetable.timetableId)
    );
    const [inboundTrains, outboundTrains] = [
      draftTimetable.inboundTrainIds.map((trainId) =>
        nn(draftTimetableData._trains.find((t) => t.trainId === trainId))
      ),
      draftTimetable.outboundTrainIds.map((trainId) =>
        nn(draftTimetableData._trains.find((t) => t.trainId === trainId))
      ),
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
              const [newTimetable, newTrains] = getInitialTimetable(railwayLine);
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
                    stations={timetable.stations}
                    setStations={setStations}
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
                    stations={reverseArray(timetable.stations)}
                    setStations={(stations) => setStations(reverseArray(stations))}
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
                    diaStations={timetable.stations}
                    inboundTrains={inboundTrains}
                    outboundTrains={outboundTrains}
                  />
                ),
              },
              {
                tabId: 5,
                tabText: 'ダイヤグラム',
                component: () => (
                  <KonvaCanvas
                    timetable={timetable}
                    stations={timetable.stations}
                    inboundTrains={inboundTrains}
                    outboundTrains={outboundTrains}
                    crudTrain={crudTrain}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                    railwayLine={railwayLine}
                    errors={errors}
                    getTrainsWithDirections={() => {
                      return [
                        timetable.inboundTrainIds.map((trainId) =>
                          nn(timetableData._trains.find((t) => t.trainId === trainId))
                        ),
                        timetable.outboundTrainIds.map((trainId) =>
                          nn(timetableData._trains.find((t) => t.trainId === trainId))
                        ),
                      ];
                    }}
                  />
                ),
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
              settingData.station.stationType === 'Station' ? (
                <StationDetailComponent
                  diaStation={settingData.station}
                  setStation={setStation(settingData.station.stationId)}
                />
              ) : (
                <DepotDetailComponent depot={settingData.station} setDepot={setDepot(settingData.station.stationId)} />
              )
            ) : settingData.settingType === 'StationOperationSetting' ? (
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
