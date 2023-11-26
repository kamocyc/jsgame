import { useState } from 'preact/hooks';
import { importOutdiaFile } from '../../file';
import { OperationError, RailwayLine } from '../../mapEditorModel';
import {
  AppClipboard,
  CrudTrain,
  SettingData,
  StationLike,
  TimetableDirection,
  Track,
  Train,
  TrainType,
} from '../../model';
import { AddingNewTrain, HistoryItem, OutlinedTimetable, OutlinedTimetableData } from '../../outlinedTimetableData';
import { SettingColumnComponent, TabComponent, reverseArray } from './common-component';
import { KonvaCanvas } from './diagram-component';
import { DiagramOperationComponent } from './diagram-operation-component';
import { StationDetailComponent, StationListComponent } from './station-component';
import { StationOperationSettingComponent } from './station-operation-setting-component';
import { StationTimetablePageComponent } from './timetable-component';
import './timetable-editor.css';
import { getInitialTimetable } from './timetable-util';
import { TrainListComponent } from './train-component';
import { TrainTypeSettingComponent } from './traintype-component';

export function TrainListRowHeaderComponent({ diaStations }: { diaStations: StationLike[] }) {
  return (
    <div>
      {diaStations.map((diaStation) => (
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
          {...{
            diaStations: stations,
            trains,
            otherDirectionTrains,
            setDiaStations: setStations,
            timetableDirection,
            setSettingData,
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '15px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        {/* <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div> */}
        <TrainListRowHeaderComponent diaStations={stations} />
      </div>
      <TrainListComponent
        {...{
          errors,
          stations,
          setStations,
          trains,
          otherDirectionTrains,
          crudTrain,
          timetableDirection,
          trainTypes,
          setSettingData,
          clipboard,
          setClipboard,
          railwayLine,
          timetable,
        }}
      />
    </div>
  );
}

export interface TimetableEditorDirectedProps {
  stations: StationLike[];
  setStations: (diaStations: StationLike[]) => void;
  trains: readonly Train[];
  otherDirectionTrains: readonly Train[];
  crudTrain: CrudTrain;
  timetableDirection: TimetableDirection;
  trainTypes: TrainType[];
  setSettingData: (settingData: SettingData) => void;
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
  railwayLine: RailwayLine;
  timetable: OutlinedTimetable;
  errors: OperationError[];
}

export function TimetableEditorComponent({
  timetableData,
  timetable,
  railwayLine,
  tracks,
  setToast,
  update,
  errors,
}: {
  timetableData: OutlinedTimetableData;
  timetable: OutlinedTimetable;
  railwayLine: RailwayLine;
  tracks: Track[];
  setToast: (message: string) => void;
  update: () => void;
  errors: OperationError[];
}) {
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');
  const [clipboard, setClipboard] = useState<AppClipboard>({
    trains: [],
    originalTrains: [],
  });
  const [settingData, setSettingData] = useState<SettingData | null>(null);

  const [resetSeed, setResetSeed] = useState(1);
  const reset = () => {
    setResetSeed(Math.random());
  };

  function mergeTimetable(diagram: [OutlinedTimetable, Train[]]) {
    const [outlinedTimetable, trains] = diagram;

    // 存在しないstationがある
    if (
      outlinedTimetable.stations.some(
        (station) => !timetable.stations.some((station2) => station.stationId === station2.stationId)
      )
    ) {
      return {
        error: '存在しない駅があります',
      };
    }

    timetable.inboundTrainIds = outlinedTimetable.inboundTrainIds;
    timetable.outboundTrainIds = outlinedTimetable.outboundTrainIds;
    timetable.operations = outlinedTimetable.operations;
    timetable.trainTypes = outlinedTimetable.trainTypes;
    timetableData.getTrains().push(...trains); // なんか重複するのもできそうな気がするが... とりあえず問題になったら考え

    return true;
  }

  const getTrainsWithDirections: () => [readonly Train[], readonly Train[]] = () => {
    return [
      timetable.inboundTrainIds.map((trainId) => timetableData.getTrain(trainId)),
      timetable.outboundTrainIds.map((trainId) => timetableData.getTrain(trainId)),
    ];
  };
  const [inboundTrains, outboundTrains] = getTrainsWithDirections();

  const setDiaStations = (stations: StationLike[]) => {
    timetable.stations = stations;
    update();
  };

  const setTrainTypes = (trainTypes: TrainType[]) => {
    timetable.trainTypes = trainTypes;
    update();
  };

  const updateTrain = (historyItem: HistoryItem) => {
    timetableData.commitTrain(historyItem);
    update();
  };

  const crudTrain: CrudTrain = {
    addTrains: (addingNewTrains: AddingNewTrain[]) => {
      timetableData.addTrains(timetable.timetableId, addingNewTrains);
      update();
    },
    addTrain: (train: Train, direction: 'Inbound' | 'Outbound') => {
      timetableData.addTrain(timetable.timetableId, train, direction);
      update();
    },
    deleteTrains: (trainIds: string[]) => {
      timetableData.deleteTrains(timetable.timetableId, trainIds);
      update();
    },
    updateTrain: updateTrain,
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
                timetableData.clearTimetable(timetable.timetableId);
                const result = mergeTimetable(diagram);
                if (result !== true) {
                  setToast(result.error);
                }
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            timetableData.reverseTimetableDirection(timetable.timetableId);
            reset();
          }}
        >
          上り下りを反転
        </button>
        <button
          onClick={() => {
            if (!confirm('全てクリアしますか？')) {
              return;
            }

            timetableData.clearTimetable(timetable.timetableId);
            const [newTimetable, newTrains] = getInitialTimetable(railwayLine);
            timetableData.addTimetable(newTimetable, newTrains);
          }}
        >
          初期化
        </button>
        <button
          onClick={() => {
            timetableData.repeatTimetable(timetable.timetableId);
            update();
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
                    {...{
                      stations: timetable.stations,
                      setStations: setDiaStations,
                      trains: inboundTrains,
                      otherDirectionTrains: outboundTrains,
                      crudTrain: crudTrain,
                      timetableDirection,
                      trainTypes: timetable.trainTypes,
                      setSettingData,
                      clipboard,
                      setClipboard,
                      railwayLine,
                      timetable,
                      errors,
                    }}
                  />
                ),
              },
              {
                tabId: 2,
                tabText: '下り',
                component: () => (
                  <TimetableEditorTableComponent
                    {...{
                      stations: reverseArray(timetable.stations),
                      setStations: (diaStations) => setDiaStations(reverseArray(diaStations)),
                      trains: outboundTrains,
                      otherDirectionTrains: inboundTrains,
                      crudTrain: crudTrain,
                      timetableDirection,
                      trainTypes: timetable.trainTypes,
                      setSettingData,
                      clipboard,
                      setClipboard,
                      railwayLine,
                      timetable,
                      errors,
                    }}
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
                    getTrainsWithDirections={() => {
                      return getTrainsWithDirections();
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
                    setUpdate={() => {
                      update();
                    }}
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
              <StationDetailComponent
                diaStation={settingData.station}
                setDiaStation={(diaStation) => {
                  setDiaStations(
                    timetable.stations.map((diaStation_) =>
                      diaStation_.stationId === diaStation.stationId ? diaStation : diaStation_
                    )
                  );
                }}
              />
            ) : settingData.settingType === 'StationOperationSetting' ? (
              <StationOperationSettingComponent
                timetable={timetable}
                firstOrLast={settingData.firstOrLast}
                setStationOperation={(stationOperation) => {
                  if (settingData.firstOrLast === 'First') {
                    settingData.train.firstStationOperation = stationOperation;
                  } else {
                    settingData.train.lastStationOperation = stationOperation;
                  }
                  update();
                }}
                stationOperation={
                  settingData.firstOrLast === 'First'
                    ? settingData.train.firstStationOperation
                    : settingData.train.lastStationOperation
                }
                stations={timetable.stations}
                tracks={tracks}
                train={settingData.train}
              />
            ) : (
              <></>
            )}
          </SettingColumnComponent>
        )}
      </div>
    </div>
  );
}
