import { useState } from 'preact/hooks';
import { Platform, Switch } from '../../model';
import { TimeInputComponent } from '../timetable-editor/common-component';
import { Timetable, Train } from './uiEditorModel';

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
      changeTime: null,
    });

    timetable.switchTTItems.push(ttItems[0]);

    setUpdate([]);
  }

  return (
    <div>
      <div>
        <TrainSelector trains={trains} selectedTrain={selectedTrain} setSelectedTrain={setSelectedTrain} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', margin: '5px' }}>
        {ttItems.map((ttItem) => (
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            <div style={{ padding: '3px', margin: '3px' }}>
              <TimeInputComponent
                setTime={(time) => {
                  ttItem.changeTime = time;
                  setUpdate([]);
                }}
                time={ttItem.changeTime}
              />
            </div>
            <div style={{ borderStyle: 'solid', borderWidth: '2px', borderColor: '#ccc', padding: '3px' }}>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformSelector({
  platforms,
  platform,
  setSelectedPlatform,
}: {
  platforms: Platform[];
  platform: Platform;
  setSelectedPlatform: (platform: Platform) => void;
}) {
  return (
    <>
      プラットフォーム:
      <select
        onChange={(e) => {
          const platformId = (e.target as HTMLSelectElement).value;
          const platform = platforms.find((platform) => platform.platformId === platformId);
          if (platform) {
            setSelectedPlatform(platform);
          }
        }}
      >
        {platforms.map((p) => (
          <option value={p.platformId} selected={p.platformId === platform.platformId ? true : false}>
            {p.platformName}
          </option>
        ))}
      </select>
    </>
  );
}

export function StationEditor({
  timetable,
  trains,
  platform,
  setPlatform,
  update,
}: {
  timetable: Timetable;
  trains: Train[];
  platform: Platform;
  setPlatform: (platform: Platform) => void;
  update: () => void;
}) {
  const [selectedTrain, setSelectedTrain] = useState<Train>(trains[0]);
  const [_, setUpdate_] = useState([]);
  const setUpdate = () => {
    setUpdate_([]);
    update();
  };

  const station = platform.station;
  const ttItems = timetable.platformTTItems.filter(
    (item) => item.platform.platformId === platform.platformId && item.train.trainId === selectedTrain.trainId
  );

  return (
    <div>
      <div>
        <div>
          <input
            value={station.stationName}
            onChange={(e) => {
              station.stationName = (e.target as HTMLInputElement).value;
              setUpdate();
            }}
          />
        </div>
        <div>
          <PlatformSelector platforms={station.platforms} platform={platform} setSelectedPlatform={setPlatform} />
        </div>
        <div>
          <TrainSelector trains={trains} selectedTrain={selectedTrain} setSelectedTrain={setSelectedTrain} />
        </div>
      </div>

      <>
        <button
          onClick={() => {
            timetable.platformTTItems.push({
              train: selectedTrain,
              platform: platform,
              departureTime: 0,
              arrivalTime: 0,
              track: null /* TODO: 方向を指定する */,
            });

            setUpdate();
          }}
        >
          時刻を追加
        </button>
      </>
      <div style={{ border: '1px', borderStyle: 'solid', padding: '1px', minHeight: '10px' }}>
        {ttItems.map((item) => (
          <div>
            <span style={{ marginRight: '5px' }}>
              <button
                onClick={(e) => {
                  timetable.platformTTItems = timetable.platformTTItems.filter((item2) => item2 !== item);
                  setUpdate();
                }}
              >
                削除
              </button>
            </span>
            <span>
              到着時間：
              <TimeInputComponent
                time={item.arrivalTime}
                setTime={(newTime) => {
                  item.arrivalTime = newTime;
                  setUpdate();
                }}
              />
            </span>
            <span>
              出発時間：
              <TimeInputComponent
                time={item.departureTime}
                setTime={(newTime) => {
                  item.departureTime = newTime;
                  setUpdate();
                }}
              />
            </span>
            {/* <input
              value={item.departureTime === null ? '' : showGlobalTime(item.departureTime)}
              onChange={(e) => {
                const stringValue = (e.target as HTMLInputElement).value;
                const newTime = parseTime(stringValue);
                if (newTime) {
                  item.departureTime = newTime;
                  setUpdate();
                }
              }}
            /> */}
          </div>
        ))}
      </div>
    </div>
  );
}
