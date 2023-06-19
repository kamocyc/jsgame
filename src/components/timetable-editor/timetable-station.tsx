import { useState } from 'preact/hooks';
import { generateId } from '../../model';
import { ContextMenuComponent, EditableTextComponent } from './common-components';
import './timetable-editor.css';
import { ContextData, DiaStation, DiaTrain, SettingData } from './timetable-model';
import { createNewStation, getDefaultPlatform } from './timetable-util';

function StationComponent({
  diaStation,
  setDiaStation,
}: {
  diaStation: DiaStation;
  setDiaStation: (diaStation: DiaStation) => void;
}) {
  return (
    <EditableTextComponent
      value={diaStation.diaStationName}
      onChange={(value) => {
        diaStation.diaStationName = value;
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
  selectedStation,
  showStationDetail,
  timetableDirection,
}: {
  contextData: ContextData;
  setContextData: (contextData: ContextData) => void;
  diaStations: DiaStation[];
  setDiaStations: (diaStations: DiaStation[]) => void;
  diaTrains: DiaTrain[];
  selectedStation: DiaStation | null;
  showStationDetail: (diaStation: DiaStation) => void;
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
              diaStations = diaStations.filter(
                (diaStation) => diaStation.diaStationId !== selectedStation.diaStationId
              );
              diaTrains.forEach((diaTrain) => {
                diaTrain.diaTimes = diaTrain.diaTimes.filter(
                  (diaTime) => diaTime.diaStation.diaStationId !== selectedStation.diaStationId
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
            const index = diaStations.findIndex(
              (diaStation) => diaStation.diaStationId === selectedStation?.diaStationId
            );
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
  timetableDirection,
  setSettingData,
}: {
  diaStations: DiaStation[];
  setDiaStations: (diaStations: DiaStation[]) => void;
  diaTrains: DiaTrain[];
  timetableDirection: 'Inbound' | 'Outbound';
  setSettingData: (settingData: SettingData) => void;
}) {
  const [contextData, setContextData] = useState<ContextData>({
    visible: false,
    posX: 0,
    posY: 0,
  });
  const [selectedStation, setSelectedStation] = useState<DiaStation | null>(null);

  const showStationDetail = (diaStation: DiaStation) => {
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
              const id = 'dia-station-block-' + diaStation.diaStationId;
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
            id={'dia-station-block-' + diaStation.diaStationId}
          >
            <StationComponent
              diaStation={diaStation}
              setDiaStation={(diaStation) => {
                diaStation.diaStationName = diaStation.diaStationName;
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

            setDiaStations([...diaStations]);
          }}
        >
          駅を追加
        </button>
      </div>
    </div>
  );
}

// TODO: 駅の詳細編集ダイアログを実装
export function StationDetailComponent({
  diaStation,
  setDiaStation,
}: {
  diaStation: DiaStation;
  setDiaStation: (diaStation: DiaStation) => void;
}) {
  return (
    <div>
      <div>
        駅名:{' '}
        <EditableTextComponent
          value={diaStation.diaStationName}
          onChange={(value) => {
            diaStation.diaStationName = value;
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
            {diaStation.diaPlatforms.map((diaPlatform) => (
              <div style={{ display: 'flex', flexDirection: 'row' }}>
                <EditableTextComponent
                  value={diaPlatform.diaPlatformName}
                  onChange={(value) => {
                    diaPlatform.diaPlatformName = value;
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
                  value={diaPlatform.diaPlatformId}
                  onChange={(e) => {
                    if ((e.target as HTMLInputElement)?.value) {
                      const targetPlatformId = (e.target as HTMLInputElement).value;
                      diaStation.defaultInboundDiaPlatformId = Number(targetPlatformId);
                      setDiaStation({ ...diaStation });
                    }
                  }}
                />
                <input
                  type='radio'
                  name='default-outbound-platform'
                  style={{ width: 50 + 'px', margin: '0' }}
                  value={diaPlatform.diaPlatformId}
                  onChange={(e) => {
                    if ((e.target as HTMLInputElement)?.value) {
                      const targetPlatformId = (e.target as HTMLInputElement).value;
                      diaStation.defaultOutboundDiaPlatformId = Number(targetPlatformId);
                      setDiaStation({ ...diaStation });
                    }
                  }}
                />
                <button
                  onClick={() => {
                    diaStation.diaPlatforms = diaStation.diaPlatforms.filter(
                      (diaPlatform_) => diaPlatform_.diaPlatformId !== diaPlatform.diaPlatformId
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
                diaStation.diaPlatforms.push({
                  diaPlatformId: generateId(),
                  diaPlatformName:
                    diaStation.diaPlatforms.length === 0
                      ? '1'
                      : Math.max(
                          ...diaStation.diaPlatforms.map((p) => {
                            const n = Number(p.diaPlatformName);
                            if (isNaN(n)) {
                              return 0;
                            } else {
                              return n;
                            }
                          })
                        ) +
                        1 +
                        '',
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
