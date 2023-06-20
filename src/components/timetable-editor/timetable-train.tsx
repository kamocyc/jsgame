import { useState } from 'preact/hooks';
import { generateId } from '../../model';
import { ContextMenuComponent, EditableTextComponent, TimeInputComponent } from './common-components';
import {
  Clipboard,
  ContextData,
  DiaPlatform,
  DiaStation,
  DiaTime,
  DiaTrain,
  TimetableDirection,
  TrainType,
} from './timetable-model';
import { getDefaultPlatform } from './timetable-util';

function TrainContextMenuComponent({
  diaTrains,
  setDiaTrains,
  contextData,
  setContextData,
  clipboard,
  setClipboard,
  selectedDiaTrain,
}: {
  diaTrains: DiaTrain[];
  setDiaTrains: (diaTrains: DiaTrain[]) => void;
  contextData: ContextData;

  setContextData: (contextData: ContextData) => void;
  clipboard: Clipboard;
  setClipboard: (clipboard: Clipboard) => void;
  selectedDiaTrain: DiaTrain | null;
}) {
  return (
    <ContextMenuComponent
      contextData={contextData}
      setContextData={setContextData}
      menuItems={[
        {
          label: '列車を削除',
          onClick: () => {
            const index = diaTrains.findIndex((diaTrain) => diaTrain.diaTrainId === selectedDiaTrain?.diaTrainId);
            if (index >= 0) {
              diaTrains.splice(index, 1);
              setDiaTrains([...diaTrains]);
              setContextData({ ...contextData, visible: false });
            }
          },
        },
        {
          label: '列車をコピー',
          onClick: () => {
            const index = diaTrains.findIndex((diaTrain) => diaTrain.diaTrainId === selectedDiaTrain?.diaTrainId);
            if (index >= 0) {
              const newDiaTrain = JSON.parse(JSON.stringify(selectedDiaTrain)) as DiaTrain;
              newDiaTrain.diaTrainId = generateId();
              setClipboard({ diaTrain: newDiaTrain });
            }
            setContextData({ ...contextData, visible: false });
          },
        },
        {
          label: '列車を貼り付け',
          onClick: () => {
            const newDiaTrain = clipboard.diaTrain;
            if (newDiaTrain) {
              // 現在のdiaTrainの直前に挿入
              const index = diaTrains.findIndex((diaTrain) => diaTrain.diaTrainId === selectedDiaTrain?.diaTrainId);
              if (index >= 0) {
                diaTrains.splice(index, 0, newDiaTrain);
              } else {
                diaTrains.push(newDiaTrain);
              }
              setDiaTrains([...diaTrains]);
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
  diaPlatform: DiaPlatform;
  allDiaPlatforms: DiaPlatform[];
  setDiaPlatform: (diaPlatform: DiaPlatform) => void;
}) {
  return (
    <select
      value={diaPlatform.diaPlatformId}
      style={{ height: 22 + 'px' }}
      onChange={(e) => {
        if ((e.target as HTMLSelectElement)?.value != null) {
          const newDiaPlatform = allDiaPlatforms.find(
            (diaPlatform) => diaPlatform.diaPlatformId === Number((e.target as HTMLSelectElement).value)
          );
          if (newDiaPlatform) {
            setDiaPlatform(newDiaPlatform);
          }
        }
      }}
    >
      {allDiaPlatforms.map((diaPlatform) => (
        <option value={diaPlatform.diaPlatformId}>{diaPlatform.diaPlatformName}</option>
      ))}
    </select>
  );
}

function TrainListItemComponent({
  diaTime,
  diaTrains,
  setDiaTrains,
}: {
  diaTime: DiaTime;
  diaTrains: DiaTrain[];
  setDiaTrains: (diaTrains: DiaTrain[]) => void;
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
        style={{ fontSize: '12px', width: '10px', color: diaTime.isPassing ? 'black' : 'lightgray' }}
        onClick={() => {
          diaTime.isPassing = !diaTime.isPassing;
          setDiaTrains([...diaTrains]);
        }}
      >
        レ
      </div>
      <div style={{ width: 24 * 3 + 'px', display: 'flex', flexDirection: 'column' }}>
        <TimeInputComponent
          time={diaTime.arrivalTime}
          setTime={(time) => {
            diaTime.arrivalTime = time;
            setDiaTrains([...diaTrains]);
          }}
        />
        <PlatformComponent
          diaPlatform={diaTime.diaPlatform}
          allDiaPlatforms={diaTime.diaStation.diaPlatforms}
          setDiaPlatform={(diaPlatform) => {
            diaTime.diaPlatform = diaPlatform;
            setDiaTrains([...diaTrains]);
          }}
        />
        <TimeInputComponent
          time={diaTime.departureTime}
          setTime={(time) => {
            diaTime.departureTime = time;
            setDiaTrains([...diaTrains]);
          }}
        />
      </div>
    </div>
  );
}

export function TrainListComponent({
  diaTrains,
  diaStations,
  timetableDirection,
  setDiaTrains,
  trainTypes,
}: {
  diaTrains: DiaTrain[];
  diaStations: DiaStation[];
  timetableDirection: TimetableDirection;
  setDiaTrains: (diaTrains: DiaTrain[]) => void;
  trainTypes: TrainType[];
}) {
  const [contextData, setContextData] = useState<ContextData>({
    visible: false,
    posX: 0,
    posY: 0,
  });
  const [clipboard, setClipboard] = useState<Clipboard>({
    diaTrain: null,
  });
  const [selectedDiaTrain, setSelectedDiaTrain] = useState<DiaTrain | null>(null);

  function getDiaTimesOfStations(diaTrain: DiaTrain, diaStations: DiaStation[]): DiaTime[] {
    return diaStations.map((diaStation) => {
      const diaTime = diaTrain.diaTimes.find((diaTime) => diaTime.diaStation.diaStationId === diaStation.diaStationId);
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
          for (const diaTrain of diaTrains) {
            const id = 'dia-train-block-' + diaTrain.diaTrainId;
            const elem = document.getElementById(id);
            if (elem && elem.contains(e.target as Node)) {
              return diaTrain;
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
        {...{ contextData, diaTrains, setDiaTrains, setContextData, clipboard, setClipboard, selectedDiaTrain }}
      />
      {diaTrains.map((diaTrain) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '24px', width: '56px' }}>
            <EditableTextComponent
              value={diaTrain.trainName ?? ''}
              onChange={(value) => {
                if (value == '') {
                  diaTrain.trainName = undefined;
                } else {
                  diaTrain.trainName = value;
                }
                setDiaTrains([...diaTrains]);
                return true;
              }}
              height={24}
              width={null}
            />
          </div>
          <div style={{ height: '24px' }}>
            <select
              value={diaTrain.trainType?.trainTypeId}
              style={{ height: 22 + 'px' }}
              onChange={(e) => {
                if ((e.target as HTMLSelectElement)?.value != null) {
                  const newTrainType = trainTypes.find(
                    (trainType) => trainType.trainTypeId === Number((e.target as HTMLSelectElement).value)
                  );
                  if (newTrainType) {
                    diaTrain.trainType = newTrainType;
                  } else {
                    diaTrain.trainType = undefined;
                  }
                  setDiaTrains([...diaTrains]);
                }
              }}
            >
              <option value=''></option>
              {trainTypes.map((trainType) => (
                <option value={trainType.trainTypeId}>{trainType.trainTypeName}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }} id={'dia-train-block-' + diaTrain.diaTrainId}>
            {getDiaTimesOfStations(diaTrain, diaStations).map((diaTime) => (
              <TrainListItemComponent {...{ diaTime, diaTrains, setDiaTrains }} />
            ))}
          </div>
        </div>
      ))}
      <div>
        <button
          onClick={() => {
            diaTrains.push({
              diaTrainId: generateId(),
              diaTimes: diaStations.map((diaStation) => ({
                diaTimeId: generateId(),
                arrivalTime: null,
                departureTime: null,
                isPassing: false,
                diaStation: diaStation,
                diaPlatform: getDefaultPlatform(diaStation, timetableDirection),
              })),
            });
            setDiaTrains([...diaTrains]);
          }}
        >
          列車を追加
        </button>
      </div>
    </div>
  );
}