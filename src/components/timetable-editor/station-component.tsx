import { useState } from 'preact/hooks';
import { generateId, Station } from '../../model';
import { ContextMenuComponent, EditableTextComponent } from './common-component';
import { ContextData, DiaTrain, SettingData } from './model';
import './timetable-editor.css';
import { createNewStation, getDefaultPlatform } from './timetable-util';

function StationComponent({
  diaStation,
  setDiaStation,
}: {
  diaStation: Station;
  setDiaStation: (diaStation: Station) => void;
}) {
  return (
    <EditableTextComponent
      value={diaStation.stationName}
      onChange={(value) => {
        diaStation.stationName = value;
        setDiaStation({ ...diaStation });
        return true;
      }}
      height={24 * 3}
      width={100}
    />
  );
}

function StationContextMenuComponent({
  contextData,
  setContextData,
  diaStations,
  setDiaStations,
  diaTrains,
  otherDirectionDiaTrains,
  selectedStation,
  showStationDetail,
  timetableDirection,
}: {
  contextData: ContextData;
  setContextData: (contextData: ContextData) => void;
  diaStations: Station[];
  setDiaStations: (diaStations: Station[]) => void;
  diaTrains: DiaTrain[];
  otherDirectionDiaTrains: DiaTrain[];
  selectedStation: Station | null;
  showStationDetail: (diaStation: Station) => void;
  timetableDirection: 'Inbound' | 'Outbound';
}) {
  return (
    <ContextMenuComponent
      contextData={contextData}
      setContextData={setContextData}
      menuItems={[
        {
          label: '駅を削除',
          onClick: () => {
            if (selectedStation) {
              diaStations = diaStations.filter((diaStation) => diaStation.stationId !== selectedStation.stationId);
              diaTrains.forEach((diaTrain) => {
                diaTrain.diaTimes = diaTrain.diaTimes.filter(
                  (diaTime) => diaTime.diaStation.stationId !== selectedStation.stationId
                );
              });
              otherDirectionDiaTrains.forEach((diaTrain) => {
                diaTrain.diaTimes = diaTrain.diaTimes.filter(
                  (diaTime) => diaTime.diaStation.stationId !== selectedStation.stationId
                );
              });

              setDiaStations([...diaStations]);
              setContextData({ ...contextData, visible: false });
            }
          },
        },
        {
          label: 'オプション',
          onClick: () => {
            showStationDetail(selectedStation!);
            setContextData({ ...contextData, visible: false });
          },
        },
        {
          label: '駅を追加',
          onClick: () => {
            const newStation = createNewStation('-');
            // selectedStationの直前に挿入する
            const index = diaStations.findIndex((diaStation) => diaStation.stationId === selectedStation?.stationId);
            if (index === -1) {
              return;
            }
            diaStations.splice(index, 0, newStation);

            diaTrains.forEach((diaTrain) => {
              diaTrain.diaTimes.push({
                diaTimeId: generateId(),
                arrivalTime: null,
                departureTime: null,
                isPassing: false,
                diaStation: newStation,
                diaPlatform: getDefaultPlatform(newStation, timetableDirection),
              });
            });
            otherDirectionDiaTrains.forEach((diaTrain) => {
              diaTrain.diaTimes.push({
                diaTimeId: generateId(),
                arrivalTime: null,
                departureTime: null,
                isPassing: false,
                diaStation: newStation,
                diaPlatform: getDefaultPlatform(newStation, timetableDirection),
              });
            });

            setDiaStations([...diaStations]);
            setContextData({ ...contextData, visible: false });
          },
        },
      ]}
    />
  );
}

