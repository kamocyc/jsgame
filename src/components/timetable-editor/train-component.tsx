import { useState } from 'preact/hooks';
import {
  AppClipboard,
  ContextData,
  DiaTime,
  Platform,
  Station,
  StationOperation,
  TimetableDirection,
  Train,
  TrainType,
  cloneTrain,
  generateId,
} from '../../model';
import { ContextMenuComponent, EditableTextComponent, TimeInputComponent } from './common-component';
import { getDefaultPlatform } from './timetable-util';

function TrainContextMenuComponent({
  trains,
  setDiaTrains,
  contextData,
  setContextData,
  clipboard,
  setClipboard,
  selectedDiaTrain,
}: {
  trains: Train[];
  setDiaTrains: (trains: Train[]) => void;
  contextData: ContextData;

  setContextData: (contextData: ContextData) => void;
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
  selectedDiaTrain: Train | null;
}) {
  return (
    <ContextMenuComponent
      contextData={contextData}
      setContextData={setContextData}
      menuItems={[
        {
          label: '列車を削除',
          onClick: () => {
            const index = trains.findIndex((train) => train.trainId === selectedDiaTrain?.trainId);
            if (index >= 0) {
              trains.splice(index, 1);
              setDiaTrains([...trains]);
              setContextData({ ...contextData, visible: false });
            }
          },
        },
        {
          label: '列車をコピー',
          onClick: () => {
            const index = trains.findIndex((train) => train.trainId === selectedDiaTrain?.trainId);
            if (selectedDiaTrain != null && index >= 0) {
              const newDiaTrain: Train = cloneTrain(selectedDiaTrain);
              newDiaTrain.trainId = generateId();
              setClipboard({ trains: [newDiaTrain], originalTrains: [selectedDiaTrain] });
            }
            setContextData({ ...contextData, visible: false });
          },
        },
        {
          label: '列車を貼り付け',
          onClick: () => {
            if (clipboard.trains.length > 0) {
              const newDiaTrains = clipboard.trains;

              // 現在のdiaTrainの直前に挿入
              const index = trains.findIndex((train) => train.trainId === selectedDiaTrain?.trainId);
              if (index >= 0) {
                trains.splice(index, 0, ...newDiaTrains);
              } else {
                trains.push(...newDiaTrains);
              }
              setDiaTrains([...trains]);
              setContextData({ ...contextData, visible: false });
            }
          },
        },
      ]}
    />
  );
}

export function PlatformComponent({
  diaPlatform,
  allDiaPlatforms,
  setDiaPlatform,
}: {
  diaPlatform: Platform | null;
  allDiaPlatforms: Platform[];
  setDiaPlatform: (diaPlatform: Platform | null) => void;
}) {
  return (
    <select
      value={diaPlatform?.platformId ?? -1}
      style={{ height: 22 + 'px' }}
      onChange={(e) => {
        const value = (e.target as HTMLSelectElement)?.value;
        if (value != null) {
          if (value === '-1') {
            setDiaPlatform(null);
            return;
          }
          const newDiaPlatform = allDiaPlatforms.find((diaPlatform) => diaPlatform.platformId === value);
          if (newDiaPlatform) {
            setDiaPlatform(newDiaPlatform);
          }
        }
      }}
    >
      <option value={-1}>-</option>
      {allDiaPlatforms.map((diaPlatform) => (
        <option value={diaPlatform.platformId}>{diaPlatform.platformName}</option>
      ))}
    </select>
  );
}

function TrainListItemComponent({
  diaTime,
  trains,
  setDiaTrains,
}: {
  diaTime: DiaTime;
  trains: Train[];
  setDiaTrains: (trains: Train[]) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        height: 24 * 3 + 'px',
        borderStyle: 'solid',
        borderWidth: '1px',
        width: '54px',
      }}
    >
      <div
        style={{
          fontSize: '12px',
          width: '10px',
          color: diaTime.isPassing ? 'black' : 'lightgray',
          backgroundColor: diaTime.isPassing ? 'lightgreen' : 'white',
        }}
        onClick={() => {
          diaTime.isPassing = !diaTime.isPassing;
          setDiaTrains([...trains]);
        }}
      >
        レ
      </div>
      <div style={{ width: 24 * 3 + 'px', display: 'flex', flexDirection: 'column' }}>
        <TimeInputComponent
          time={diaTime.arrivalTime}
          setTime={(time) => {
            diaTime.arrivalTime = time;
            setDiaTrains([...trains]);
          }}
        />
        <PlatformComponent
          diaPlatform={diaTime.platform}
          allDiaPlatforms={diaTime.station.platforms}
          setDiaPlatform={(diaPlatform) => {
            diaTime.platform = diaPlatform;
            setDiaTrains([...trains]);
          }}
        />
        <TimeInputComponent
          time={diaTime.departureTime}
          setTime={(time) => {
            diaTime.departureTime = time;
            setDiaTrains([...trains]);
          }}
        />
      </div>
    </div>
  );
}

