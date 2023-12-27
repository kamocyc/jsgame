import { useState } from 'react';
import { DeepReadonly } from 'ts-essentials';
import { StateUpdater, assert, nn, toMap } from '../../common';
import { OperationError } from '../../mapEditorModel';
import {
  AppClipboard,
  ContextData,
  CrudTrain,
  DiaTime,
  PlatformLike,
  StationLike,
  TimetableDirection,
  Train,
  cloneTrain,
  generateId,
  getDefaultConnectionType,
} from '../../model';
import { ContextMenuComponent, EditableTextComponent, TimeInputComponent, getStationMap } from './common-component';
import { getDefaultPlatformId } from './station-edit-component';
import { TimetableEditorDirectedProps } from './timetable-editor-component';
import { getPlatformIdAndTrackId } from './timetable-util';
import { TooltipComponent } from './tooltip-component';

function TrainContextMenuComponent({
  crudTrain,
  contextData,
  setContextData,
  clipboard,
  setClipboard,
  selectedTrain,
  timetableDirection,
}: {
  readonly crudTrain: DeepReadonly<CrudTrain>;
  readonly contextData: DeepReadonly<ContextData>;
  readonly setContextData: DeepReadonly<StateUpdater<ContextData>>;
  readonly clipboard: AppClipboard;
  readonly setClipboard: (clipboard: AppClipboard) => void;
  readonly selectedTrain: DeepReadonly<Train | null>;
  readonly timetableDirection: DeepReadonly<TimetableDirection>;
}) {
  return (
    <ContextMenuComponent
      contextData={contextData}
      setContextData={setContextData}
      menuItems={[
        {
          label: '列車を削除',
          menuItemId: 'delete-train',
          onClick: () => {
            if (selectedTrain != null) {
              crudTrain.deleteTrains([selectedTrain.trainId]);
              setContextData({ ...contextData, visible: false });
            }
          },
        },
        {
          label: '列車をコピー',
          menuItemId: 'copy-train',
          onClick: () => {
            if (selectedTrain !== null) {
              const newTrain: Train = {
                ...cloneTrain(selectedTrain),
                trainId: generateId(),
              };
              setClipboard({ trains: [newTrain], originalTrainIds: [selectedTrain.trainId] });
            }
            setContextData({ ...contextData, visible: false });
          },
        },
        {
          label: '列車を貼り付け',
          menuItemId: 'paste-train',
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
  diaPlatformId,
  allDiaPlatforms,
  setDiaPlatform,
}: DeepReadonly<{
  diaPlatformId: string | null;
  allDiaPlatforms: PlatformLike[];
  setDiaPlatform: (diaPlatform: string | null) => void;
}>) {
  return (
    <select
      value={diaPlatformId ?? -1}
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
            setDiaPlatform(newDiaPlatform.platformId);
          }
        }
      }}
    >
      <option key={-1} value={-1}>
        -
      </option>
      {allDiaPlatforms.map((diaPlatform) => (
        <option key={diaPlatform.platformId} value={diaPlatform.platformId}>
          {diaPlatform.platformName}
        </option>
      ))}
    </select>
  );
}

