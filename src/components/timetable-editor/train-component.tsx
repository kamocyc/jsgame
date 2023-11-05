import { useState } from 'preact/hooks';
import { assert } from '../../common';
import {
  AppClipboard,
  ContextData,
  CrudTrain,
  DiaTime,
  PlatformLike,
  StationLike,
  StationOperation,
  TimetableDirection,
  Train,
  cloneTrain,
  generateId,
  getDefaultConnectionType,
} from '../../model';
import { HistoryItem } from '../../outlinedTimetableData';
import { ContextMenuComponent, EditableTextComponent, TimeInputComponent } from './common-component';
import { TimetableEditorDirectedProps } from './timetable-editor-component';
import { getFirstOrLast, getRailwayPlatform } from './timetable-util';

function TrainContextMenuComponent({
  trains,
  crudTrain,
  contextData,
  setContextData,
  clipboard,
  setClipboard,
  selectedTrain,
  timetableDirection,
}: {
  trains: readonly Train[];
  crudTrain: CrudTrain;
  contextData: ContextData;

  setContextData: (contextData: ContextData) => void;
  clipboard: AppClipboard;
  setClipboard: (clipboard: AppClipboard) => void;
  selectedTrain: Train | null;
  timetableDirection: TimetableDirection;
}) {
  return (
    <ContextMenuComponent
      contextData={contextData}
      setContextData={setContextData}
      menuItems={[
        {
          label: '列車を削除',
          onClick: () => {
            if (selectedTrain != null) {
              const oldTrains = trains; // undo用
              crudTrain.deleteTrains([selectedTrain.trainId]);
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
              crudTrain.addTrains(
                newTrains.map((newTrain) => ({
                  train: newTrain,
                  beforeTrainId: selectedTrain?.trainId ?? null,
                  direction: timetableDirection,
                }))
              );

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
  updateTrain,
}: {
  diaTime: DiaTime;
  updateTrain: (historyItem: HistoryItem) => void;
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
            updateTrain({
              this: undefined,
              redo: () => {
                diaTime.isPassing = !diaTime.isPassing;
              },
              undo: () => {
                diaTime.isPassing = !diaTime.isPassing;
              },
            });
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
            updateTrain({
              this: undefined,
              redo: () => {
                diaTime.isInService = !diaTime.isInService;
              },
              undo: () => {
                diaTime.isInService = !diaTime.isInService;
              },
            });
          }}
        >
          回
        </div>
      </div>
      <div style={{ width: 24 * 3 + 'px', display: 'flex', flexDirection: 'column' }}>
        <TimeInputComponent
          time={diaTime.arrivalTime}
          setTime={(time) => {
            const oldTime = diaTime.arrivalTime; // undo用
            updateTrain({
              this: undefined,
              redo: () => {
                diaTime.arrivalTime = time;
              },
              undo: () => {
                diaTime.arrivalTime = oldTime;
              },
            });
          }}
        />
        <PlatformComponent
          diaPlatform={diaTime.platform}
          allDiaPlatforms={diaTime.station.platforms}
          setDiaPlatform={(platform) => {
            const oldPlatform = diaTime.platform; // undo用
            updateTrain({
              this: undefined,
              redo: () => {
                diaTime.platform = platform;
              },
              undo: () => {
                diaTime.platform = oldPlatform;
              },
            });
          }}
        />
        <TimeInputComponent
          time={diaTime.departureTime}
          setTime={(time) => {
            const oldTime = diaTime.departureTime; // undo用
            updateTrain({
              this: undefined,
              redo: () => {
                diaTime.departureTime = time;
              },
              undo: () => {
                diaTime.departureTime = oldTime;
              },
            });
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
function getNewTrainCode(trains: readonly Train[]) {
  const codes = trains.map((train) => train.trainCode);
  const symbolInTrainCode = codes.length === 0 ? 'M' : codes[codes.length - 1].replace(/[^A-Z]/g, '');
  const maxCode =
    codes.length === 0
      ? '0'
      : codes.map((code) => code.replace(/[^0-9]/g, '')).sort((a, b) => parseInt(b) - parseInt(a))[0];
  const newCode = (parseInt(maxCode) + 2)
    .toString()
    .padStart(codes.length === 0 ? 3 : codes[codes.length - 1].replace(/[^0-9]/g, '').length, '0');
  return symbolInTrainCode + newCode;
}

export function TrainListComponent({
  trains,
  stations,
  timetableDirection,
  crudTrain,
  trainTypes,
  clipboard,
  setClipboard,
  setSettingData,
  railwayLine,
  timetable,
}: TimetableEditorDirectedProps) {
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
        {...{
          contextData,
          trains,
          crudTrain,
          setContextData,
          clipboard,
          setClipboard,
          selectedTrain,
          timetableDirection,
        }}
      />
      {trains.map((train) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '24px', width: '56px' }}>
            {/* 列車番号 */}
            <EditableTextComponent
              value={train.trainCode}
              onChange={(value) => {
                const oldTrainCode = train.trainCode; // undo用
                crudTrain.updateTrain({
                  this: undefined,
                  redo: () => {
                    if (value == '') {
                      train.trainCode = '';
                    } else {
                      train.trainCode = value;
                    }
                  },
                  undo: () => {
                    train.trainCode = oldTrainCode;
                  },
                });

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
                const oldTrainName = train.trainName; // undo用
                crudTrain.updateTrain({
                  this: undefined,
                  redo: () => {
                    if (value == '') {
                      train.trainName = '';
                    } else {
                      train.trainName = value;
                    }
                  },
                  undo: () => {
                    train.trainName = oldTrainName;
                  },
                });

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
                  const oldTrainType = train.trainType; // undo用
                  crudTrain.updateTrain({
                    this: undefined,
                    redo: () => {
                      const newTrainType = trainTypes.find(
                        (trainType) => trainType.trainTypeId === (e.target as HTMLSelectElement).value
                      );
                      if (newTrainType) {
                        train.trainType = newTrainType;
                      } else {
                        train.trainType = undefined;
                      }
                    },
                    undo: () => {
                      train.trainType = oldTrainType;
                    },
                  });
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
            {getDiaTimesOfStations(train, stations).map((diaTime) => (
              <TrainListItemComponent diaTime={diaTime} updateTrain={(h) => crudTrain.updateTrain(h)} />
            ))}
          </div>
          <div>
            <button
              onClick={() => {
                crudTrain.deleteTrains([train.trainId]);
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
            const newTrain: Train = {
              trainId: generateId(),
              trainName: '',
              diaTimes: stations.map((station) => {
                const platform = getRailwayPlatform(
                  railwayLine,
                  station.stationId,
                  getFirstOrLast(timetableDirection, timetable.inboundIsFirstHalf)
                );
                const stop = railwayLine.stops.find((stop) => stop.platform.platformId === platform.platformId);
                assert(stop != null);
                return {
                  diaTimeId: generateId(),
                  arrivalTime: null,
                  departureTime: null,
                  isPassing: false,
                  station: station,
                  platform: platform,
                  isInService: true,
                  trackId: stop.platformTrack.trackId,
                };
              }),
              trainCode: newTrainCode,
              firstStationOperation: getDefaultConnectionType(),
              lastStationOperation: getDefaultConnectionType(),
            };
            crudTrain.addTrain(newTrain, timetableDirection);
          }}
        >
          列車を追加
        </button>
      </div>
    </div>
  );
}
