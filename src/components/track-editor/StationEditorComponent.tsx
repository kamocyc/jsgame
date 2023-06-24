import { useState } from 'preact/hooks';
import { Switch } from '../../model';
import { parseTime, showGlobalTime } from '../../timetableEditor';
import { Platform, Timetable, Train } from '../../uiEditorModel';

export function TrainSelector({
  trains,
  selectedTrain,
  setSelectedTrain,
}: {
  trains: Train[];
  selectedTrain: Train;
  setSelectedTrain: (train: Train) => void;
}) {
  return (
    <>
      列車:
      <select
        onChange={(e) => {
          const trainId = (e.target as HTMLSelectElement).value;
          const train = trains.find((train) => train.trainId === trainId);
          if (train) {
            setSelectedTrain(train);
          }
        }}
      >
        {trains.map((train) => (
          <option value={train.trainId} selected={train.trainId === selectedTrain.trainId ? true : false}>
            {train.trainName}
          </option>
        ))}
      </select>
    </>
  );
}

export function SwitchEditor({ timetable, trains, Switch }: { timetable: Timetable; trains: Train[]; Switch: Switch }) {
  const [selectedTrain, setSelectedTrain] = useState<Train>(trains[0]);
  const [_, setUpdate] = useState([]);
  const ttItems = timetable.switchTTItems.filter(
    (item) => item.Switch.switchId === Switch.switchId && item.train.trainId === selectedTrain.trainId
  );

  if (ttItems.length === 0) {
    ttItems.push({
      train: selectedTrain,
      Switch: Switch,
      branchDirection: 'Straight',
      changeTime: 0,
    });

    timetable.switchTTItems.push(ttItems[0]);

    setUpdate([]);
  }

  const ttItem = ttItems[0];

  return (
    <div>
      <div>
        <TrainSelector trains={trains} selectedTrain={selectedTrain} setSelectedTrain={setSelectedTrain} />
      </div>

      <>
        <label>
          直進
          <input
            type='radio'
            name='switchType'
            value='normal'
            checked={ttItem.branchDirection === 'Straight'}
            onChange={(e) => {
              ttItem.branchDirection = 'Straight';
              setUpdate([]);
            }}
          />
        </label>
        <label>
          分岐
          <input
            type='radio'
            name='switchType'
            value='branch'
            checked={ttItem.branchDirection === 'Branch'}
            onChange={(e) => {
              ttItem.branchDirection = 'Branch';
              setUpdate([]);
            }}
          />
        </label>
      </>
    </div>
  );
}

export function StationEditor({
  timetable,
  trains,
  station,
}: {
  timetable: Timetable;
  trains: Train[];
  station: Platform;
}) {
  const [selectedTrain, setSelectedTrain] = useState<Train>(trains[0]);
  const [_, setUpdate] = useState([]);
  const ttItems = timetable.stationTTItems.filter(
    (item) => item.station.platformId === station.platformId && item.train.trainId === selectedTrain.trainId
  );

  return (
    <div>
      <div>
        <input value={station.platformName} />
        <TrainSelector trains={trains} selectedTrain={selectedTrain} setSelectedTrain={setSelectedTrain} />
      </div>

      <>
        <button
          onClick={() => {
            timetable.stationTTItems.push({
              train: selectedTrain,
              station: station,
              departureTime: 0,
            });

            setUpdate([]);
          }}
        >
          時刻を追加
        </button>
      </>
      <>
        {ttItems.map((item) => (
          <div>
            <span>
              <button
                onClick={(e) => {
                  timetable.stationTTItems = timetable.stationTTItems.filter((item2) => item2 !== item);
                  setUpdate([]);
                }}
              >
                削除
              </button>
            </span>
            出発時間：
            <input
              value={showGlobalTime(item.departureTime)}
              onChange={(e) => {
                const stringValue = (e.target as HTMLInputElement).value;
                const newTime = parseTime(stringValue);
                if (newTime) {
                  item.departureTime = newTime;
                  setUpdate([]);
                }
              }}
            />
          </div>
        ))}
      </>
    </div>
  );
}
