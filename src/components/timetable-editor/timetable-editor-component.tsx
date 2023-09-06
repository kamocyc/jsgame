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
import { createOperations, toDetailedTimetable, toOutlinedTimetableStations } from '../track-editor/timetableConverter';
import { TrainMove2 } from '../track-editor/trainMove2';
import { SettingColumnComponent, TabComponent, reverseArray } from './common-component';
import { DiagramPageComponent } from './diagram-component';
import { StationDetailComponent, StationListComponent } from './station-component';
import { StationTimetablePageComponent } from './timetable-component';
import './timetable-editor.css';
import { getInitialTimetable, reverseTimetableDirection } from './timetable-util';
import { TrainListComponent } from './train-component';
import { TrainTypeSettingComponent } from './traintype-component';

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
  otherDirectionDiaTrains,
  setDiaTrains,
  timetableDirection,
  trainTypes,
  setSettingData,
  clipboard,
  setClipboard,
}: {
  diaStations: Station[];
  setDiaStations: (diaStations: Station[]) => void;
  trains: Train[];
  otherDirectionDiaTrains: Train[];
  setDiaTrains: (trains: Train[]) => void;
  timetableDirection: 'Inbound' | 'Outbound';
  trainTypes: TrainType[];
  setSettingData: (settingData: SettingData) => void;
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
}) {
  return (
    <div style={{ display: 'flex' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div>列車番号</div>
        <div>列車種別</div>
        <StationListComponent
          {...{ diaStations, trains, otherDirectionDiaTrains, setDiaStations, timetableDirection, setSettingData }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '24px' }}></div>
        <div style={{ height: '24px' }}></div>
        <TrainListRowHeaderComponent diaStations={diaStations} />
      </div>
      <TrainListComponent
        {...{
          diaStations: diaStations,
          trains: trains,
          setDiaTrains: (trains) => {
            setDiaTrains([...trains]);
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
    setAppStates((appStates) => ({
      ...appStates,
      timetableData: timetableData,
    }));
  };

  const setDiaTrains = (trains: Train[]) => {
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
            createOperations(timetableData.timetable);

            const timetable = toDetailedTimetable(
              timetableData.timetable.stations,
              timetableData.timetable,
              appStates.tracks
            );

            if (timetable === null) {
              return;
            }

            // console.log('timetable');
            // console.log(timetable);

            const trains = timetable.platformTTItems
              .map((platformTTItem) => platformTTItem.train)
              .concat(timetable.switchTTItems.map((switchTTItem) => switchTTItem.train))
              .filter((train, i, self) => self.findIndex((t) => t.trainId === train.trainId) === i);

            setAppStates((appStates) => ({
              ...appStates,
              trainMove: new TrainMove2(timetable),
              detailedTimetable: timetable,
              trains: trains,
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
                      otherDirectionDiaTrains: timetableData.timetable.outboundTrains,
                      setDiaTrains: setDiaTrains,
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
                      otherDirectionDiaTrains: timetableData.timetable.inboundTrains,
                      setDiaTrains: setDiaTrains,
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
                    inboundDiaTrains={timetableData.timetable.inboundTrains}
                    outboundDiaTrains={timetableData.timetable.outboundTrains}
                  />
                ),
              },
              {
                tabId: 5,
                tabText: 'ダイヤグラム',
                component: () => (
                  <DiagramPageComponent
                    diaStations={timetableData.timetable.stations}
                    inboundDiaTrains={timetableData.timetable.inboundTrains}
                    outboundDiaTrains={timetableData.timetable.outboundTrains}
                    setUpdate={() => {
                      setTimetableData({ ...timetableData });
                    }}
                    clipboard={clipboard}
                    setClipboard={setClipboard}
                  />
                ),
              },
            ]}
          />
        </div>
        {settingData == null ? (
          <></>
        ) : (
          <SettingColumnComponent setSettingData={setSettingData}>
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