export function StationListComponent({
  diaStations,
  setDiaStations,
  diaTrains,
  otherDirectionDiaTrains,
  timetableDirection,
  setSettingData,
}: {
  diaStations: Station[];
  setDiaStations: (diaStations: Station[]) => void;
  diaTrains: DiaTrain[];
  otherDirectionDiaTrains: DiaTrain[];
  timetableDirection: 'Inbound' | 'Outbound';
  setSettingData: (settingData: SettingData) => void;
}) {
  const [contextData, setContextData] = useState<ContextData>({
    visible: false,
    posX: 0,
    posY: 0,
  });
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const showStationDetail = (diaStation: Station) => {
    setSettingData({
      settingType: 'StationSetting',
      diaStation,
    });
  };

  return (
    <div>
      <StationContextMenuComponent
        {...{
          contextData,
          setContextData,
          diaStations,
          diaTrains,
          otherDirectionDiaTrains,
          setDiaStations,
          selectedStation,
          showStationDetail: showStationDetail,
          timetableDirection,
        }}
      />
      <div
        onContextMenu={(e) => {
          const targetStation = (() => {
            for (const diaStation of diaStations) {
              const id = 'dia-station-block-' + diaStation.stationId;
              const elem = document.getElementById(id);
              if (elem && elem.contains(e.target as Node)) {
                return diaStation;
              }
            }
            return null;
          })();

          if (targetStation) {
            e.preventDefault();
            setContextData({ visible: true, posX: e.clientX, posY: e.clientY });
            setSelectedStation(targetStation);
          }
        }}
      >
        {diaStations.map((diaStation) => (
          <div
            style={{ height: 24 * 3 + 'px', borderStyle: 'solid', borderWidth: '1px', paddingRight: '3px' }}
            id={'dia-station-block-' + diaStation.stationId}
          >
            <StationComponent
              diaStation={diaStation}
              setDiaStation={(diaStation) => {
                diaStation.stationName = diaStation.stationName;
                setDiaStations([...diaStations]);
              }}
            />
          </div>
        ))}
      </div>
      <div>
        <button
          onClick={() => {
            const newStation = createNewStation('-');
            diaStations.push(newStation);
            diaTrains.forEach((diaTrain) => {
              diaTrain.diaTimes.push({
                diaTimeId: generateId(),
                arrivalTime: null,
                departureTime: null,
                isPassing: false,
                diaStation: newStation,
                diaPlatform: getDefaultPlatform(newStation, timetableDirection),
              });
            });
            otherDirectionDiaTrains.forEach((diaTrain) => {
              diaTrain.diaTimes.push({
                diaTimeId: generateId(),
                arrivalTime: null,
                departureTime: null,
                isPassing: false,
                diaStation: newStation,
                diaPlatform: getDefaultPlatform(newStation, timetableDirection),
              });
            });

            setDiaStations([...diaStations]);
          }}
        >
          駅を追加
        </button>
      </div>
    </div>
  );
}

export function StationDetailComponent({
  diaStation,
  setDiaStation,
}: {
  diaStation: Station;
  setDiaStation: (diaStation: Station) => void;
}) {
  return (
    <div>
      <div>
        駅名:{' '}
        <EditableTextComponent
          value={diaStation.stationName}
          onChange={(value) => {
            diaStation.stationName = value;
            setDiaStation({ ...diaStation });
            return true;
          }}
          height={24}
          width={100}
        />
      </div>
      <div>
        番線リスト:
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <div style={{ width: 100 + 'px', textAlign: 'center' }}>番線名</div>
            <div style={{ width: 50 + 'px', textAlign: 'center' }}>
              <span style={{ display: 'inline-block' }}>上り</span>
              <span style={{ display: 'inline-block' }}>主本線</span>
            </div>
            <div style={{ width: 50 + 'px', textAlign: 'center' }}>
              <span style={{ display: 'inline-block' }}>下り</span>
              <span style={{ display: 'inline-block' }}>主本線</span>
            </div>
          </div>
          <div>
            {diaStation.platforms.map((diaPlatform) => (
              <div style={{ display: 'flex', flexDirection: 'row' }}>
                <EditableTextComponent
                  value={diaPlatform.platformName}
                  onChange={(value) => {
                    diaPlatform.platformName = value;
                    setDiaStation({ ...diaStation });
                    return true;
                  }}
                  height={24}
                  width={100}
                />
                <input
                  type='radio'
                  name='default-inbound-platform'
                  style={{ width: 50 + 'px', margin: '0' }}
                  value={diaPlatform.platformId}
                  onChange={(e) => {
                    if ((e.target as HTMLInputElement)?.value) {
                      const targetPlatformId = (e.target as HTMLInputElement).value;
                      diaStation.defaultInboundDiaPlatformId = targetPlatformId;
                      setDiaStation({ ...diaStation });
                    }
                  }}
                />
                <input
                  type='radio'
                  name='default-outbound-platform'
                  style={{ width: 50 + 'px', margin: '0' }}
                  value={diaPlatform.platformId}
                  onChange={(e) => {
                    if ((e.target as HTMLInputElement)?.value) {
                      const targetPlatformId = (e.target as HTMLInputElement).value;
                      diaStation.defaultOutboundDiaPlatformId = targetPlatformId;
                      setDiaStation({ ...diaStation });
                    }
                  }}
                />
                <button
                  onClick={() => {
                    diaStation.platforms = diaStation.platforms.filter(
                      (diaPlatform_) => diaPlatform_.platformId !== diaPlatform.platformId
                    );
                    setDiaStation({ ...diaStation });
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <div>
            <button
              onClick={() => {
                diaStation.platforms.push({
                  platformId: generateId(),
                  platformName:
                    diaStation.platforms.length === 0
                      ? '1'
                      : Math.max(
                          ...diaStation.platforms.map((p) => {
                            const n = Number(p.platformName);
                            if (isNaN(n)) {
                              return 0;
                            } else {
                              return n;
                            }
                          })
                        ) +
                        1 +
                        '',
                  station: diaStation,
                });
                setDiaStation({ ...diaStation });
              }}
            >
              番線を追加
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
