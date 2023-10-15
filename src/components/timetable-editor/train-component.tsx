import { useState } from 'preact/hooks';
import {
  AppClipboard,
  ContextData,
  DiaTime,
  PlatformLike,
  SettingData,
  StationLike,
  StationOperation,
  TimetableDirection,
  Train,
  TrainType,
  cloneTrain,
  generateId,
  getDefaultConnectionType,
} from '../../model';
import { ContextMenuComponent, EditableTextComponent, TimeInputComponent } from './common-component';
import { getDefaultPlatform } from './timetable-util';

function TrainContextMenuComponent({
  trains,
  setTrains,
  contextData,
  setContextData,
  clipboard,
  setClipboard,
  selectedTrain,
}: {
  trains: Train[];
  setTrains: (trains: Train[]) => void;
  contextData: ContextData;

  setContextData: (contextData: ContextData) => void;
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
  selectedTrain: Train | null;
}) {
  return (
    <ContextMenuComponent
      contextData={contextData}
      setContextData={setContextData}
      menuItems={[
        {
          label: '列車を削除',
          onClick: () => {
            const index = trains.findIndex((train) => train.trainId === selectedTrain?.trainId);
            if (index >= 0) {
              trains.splice(index, 1);
              setTrains([...trains]);
              setContextData({ ...contextData, visible: false });
            }
          },
        },
        {
          label: '列車をコピー',
          onClick: () => {
            const index = trains.findIndex((train) => train.trainId === selectedTrain?.trainId);
            if (selectedTrain != null && index >= 0) {
              const newTrain: Train = cloneTrain(selectedTrain);
              newTrain.trainId = generateId();
              setClipboard({ trains: [newTrain], originalTrains: [selectedTrain] });
            }
            setContextData({ ...contextData, visible: false });
          },
        },
        {
          label: '列車を貼り付け',
          onClick: () => {
            if (clipboard.trains.length > 0) {
              const newTrains = clipboard.trains;

              // 現在のdiaTrainの直前に挿入
              const index = trains.findIndex((train) => train.trainId === selectedTrain?.trainId);
              if (index >= 0) {
                trains.splice(index, 0, ...newTrains);
              } else {
                trains.push(...newTrains);
              }
              setTrains([...trains]);
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
  diaPlatform: PlatformLike | null;
  allDiaPlatforms: PlatformLike[];
  setDiaPlatform: (diaPlatform: PlatformLike | null) => void;
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
  setTrains,
}: {
  diaTime: DiaTime;
  trains: Train[];
  setTrains: (trains: Train[]) => void;
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
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            width: '10px',
            color: diaTime.isPassing ? 'black' : 'lightgray',
            backgroundColor: diaTime.isPassing ? 'lightgreen' : 'white',
            cursor: 'pointer',
          }}
          onClick={() => {
            diaTime.isPassing = !diaTime.isPassing;
            setTrains([...trains]);
          }}
        >
          レ
        </div>
        <div
          style={{
            fontSize: '14px',
            width: '10px',
            color: !diaTime.isInService ? 'black' : 'lightgray',
            backgroundColor: !diaTime.isInService ? 'lightgreen' : 'white',
            cursor: 'pointer',
          }}
          onClick={() => {
            diaTime.isInService = !diaTime.isInService;
            setTrains([...trains]);
          }}
        >
          回
        </div>
      </div>
      <div style={{ width: 24 * 3 + 'px', display: 'flex', flexDirection: 'column' }}>
        <TimeInputComponent
          time={diaTime.arrivalTime}
          setTime={(time) => {
            diaTime.arrivalTime = time;
            setTrains([...trains]);
          }}
        />
        <PlatformComponent
          diaPlatform={diaTime.platform}
          allDiaPlatforms={diaTime.station.platforms}
          setDiaPlatform={(diaPlatform) => {
            diaTime.platform = diaPlatform;
            setTrains([...trains]);
          }}
        />
        <TimeInputComponent
          time={diaTime.departureTime}
          setTime={(time) => {
            diaTime.departureTime = time;
            setTrains([...trains]);
          }}
        />
      </div>
    </div>
  );
}

function showStationOperation(stationOperation: StationOperation | undefined, firstOrLast: 'First' | 'Last') {
  if (stationOperation === undefined) {
    return '接続'; // 未設定
  } else if (stationOperation.stationOperationType === 'Connection') {
    return '接続';
  } else if (stationOperation.stationOperationType === 'InOut') {
    return firstOrLast === 'First' ? '入区' : '出区';
  } else {
    throw new Error('invalid');
  }
}

// 新しい列車番号を生成する（ロジックは適当）
function getNewTrainCode(trains: Train[]) {
  const codes = trains.map((train) => train.trainCode);
  const symbolInTrainCode = codes[codes.length - 1].replace(/[^A-Z]/g, '');
  const maxCode = codes.map((code) => code.replace(/[^0-9]/g, '')).sort((a, b) => parseInt(b) - parseInt(a))[0];
  const newCode = (parseInt(maxCode) + 2)
    .toString()
    .padStart(codes[codes.length - 1].replace(/[^0-9]/g, '').length, '0');
  return symbolInTrainCode + newCode;
}

export function TrainListComponent({
  trains,
  diaStations,
  timetableDirection,
  setTrains,
  trainTypes,
  clipboard,
  setClipboard,
  setSettingData,
}: {
  trains: Train[];
  diaStations: StationLike[];
  timetableDirection: TimetableDirection;
  setTrains: (trains: Train[]) => void;
  trainTypes: TrainType[];
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
  setSettingData: (settingData: SettingData) => void;
}) {
  const [contextData, setContextData] = useState<ContextData>({
    visible: false,
    posX: 0,
    posY: 0,
  });
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);

  function getDiaTimesOfStations(train: Train, diaStations: StationLike[]): DiaTime[] {
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
        const targetTrain = (() => {
          for (const train of trains) {
            const id = 'dia-train-block-' + train.trainId;
            const elem = document.getElementById(id);
            if (elem && elem.contains(e.target as Node)) {
              return train;
            }
          }
          return null;
        })();

        if (targetTrain) {
          e.preventDefault();
          setContextData({ visible: true, posX: e.clientX, posY: e.clientY });
          setSelectedTrain(targetTrain);
        }
      }}
    >
      <TrainContextMenuComponent
        {...{ contextData, trains, setTrains, setContextData, clipboard, setClipboard, selectedTrain }}
      />
      {trains.map((train) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '24px', width: '56px' }}>
            {/* 列車番号 */}
            <EditableTextComponent
              value={train.trainCode}
              onChange={(value) => {
                if (value == '') {
                  train.trainCode = '';
                } else {
                  train.trainCode = value;
                }
                setTrains([...trains]);
                return true;
              }}
              height={24}
              width={null}
            />
          </div>
          <div style={{ height: '24px', width: '56px' }}>
            {/* 列車名 */}
            <EditableTextComponent
              value={train.trainName ?? ''}
              onChange={(value) => {
                if (value == '') {
                  train.trainName = '';
                } else {
                  train.trainName = value;
                }
                setTrains([...trains]);
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
                  setTrains([...trains]);
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
            <button
              onClick={() => {
                setSettingData({
                  settingType: 'StationOperationSetting',
                  firstOrLast: 'First',
                  train: train,
                });
              }}
            >
              {showStationOperation(train.firstStationOperation, 'First')}
            </button>
          </div>
          <div style={{ height: '24px' }}>
            {/* 終着駅作業 */}
            <button
              onClick={() => {
                setSettingData({
                  settingType: 'StationOperationSetting',
                  firstOrLast: 'Last',
                  train: train,
                });
              }}
            >
              {showStationOperation(train.lastStationOperation, 'Last')}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }} id={'dia-train-block-' + train.trainId}>
            {/* 時刻リスト */}
            {getDiaTimesOfStations(train, diaStations).map((diaTime) => (
              <TrainListItemComponent {...{ diaTime, trains, setTrains }} />
            ))}
          </div>
          <div>
            <button
              onClick={() => {
                const index = trains.findIndex((t) => t.trainId === train.trainId);
                if (index >= 0) {
                  trains.splice(index, 1);
                  setTrains([...trains]);
                }
              }}
            >
              削除
            </button>
          </div>
        </div>
      ))}
      <div>
        <button
          onClick={() => {
            const newTrainCode = getNewTrainCode(trains);
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
                isInService: true,
              })),
              trainCode: newTrainCode,
              firstStationOperation: getDefaultConnectionType(),
              lastStationOperation: getDefaultConnectionType(),
              direction: timetableDirection,
            });
            setTrains([...trains]);
          }}
        >
          列車を追加
        </button>
      </div>
    </div>
  );
}
