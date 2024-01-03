import { useState } from 'react';
import { useRecoilState } from 'recoil';
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
import { shouldChangeAfterTimeAtom, shouldDisplaySecondAtom, timeUnitAtom } from '../konva-diagram-editor/konva-util';
import { SetTimetable, SettingColumnComponent, TabComponent, getStationMap, reverseArray } from './common-component';
import { KonvaCanvas } from './diagram-component';
import { DiagramOperationComponent } from './diagram-operation-component';
import { StationListComponent } from './station-list-component';
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
  readonly railwayLine: DeepReadonly<RailwayLine> | null;
  readonly timetable: DeepReadonly<OutlinedTimetable>;
  readonly errors: DeepReadonly<OperationError[]>;
};

export type TimetableEditorComponentProps = DeepReadonly<{
  timetableData: OutlinedTimetableData;
  setTimetableData: (f: (draftTimetableData: OutlinedTimetableData) => void) => void;
  stationMap: Map<string, StationLike>;
  timetable: OutlinedTimetable;
  railwayLine: RailwayLine;
  setToast: (message: string) => void;
  errors: OperationError[];
}>;

export function TimetableEditorComponent({
  timetableData,
  timetable,
  stationMap,
  railwayLine,
  setTimetableData,
  errors,
}: TimetableEditorComponentProps) {
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');
  const [clipboard, setClipboard] = useState<AppClipboard>({
    trains: [],
    originalTrainIds: [],
  });
  const [settingData, setSettingData] = useState<DeepReadonly<SettingData> | null>(null);
  const [shouldChangeAfterTime, setShouldChangeAfterTime] = useRecoilState(shouldChangeAfterTimeAtom);
  const [shouldDisplaySecond, setShouldDisplaySecond] = useRecoilState(shouldDisplaySecondAtom);
  const [timeUnit, setTimeUnit] = useRecoilState(timeUnitAtom);
  const [resetSeed, setResetSeed] = useState(1);

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

  const stations = timetable.stationIds.map((stationId) => nn(stationMap.get(stationId)));

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
              return OutlinedTimetableFunc.reverseTimetableDirection(
                draftTimetableData,
                timetable.timetableId,
                stationMap
              );
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
              const [newTimetable, newTrains] = getInitialTimetable(stationMap, railwayLine);
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
        <label>
          後の時刻を共に移動
          <input
            type='checkbox'
            checked={shouldChangeAfterTime}
            onChange={(e) => {
              setShouldChangeAfterTime(e.target.checked);
            }}
          />
        </label>
        <label>
          秒を表示
          <input
            name='checkbox_shouldDisplaySecond'
            type='checkbox'
            checked={shouldDisplaySecond}
            onChange={(e) => {
              setShouldDisplaySecond(e.target.checked);
            }}
          />
        </label>
        <label>
          時間の変更単位
          <select
            value={timeUnit}
            onChange={(e) => {
              setTimeUnit(parseInt(e.target.value));
            }}
          >
            <option value='1'>1</option>
            <option value='5'>5</option>
            <option value='10'>10</option>
            <option value='15'>15</option>
            <option value='20'>20</option>
            <option value='30'>30</option>
            <option value='60'>60</option>
          </select>
        </label>
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
                    stations={stations}
                    stationIds={timetable.stationIds}
                    trains={inboundTrains}
                    otherDirectionTrains={outboundTrains}
                    setTimetable={(f) => {
                      setTimetableData((draftTimetableData) => {
                        const [draftTimetable, inboundTrains, outboundTrains] =
                          getInboundAndOutboundTrains(draftTimetableData);
                        f(draftTimetable, { trains: inboundTrains, otherDirectionTrains: outboundTrains }, null);
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
                    stations={reverseArray(stations)}
                    stationIds={reverseArray(timetable.stationIds)}
                    trains={outboundTrains}
                    otherDirectionTrains={inboundTrains}
                    setTimetable={(f) => {
                      setTimetableData((draftTimetableData) => {
                        const [draftTimetable, inboundTrains, outboundTrains] =
                          getInboundAndOutboundTrains(draftTimetableData);
                        f(draftTimetable, { trains: outboundTrains, otherDirectionTrains: inboundTrains }, null);
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
                    stationMap={getStationMap(stations)}
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
                    <KonvaCanvas
                      timetable={timetable}
                      stations={stations}
                      stationIds={timetable.stationIds}
                      trains={timetableTrains}
                      crudTrain={crudTrain}
                      clipboard={clipboard}
                      setClipboard={setClipboard}
                      railwayLine={railwayLine}
                      errors={errors}
                    />
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
                    stationMap={getStationMap(stations)}
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
