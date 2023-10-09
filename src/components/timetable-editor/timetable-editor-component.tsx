import { StateUpdater, useState } from 'preact/hooks';
import { JSON_decycle } from '../../cycle';
import { loadFile } from '../../file';
import { AppStates } from '../../mapEditorModel';
import {
  AppClipboard,
  OutlinedTimetable,
  SettingData,
  Station,
  TimetableData,
  TimetableDirection,
  Train,
  TrainType,
} from '../../model';
import { createAgentManager } from '../track-editor/agentManager';
import { createOperations, toDetailedTimetable, toOutlinedTimetableStations } from '../track-editor/timetableConverter';
import { createTrainMove } from '../track-editor/trainMoveBase';
import { SettingColumnComponent, TabComponent, reverseArray } from './common-component';
import { DiagramPageComponent } from './diagram-component';
import { StationDetailComponent, StationListComponent } from './station-component';
import { StationTimetablePageComponent } from './timetable-component';
import './timetable-editor.css';
import { getInitialTimetable, reverseTimetableDirection } from './timetable-util';
import { TrainListComponent } from './train-component';
import { TrainTypeSettingComponent } from './traintype-component';
import { DiagramOperationComponent } from './diagram-operation-component';

export function TrainListRowHeaderComponent({ diaStations }: { diaStations: Station[] }) {
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
  setTrains,
  timetableDirection,
  trainTypes,
  setSettingData,
  clipboard,
  setClipboard,
}: {
  diaStations: Station[];
  setDiaStations: (diaStations: Station[]) => void;
  trains: Train[];
  otherDirectionTrains: Train[];
  setTrains: (trains: Train[]) => void;
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
        <TrainListRowHeaderComponent diaStations={diaStations} />
      </div>
      <TrainListComponent
        {...{
          diaStations: diaStations,
          trains: trains,
          setTrains: (trains) => {
            setTrains([...trains]);
          },
          timetableDirection: timetableDirection,
          trainTypes,
          clipboard,
          setClipboard,
        }}
      />
    </div>
  );
}

function saveTimetableDataFile(appStates: AppStates) {
  const buf = toStringTimeTableData(appStates);

  const link = document.createElement('a');
  const content = buf;
  const file = new Blob([content], { type: 'application/json' });
  link.href = URL.createObjectURL(file);
  link.download = 'timetable_data.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function toStringTimeTableData(appStates: AppStates) {
  const obj = {
    timetableData: appStates.timetableData,
  };

  return JSON.stringify(JSON_decycle(obj), null, 2);
}

