import { StateUpdater, useEffect, useState } from 'preact/hooks';
import { JSON_decycle, JSON_retrocycle } from '../../cycle';
import { Station } from '../../model';
import { toDetailedTimetable, toOutlinedTimetableStations } from '../track-editor/timetableConverter';
import { TrainMove2 } from '../track-editor/trainMove2';
import { AppStates } from '../track-editor/uiEditorModel';
import { SettingColumnComponent, TabComponent, reverseArray } from './common-component';
import { DiagramPageComponent } from './diagram-component';
import { DiaTrain, SettingData, TimetableData, TimetableDirection, TrainType } from './model';
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
        <div style={{ height: 24 * 3 + 'px', borderStyle: 'solid', borderWidth: '1px' }}>
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
  diaTrains,
  otherDirectionDiaTrains,
  setDiaTrains,
  timetableDirection,
  trainTypes,
  setSettingData,
}: {
  diaStations: Station[];
  setDiaStations: (diaStations: Station[]) => void;
  diaTrains: DiaTrain[];
  otherDirectionDiaTrains: DiaTrain[];
  setDiaTrains: (diaTrains: DiaTrain[]) => void;
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
          {...{ diaStations, diaTrains, otherDirectionDiaTrains, setDiaStations, timetableDirection, setSettingData }}
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
          diaTrains: diaTrains,
          setDiaTrains: (diaTrains) => {
            setDiaTrains([...diaTrains]);
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

  const setDiaTrains = (diaTrains: DiaTrain[]) => {
    const timetableData_ =
      timetableDirection === 'Inbound'
        ? {
            ...timetableData,
            timetable: {
              ...timetableData.timetable,
              inboundDiaTrains: diaTrains,
            },
          }
        : {
            ...timetableData,
            timetable: {
              ...timetableData.timetable,
              outboundDiaTrains: diaTrains,
            },
          };
    setTimetableData(timetableData_);
    saveTimetable(timetableData_);
  };

  return (
    <div style={{ display: 'flex' }}>
      <button
        onClick={() => {
          const timetable = toDetailedTimetable(
            timetableData.timetable.stations,
            timetableData.timetable,
            appStates.tracks
          );

          console.log('timetable');
          console.log(timetable);

          setAppStates((appStates) => ({
            ...appStates,
            trainMove: new TrainMove2(timetable),
            timetable: timetable,
          }));
        }}
      >
        詳細ダイヤに反映
      </button>
      <button
        onClick={() => {
          const timetable = toOutlinedTimetableStations(appStates.tracks);
          console.log(timetable);
          setTimetableData((timetableData) => ({
            ...timetableData,
            timetable: timetable,
          }));
        }}
      >
        概要ダイヤに反映
      </button>
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
                    diaTrains: timetableData.timetable.inboundDiaTrains,
                    otherDirectionDiaTrains: timetableData.timetable.outboundDiaTrains,
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
                    diaTrains: timetableData.timetable.outboundDiaTrains,
                    otherDirectionDiaTrains: timetableData.timetable.inboundDiaTrains,
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
                  inboundDiaTrains={timetableData.timetable.inboundDiaTrains}
                  outboundDiaTrains={timetableData.timetable.outboundDiaTrains}
                />
              ),
            },
            {
              tabId: 5,
              tabText: 'ダイヤグラム',
              component: () => (
                <DiagramPageComponent
                  diaStations={timetableData.timetable.stations}
                  inboundDiaTrains={timetableData.timetable.inboundDiaTrains}
                  outboundDiaTrains={timetableData.timetable.outboundDiaTrains}
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
              diaStation={settingData.diaStation}
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
  );
}
