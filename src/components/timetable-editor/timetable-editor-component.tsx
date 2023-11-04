import { StateUpdater, useState } from 'preact/hooks';
import { importOutdiaFile } from '../../file';
import { RailwayLine } from '../../mapEditorModel';
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
import { OutlinedTimetable, OutlinedTimetableData } from '../../outlinedTimetableData';
import { SettingColumnComponent, TabComponent, reverseArray } from './common-component';
import { DiagramPageComponent } from './diagram-component';
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
  diaStations,
  setDiaStations,
  trains,
  otherDirectionTrains,
  crudTrain,
  timetableDirection,
  trainTypes,
  setSettingData,
  clipboard,
  setClipboard,
}: {
  diaStations: StationLike[];
  setDiaStations: (diaStations: StationLike[]) => void;
  trains: Train[];
  otherDirectionTrains: Train[];
  crudTrain: CrudTrain;
  timetableDirection: 'Inbound' | 'Outbound';
  trainTypes: TrainType[];
  setSettingData: (settingData: SettingData) => void;
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
}) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '24px' }}>列車番号</div>
        <div style={{ height: '24px' }}>列車名</div>
        <div style={{ height: '24px' }}>列車種別</div>
        <div style={{ height: '24px' }}>始発駅作業</div>
        <div style={{ height: '24px' }}>終着駅作業</div>
        <StationListComponent
          {...{ diaStations, trains, otherDirectionTrains, setDiaStations, timetableDirection, setSettingData }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <TrainListRowHeaderComponent diaStations={diaStations} />
      </div>
      <TrainListComponent
        {...{
          diaStations: diaStations,
          trains: trains,
          crudTrain,
          timetableDirection: timetableDirection,
          trainTypes,
          clipboard,
          setClipboard,
          setSettingData: setSettingData,
        }}
      />
    </div>
  );
}

export function TimetableEditorComponent({
  timetableData,
  timetable,
  railwayLine,
  tracks,
  setOutlinedTimetableData,
  setToast,
  update,
}: {
  timetableData: OutlinedTimetableData;
  timetable: OutlinedTimetable;
  railwayLine: RailwayLine;
  tracks: Track[];
  setOutlinedTimetableData: StateUpdater<OutlinedTimetableData>;
  setToast: (message: string) => void;
  update: () => void;
}) {
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');
  const [clipboard, setClipboard] = useState<AppClipboard>({
    trains: [],
    originalTrains: [],
  });
  const [settingData, setSettingData] = useState<SettingData | null>(null);

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

  const inboundTrains = timetable.inboundTrainIds.map((trainId) => timetableData.getTrain(trainId));
  const outboundTrains = timetable.outboundTrainIds.map((trainId) => timetableData.getTrain(trainId));

  // const updateTrains = () => {
  //   timetable.tr
  //   update();
  // }

  const setDiaStations = (stations: StationLike[]) => {
    timetable.stations = stations;
    update();
  };

  const setTrainTypes = (trainTypes: TrainType[]) => {
    timetable.trainTypes = trainTypes;
    update();
  };

  // const setTrains = (trains: Train[]) => {
  //   timetableData.setTrains(timetable.timetableId, trains, timetableDirection);

  //   update();
  // };

  const crudTrain = {
    addTrains: (trains: Train[], beforeTrainId: string | null = null) => {
      timetableData.addTrains(timetable.timetableId, trains, timetableDirection, beforeTrainId);
      update();
    },
    deleteTrain: (trainId: string) => {
      timetableData.deleteTrain(trainId);
      update();
    },
    updateTrain: (trainId: string, updater: (source: Train) => Train) => {
      timetableData.updateTrain(trainId, updater);
      update();
    },
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
      </div>
      <div style={{ display: 'flex' }}>
        <div style={{ flex: '1 1 auto' }}>
          <TabComponent
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
                      diaStations: timetable.stations,
                      setDiaStations: setDiaStations,
                      trains: inboundTrains,
                      otherDirectionTrains: outboundTrains,
                      crudTrain: crudTrain,
                      timetableDirection,
                      trainTypes: timetable.trainTypes,
                      setSettingData,
                      clipboard,
                      setClipboard,
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
                      diaStations: reverseArray(timetable.stations),
                      setDiaStations: (diaStations) => setDiaStations(reverseArray(diaStations)),
                      trains: outboundTrains,
                      otherDirectionTrains: inboundTrains,
                      crudTrain: crudTrain,
                      timetableDirection,
                      trainTypes: timetable.trainTypes,
                      setSettingData,
                      clipboard,
                      setClipboard,
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
                  <DiagramPageComponent
                    stations={timetable.stations}
                    inboundTrains={inboundTrains}
                    outboundTrains={outboundTrains}
                    operations={timetable.operations}
                    crudTrain={crudTrain}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
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