export function TimetableEditorComponent({
  appStates,
  setAppStates,
}: {
  appStates: AppStates;
  setAppStates: StateUpdater<AppStates>;
}) {
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');
  const [clipboard, setClipboard] = useState<AppClipboard>({
    trains: [],
    originalTrains: [],
  });
  const [settingData, setSettingData] = useState<SettingData | null>(null);

  const timetableData = appStates.timetableData;

  const setTimetableData = (timetableData: { timetable: OutlinedTimetable }) => {
    timetableData.timetable.operations = createOperations(timetableData.timetable.inboundTrains, timetableData.timetable.outboundTrains);
    setAppStates((appStates) => ({
      ...appStates,
      timetableData: timetableData,
    }));
  };

  const setDiaStations = (stations: Station[]) => {
    const timetableData: TimetableData = {
      ...appStates.timetableData,
      timetable: {
        ...appStates.timetableData.timetable,
        stations: stations,
      },
    };
    timetableData.timetable.operations = createOperations(timetableData.timetable.inboundTrains, timetableData.timetable.outboundTrains);
    setAppStates((appStates) => ({
      ...appStates,
      timetableData: timetableData,
    }));
  };

  const setTrainTypes = (trainTypes: TrainType[]) => {
    const timetableData: TimetableData = {
      ...appStates.timetableData,
      timetable: {
        ...appStates.timetableData.timetable,
        trainTypes: trainTypes,
      },
    };
    timetableData.timetable.operations = createOperations(timetableData.timetable.inboundTrains, timetableData.timetable.outboundTrains);
    setAppStates((appStates) => ({
      ...appStates,
      timetableData: timetableData,
    }));
  };

  const setTrains = (trains: Train[]) => {
    const timetableData: TimetableData =
      timetableDirection === 'Inbound'
        ? {
            ...appStates.timetableData,
            timetable: {
              ...appStates.timetableData.timetable,
              inboundTrains: trains,
            },
          }
        : {
            ...appStates.timetableData,
            timetable: {
              ...appStates.timetableData.timetable,
              outboundTrains: trains,
            },
          };

          timetableData.timetable.operations = createOperations(timetableData.timetable.inboundTrains, timetableData.timetable.outboundTrains);
    setAppStates((appStates) => ({
      ...appStates,
      timetableData: timetableData,
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div>
        <button
          onClick={() => {
            saveTimetableDataFile(appStates);
          }}
        >
          保存
        </button>
        <div
          style={{
            display: 'inline-block',
            borderStyle: 'solid',
            borderWidth: '1px',
            padding: '2px',
          }}
        >
          読み込み
          <input
            type='file'
            id='file-selector'
            accept='.oud, .oud2, .json'
            onChange={async (event) => {
              const diagram = await loadFile(event);
              if (diagram != null) {
                setTimetableData({
                  timetable: diagram,
                });
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            const timetableAndOperations = toDetailedTimetable(
              timetableData.timetable.stations,
              timetableData.timetable,
              appStates.tracks
            );

            if (timetableAndOperations === null) {
              return;
            }

            const [timetable, _] = timetableAndOperations;

            // console.log('timetable');
            // console.log(timetable);

            // const trains = removeNull(timetable.platformTTItems
            //   .map((platformTTItem) => platformTTItem.train)
            //   .concat(timetable.switchTTItems.map((switchTTItem) => switchTTItem.train)))
            //   .filter((train, i, self) => self.findIndex((t) => t.trainId === train.trainId) === i);

            const trainMove = createTrainMove(timetable);
            setAppStates((appStates) => ({
              ...appStates,
              trainMove: trainMove,
              agentManager: createAgentManager(),
              detailedTimetable: timetable,
              // placedTrains: trains, // これは使っているのか？
            }));
          }}
        >
          ⇑詳細ダイヤに反映
        </button>
        <button
          onClick={() => {
            const timetable = toOutlinedTimetableStations(appStates.tracks);
            if (timetable == null) {
              return;
            }

            console.log(timetable);
            setTimetableData({
              timetable: timetable,
            });
          }}
        >
          ⇓概要ダイヤに反映
        </button>
        <button
          onClick={() => {
            const newTimetable = reverseTimetableDirection(appStates.timetableData.timetable);
            setTimetableData({ timetable: newTimetable });
          }}
        >
          上り下りを反転
        </button>
        <button
          onClick={() => {
            if (!confirm('全てクリアしますか？')) {
              return;
            }

            setTimetableData(getInitialTimetable());
          }}
        >
          全てクリア
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
                      diaStations: timetableData.timetable.stations,
                      setDiaStations: setDiaStations,
                      trains: timetableData.timetable.inboundTrains,
                      otherDirectionTrains: timetableData.timetable.outboundTrains,
                      setTrains: setTrains,
                      timetableDirection,
                      trainTypes: appStates.timetableData.timetable.trainTypes,
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
                      diaStations: reverseArray(timetableData.timetable.stations),
                      setDiaStations: (diaStations) => setDiaStations(reverseArray(diaStations)),
                      trains: timetableData.timetable.outboundTrains,
                      otherDirectionTrains: timetableData.timetable.inboundTrains,
                      setTrains: setTrains,
                      timetableDirection,
                      trainTypes: appStates.timetableData.timetable.trainTypes,
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
                  <TrainTypeSettingComponent
                    trainTypes={appStates.timetableData.timetable.trainTypes}
                    setTrainTypes={setTrainTypes}
                  />
                ),
              },
              {
                tabId: 4,
                tabText: '駅時刻表',
                component: () => (
                  <StationTimetablePageComponent
                    diaStations={timetableData.timetable.stations}
                    inboundTrains={timetableData.timetable.inboundTrains}
                    outboundTrains={timetableData.timetable.outboundTrains}
                  />
                ),
              },
              {
                tabId: 5,
                tabText: 'ダイヤグラム',
                component: () => (
                  <DiagramPageComponent
                    diaStations={timetableData.timetable.stations}
                    inboundTrains={timetableData.timetable.inboundTrains}
                    outboundTrains={timetableData.timetable.outboundTrains}
                    operations={timetableData.timetable.operations}
                    setUpdate={() => {
                      setTimetableData({ ...timetableData });
                    }}
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
                    inboundTrains={timetableData.timetable.inboundTrains}
                    outboundTrains={timetableData.timetable.outboundTrains}
                    operations={timetableData.timetable.operations}
                    setUpdate={() => {
                      setTimetableData({ ...timetableData });
                    }}
                  />
                )
              }
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
                    timetableData.timetable.stations.map((diaStation_) =>
                      diaStation_.stationId === diaStation.stationId ? diaStation : diaStation_
                    )
                  );
                }}
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
