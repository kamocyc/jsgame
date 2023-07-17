import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { JSON_decycle, JSON_retrocycle } from '../../cycle';
import { loadFile } from '../../file';
import { AppStates } from '../../mapEditorModel';
import { SettingData, Station, TimetableData, TimetableDirection, Train, TrainType } from '../../model';
import { createOperations, toDetailedTimetable, toOutlinedTimetableStations } from '../track-editor/timetableConverter';
import { TrainMove2 } from '../track-editor/trainMove2';
import { SettingColumnComponent, TabComponent, reverseArray } from './common-component';
import { DiagramPageComponent } from './diagram-component';
import { StationDetailComponent, StationListComponent } from './station-component';
import { StationTimetablePageComponent } from './timetable-component';
import './timetable-editor.css';
import { getInitialTimetable } from './timetable-util';
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

function saveTimetable(timetable: TimetableData) {
  localStorage.setItem('timetableEditorData', JSON.stringify(JSON_decycle(timetable)));
}

function loadTimetableData(): TimetableData {
  const timetableString = localStorage.getItem('timetableEditorData');
  return timetableString ? JSON_retrocycle(JSON.parse(timetableString)) : getInitialTimetable();
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
}: {
  diaStations: Station[];
  setDiaStations: (diaStations: Station[]) => void;
  trains: Train[];
  otherDirectionDiaTrains: Train[];
  setDiaTrains: (trains: Train[]) => void;
  timetableDirection: 'Inbound' | 'Outbound';
  trainTypes: TrainType[];
  setSettingData: (settingData: SettingData) => void;
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
        }}
      />
    </div>
  );
}

export function TimetableEditorComponent({
  appStates,
  setAppStates,
}: {
  appStates: AppStates;
  setAppStates: StateUpdater<AppStates>;
}) {
  const [timetableData, setTimetableData] = useState<TimetableData>(getInitialTimetable());
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([
    {
      trainTypeId: '1',
      trainTypeName: '普通',
      trainTypeColor: '#000000',
    },
    {
      trainTypeId: '2',
      trainTypeName: '急行',
      trainTypeColor: '#ff0000',
    },
  ]);

  useEffect(() => {
    setTimetableData(loadTimetableData());
  }, []);
  const [settingData, setSettingData] = useState<SettingData | null>(null);

  const setDiaStations = (diaStations: Station[]) => {
    const timetableData_ = {
      ...timetableData,
      timetable: {
        ...timetableData.timetable,
        diaStations: diaStations,
      },
    };
    setTimetableData(timetableData_);
    saveTimetable(timetableData_);
  };

  const setDiaTrains = (trains: Train[]) => {
    const timetableData_ =
      timetableDirection === 'Inbound'
        ? {
            ...timetableData,
            timetable: {
              ...timetableData.timetable,
              inboundDiaTrains: trains,
            },
          }
        : {
            ...timetableData,
            timetable: {
              ...timetableData.timetable,
              outboundDiaTrains: trains,
            },
          };
    setTimetableData(timetableData_);
    saveTimetable(timetableData_);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div>
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
              setTrainTypes(diagram.trainTypes);
            }
          }}
        />
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
              timetable: timetable,
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
            setTimetableData((timetableData) => ({
              ...timetableData,
              timetable: timetable,
            }));
          }}
        >
          ⇓概要ダイヤに反映
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
                      trainTypes,
                      setSettingData,
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
                      trainTypes,
                      setSettingData,
                    }}
                  />
                ),
              },
              {
                tabId: 3,
                tabText: '種別の設定',
                component: () => <TrainTypeSettingComponent trainTypes={trainTypes} setTrainTypes={setTrainTypes} />,
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