function TrainListItemComponent({
  diaTime,
  stationMap,
  errors,
  updateTrain,
}: DeepReadonly<{
  diaTime: DiaTime;
  stationMap: Map<string, StationLike>;
  errors: readonly OperationError[];
  updateTrain: (diaTimeId: string, updater: (diaTime: DiaTime) => void) => void;
}>) {
  const errorMap = toMap(errors, (error) => error.diaTimeId ?? undefined);

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
        <WarningMessageComponent error={errorMap.get(diaTime.diaTimeId)} />
        <div
          style={{
            fontSize: '12px',
            width: '10px',
            color: diaTime.isPassing ? 'black' : 'lightgray',
            backgroundColor: diaTime.isPassing ? 'lightgreen' : 'white',
            cursor: 'pointer',
          }}
          onClick={() => {
            updateTrain(diaTime.diaTimeId, (diaTime: DiaTime) => {
              diaTime.isPassing = !diaTime.isPassing;
            });
          }}
        >
          レ
        </div>
        <div
          style={{
            fontSize: '12px',
            width: '10px',
            color: !diaTime.isInService ? 'black' : 'lightgray',
            backgroundColor: !diaTime.isInService ? 'lightgreen' : 'white',
            cursor: 'pointer',
          }}
          onClick={() => {
            updateTrain(diaTime.diaTimeId, (diaTime: DiaTime) => {
              diaTime.isInService = !diaTime.isInService;
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
            updateTrain(diaTime.diaTimeId, (diaTime: DiaTime) => {
              diaTime.arrivalTime = time;
            });
          }}
        />
        <PlatformComponent
          diaPlatformId={diaTime.platformId}
          allDiaPlatforms={nn(stationMap.get(diaTime.stationId)).platforms}
          setDiaPlatform={(platformId) => {
            updateTrain(diaTime.diaTimeId, (diaTime: DiaTime) => {
              diaTime.platformId = platformId;
            });
          }}
        />
        <TimeInputComponent
          time={diaTime.departureTime}
          setTime={(time) => {
            updateTrain(diaTime.diaTimeId, (diaTime: DiaTime) => {
              diaTime.departureTime = time;
            });
          }}
        />
      </div>
    </div>
  );
}

// function showStationOperation(stationOperation: StationOperation | undefined, firstOrLast: 'First' | 'Last') {
//   if (stationOperation === undefined) {
//     return '接続'; // 未設定
//   } else if (stationOperation.stationOperationType === 'Connection') {
//     return '接続';
//   } else if (stationOperation.stationOperationType === 'InOut') {
//     return firstOrLast === 'First' ? '出区' : '入区';
//   } else {
//     throw new Error('invalid');
//   }
// }

// 新しい列車番号を生成する（ロジックは適当）
function getNewTrainCode(trains: DeepReadonly<Train[]>) {
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
  errors,
}: TimetableEditorDirectedProps) {
  const [contextData, setContextData] = useState<ContextData>({
    visible: false,
    posX: 0,
    posY: 0,
  });
  const [selectedTrain, setSelectedTrain] = useState<DeepReadonly<Train> | null>(null);
  const stationMap = getStationMap(stations);

  function getDiaTimesOfStations(
    train: DeepReadonly<Train>,
    stations: DeepReadonly<StationLike[]>
  ): DeepReadonly<DiaTime[]> {
    try {
      return stations.map((diaStation) => {
        const diaTime = train.diaTimes.find((diaTime) => diaTime.stationId === diaStation.stationId);
        if (diaTime) {
          return diaTime;
        } else {
          throw new Error('diaTime not found');
        }
      });
    } catch (e) {
      // 暫定
      return [];
    }
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
          setContextData({ visible: true, posX: e.pageX, posY: e.pageY });
          setSelectedTrain(targetTrain);
        }
      }}
    >
      <TrainContextMenuComponent
        contextData={contextData}
        crudTrain={crudTrain}
        setContextData={setContextData}
        clipboard={clipboard}
        setClipboard={setClipboard}
        selectedTrain={selectedTrain}
        timetableDirection={timetableDirection}
      />
      {trains.map((train) => (
        <div key={train.trainId} style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}
          >
            <WarningMessageComponent
              error={errors.find((error) => error.trainId === train.trainId && error.diaTimeId === null)}
            />
          </div>
          <div style={{ height: '24px', width: '56px' }}>
            {/* 列車番号 */}
            <EditableTextComponent
              value={train.trainCode}
              onChange={(value) => {
                crudTrain.updateTrain(train.trainId, (train) => {
                  if (value == '') {
                    train.trainCode = '';
                  } else {
                    train.trainCode = value;
                  }
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
                crudTrain.updateTrain(train.trainId, (train) => {
                  if (value == '') {
                    train.trainName = '';
                  } else {
                    train.trainName = value;
                  }
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
                  crudTrain.updateTrain(train.trainId, (train) => {
                    const newTrainType = trainTypes.find(
                      (trainType) => trainType.trainTypeId === (e.target as HTMLSelectElement).value
                    );
                    if (newTrainType) {
                      train.trainType = newTrainType;
                    } else {
                      train.trainType = undefined;
                    }
                  });
                }
              }}
            >
              <option value='' key={'empty'}></option>
              {trainTypes.map((trainType) => (
                <option key={trainType.trainTypeId} value={trainType.trainTypeId}>
                  {trainType.trainTypeName}
                </option>
              ))}
            </select>
          </div>
          {/* 
          <div style={{ height: '24px' }}>
            {/* 始発駅作業 * /}
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
            {/* 終着駅作業 * /}
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
          </div> */}
          <div style={{ display: 'flex', flexDirection: 'column' }} id={'dia-train-block-' + train.trainId}>
            {/* 時刻リスト */}
            {getDiaTimesOfStations(train, stations).map((diaTime) => (
              <TrainListItemComponent
                key={diaTime.diaTimeId}
                errors={errors}
                stationMap={stationMap}
                diaTime={diaTime}
                updateTrain={(diaTimeId, updater) => {
                  crudTrain.updateTrain(train.trainId, (train) => {
                    const diaTime = train.diaTimes.find((diaTime) => diaTime.diaTimeId === diaTimeId);
                    assert(diaTime !== undefined);
                    updater(diaTime);
                  });
                }}
              />
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
              trainType: undefined,
              diaTimes: stations.map((station) => {
                const { platformId, trackId } =
                  railwayLine !== null && railwayLine.railwayLineId !== '__DUMMY__'
                    ? getPlatformIdAndTrackId(
                        railwayLine,
                        station.stationId,
                        timetableDirection,
                        timetable.inboundIsFirstHalf
                      )
                    : { platformId: getDefaultPlatformId(station, timetableDirection), trackId: null };

                return {
                  diaTimeId: generateId(),
                  arrivalTime: null,
                  departureTime: null,
                  isPassing: false,
                  stationId: station.stationId,
                  platformId: platformId,
                  isInService: true,
                  trackId: trackId,
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

export function WarningMessageComponent({ error }: { error: OperationError | undefined }) {
  return error ? (
    <TooltipComponent content={error.type}>
      <div
        style={{
          fontSize: '12px',
          width: '10px',
          color: '#ff9000',
          fontWeight: 'bold',
          height: '15px',
        }}
      >
        ⚠
      </div>
    </TooltipComponent>
  ) : (
    <div style={{ width: '10px', height: '15px' }}></div>
  );
}