export function TrainOperationTypeComponent({
  stationOperation,
  setStationOperation,
}: {
  stationOperation: StationOperation | undefined;
  setStationOperation: (stationOperation: StationOperation | undefined) => void;
}) {
  return (
    <>
      <select
        onChange={(e) => {
          const value = (e.target as HTMLSelectElement)?.value;
          switch (value) {
            case '':
              setStationOperation(undefined);
              break;
            case 'InOut':
              setStationOperation({
                operationType: 'InOut',
                operationCode: generateId(),
                operationTime: 0,
              });
              break;
            case 'Connection':
              setStationOperation({
                operationType: 'Connection',
              });
              break;
            default:
              break;
          }
        }}
        value={stationOperation?.operationType ?? ''}
        style={{ height: 22 + 'px', width: '56px' }}
      >
        <option value=''></option>
        <option value='InOut'>入出区</option>
        <option value='Connection'>前/次列車接続</option>
      </select>
    </>
  );
}

export function TrainListComponent({
  trains,
  diaStations,
  timetableDirection,
  setDiaTrains,
  trainTypes,
  clipboard,
  setClipboard,
}: {
  trains: Train[];
  diaStations: Station[];
  timetableDirection: TimetableDirection;
  setDiaTrains: (trains: Train[]) => void;
  trainTypes: TrainType[];
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
}) {
  const [contextData, setContextData] = useState<ContextData>({
    visible: false,
    posX: 0,
    posY: 0,
  });
  const [selectedDiaTrain, setSelectedDiaTrain] = useState<Train | null>(null);

  function getDiaTimesOfStations(train: Train, diaStations: Station[]): DiaTime[] {
    return diaStations.map((diaStation) => {
      const diaTime = train.diaTimes.find((diaTime) => diaTime.station.stationId === diaStation.stationId);
      if (diaTime) {
        return diaTime;
      } else {
        throw new Error('diaTime not found');
      }
    });
  }

  return (
    <div
      style={{ display: 'flex' }}
      onContextMenu={(e) => {
        const targetDiaTrain = (() => {
          for (const train of trains) {
            const id = 'dia-train-block-' + train.trainId;
            const elem = document.getElementById(id);
            if (elem && elem.contains(e.target as Node)) {
              return train;
            }
          }
          return null;
        })();

        if (targetDiaTrain) {
          e.preventDefault();
          setContextData({ visible: true, posX: e.clientX, posY: e.clientY });
          setSelectedDiaTrain(targetDiaTrain);
        }
      }}
    >
      <TrainContextMenuComponent
        {...{ contextData, trains, setDiaTrains, setContextData, clipboard, setClipboard, selectedDiaTrain }}
      />
      {trains.map((train) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '24px', width: '56px' }}>
            {/* 列車番号 */}
            <EditableTextComponent
              value={train.trainName ?? ''}
              onChange={(value) => {
                if (value == '') {
                  train.trainName = '';
                } else {
                  train.trainName = value;
                }
                setDiaTrains([...trains]);
                return true;
              }}
              height={24}
              width={null}
            />
          </div>
          <div style={{ height: '24px' }}>
            {/* 列車種別 */}
            <select
              value={train.trainType?.trainTypeId}
              style={{ height: 22 + 'px', width: '56px' }}
              onChange={(e) => {
                if ((e.target as HTMLSelectElement)?.value != null) {
                  const newTrainType = trainTypes.find(
                    (trainType) => trainType.trainTypeId === (e.target as HTMLSelectElement).value
                  );
                  if (newTrainType) {
                    train.trainType = newTrainType;
                  } else {
                    train.trainType = undefined;
                  }
                  setDiaTrains([...trains]);
                }
              }}
            >
              <option value=''></option>
              {trainTypes.map((trainType) => (
                <option value={trainType.trainTypeId}>{trainType.trainTypeName}</option>
              ))}
            </select>
          </div>

          <div style={{ height: '24px' }}>
            {/* 始発駅作業 */}
            <TrainOperationTypeComponent
              stationOperation={train.firstStationOperation}
              setStationOperation={(stationOperation) => {
                train.firstStationOperation = stationOperation;
                setDiaTrains([...trains]);
              }}
            />
          </div>
          <div style={{ height: '24px' }}>
            {/* 終着駅作業 */}
            <TrainOperationTypeComponent
              stationOperation={train.lastStationOperation}
              setStationOperation={(stationOperation) => {
                train.lastStationOperation = stationOperation;
                setDiaTrains([...trains]);
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }} id={'dia-train-block-' + train.trainId}>
            {/* 時刻リスト */}
            {getDiaTimesOfStations(train, diaStations).map((diaTime) => (
              <TrainListItemComponent {...{ diaTime, trains, setDiaTrains }} />
            ))}
          </div>
        </div>
      ))}
      <div>
        <button
          onClick={() => {
            trains.push({
              trainId: generateId(),
              trainName: '',
              diaTimes: diaStations.map((diaStation) => ({
                diaTimeId: generateId(),
                arrivalTime: null,
                departureTime: null,
                isPassing: false,
                station: diaStation,
                platform: getDefaultPlatform(diaStation, timetableDirection),
              })),
              trainCode: '',
              direction: timetableDirection,
            });
            setDiaTrains([...trains]);
          }}
        >
          列車を追加
        </button>
      </div>
    </div>
  );
}
