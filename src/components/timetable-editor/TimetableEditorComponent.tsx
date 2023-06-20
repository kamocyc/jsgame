import { useEffect, useState } from 'preact/hooks';
import { SettingColumnComponent, reverseArray } from './common-components';
import { DiagramPageComponent } from './timetable-diagram-component';
import './timetable-editor.css';
import { DiaStation, DiaTrain, SettingData, TimetableData, TimetableDirection, TrainType } from './timetable-model';
import { StationDetailComponent, StationListComponent } from './timetable-station';
import { StationTimetablePageComponent } from './timetable-timetable';
import { TrainListComponent } from './timetable-train';
import { TrainTypeSettingComponent } from './timetable-traintype';
import { getInitialTimetable } from './timetable-util';

export function TrainListRowHeaderComponent({ diaStations }: { diaStations: DiaStation[] }) {
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
  localStorage.setItem('timetableEditorData', JSON.stringify(timetable));
}

function loadTimetableData(): TimetableData {
  const timetableString = localStorage.getItem('timetableEditorData');
  return timetableString ? JSON.parse(timetableString) : getInitialTimetable();
}

export function TimetableEditorTableComponent({
  diaStations,
  setDiaStations,
  diaTrains,
  setDiaTrains,
  timetableDirection,
  trainTypes,
  setSettingData,
}: {
  diaStations: DiaStation[];
  setDiaStations: (diaStations: DiaStation[]) => void;
  diaTrains: DiaTrain[];
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
        <StationListComponent {...{ diaStations, diaTrains, setDiaStations, timetableDirection, setSettingData }} />
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

interface Tab {
  tabId: number;
  tabText: string;
  component: () => any /* JSX.Element */;
}

export function TabComponent({ tabs, onTabChange }: { tabs: Tab[]; onTabChange: (tabId: number) => void }) {
  const [selectedTabId, setSelectedTabId] = useState<number>(tabs[0].tabId);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {tabs.map((tab) => (
          <div
            style={{
              borderStyle: 'solid',
              borderWidth: '1px',
              backgroundColor: tab.tabId === selectedTabId ? 'white' : 'lightgray',
              borderBottom: 'none',
              height: '28px',
            }}
            onClick={() => {
              setSelectedTabId(tab.tabId);
              onTabChange(tab.tabId);
            }}
          >
            <div
              style={
                tab.tabId === selectedTabId
                  ? { padding: '4px', height: '22px', backgroundColor: '#fff', zIndex: '1', position: 'relative' }
                  : { padding: '4px' }
              }
            >
              {tab.tabText}
            </div>
          </div>
        ))}
      </div>
      <div style={{ border: '2px', borderStyle: 'solid', borderColor: '#ccc', padding: '5px' }}>
        {tabs.find((tab) => tab.tabId === selectedTabId)?.component()}
      </div>
    </div>
  );
}

export function TimetableEditorComponent() {
  const [timetableData, setTimetableData] = useState<TimetableData>(getInitialTimetable());
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([
    {
      trainTypeId: 1,
      trainTypeName: '普通',
      trainTypeColor: '#000000',
    },
    {
      trainTypeId: 2,
      trainTypeName: '急行',
      trainTypeColor: '#ff0000',
    },
  ]);

  useEffect(() => {
    setTimetableData(loadTimetableData());
  }, []);
  const [settingData, setSettingData] = useState<SettingData | null>(null);

  const setDiaStations = (diaStations: DiaStation[]) => {
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
                    diaStations: timetableData.timetable.diaStations,
                    setDiaStations: setDiaStations,
                    diaTrains: timetableData.timetable.inboundDiaTrains,
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
                    diaStations: reverseArray(timetableData.timetable.diaStations),
                    setDiaStations: (diaStations) => setDiaStations(reverseArray(diaStations)),
                    diaTrains: timetableData.timetable.outboundDiaTrains,
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
                  diaStations={timetableData.timetable.diaStations}
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
                  diaStations={timetableData.timetable.diaStations}
                  inboundDiaTrains={timetableData.timetable.inboundDiaTrains}
                  outboundDiaTrains={timetableData.timetable.outboundDiaTrains}
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
                  timetableData.timetable.diaStations.map((diaStation_) =>
                    diaStation_.diaStationId === diaStation.diaStationId ? diaStation : diaStation_
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
