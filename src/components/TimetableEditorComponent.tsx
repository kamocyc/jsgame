import { Ref, useEffect, useRef, useState } from 'preact/hooks';
import { generateId } from '../model';
import { parseTime, showGlobalTime } from '../timetableEditor';

interface DiaStation {
  diaStationId: number;
  diaStationName: string;
}

interface DiaTime {
  arrivalTime: number;
  departureTime: number;
  diaStation: DiaStation;
}

interface DiaTrain {
  diaTrainId: number;
  trainName?: string;
  diaTimes: DiaTime[];
}

interface Timetable {
  diaTrains: DiaTrain[];
  diaStations: DiaStation[];
}

/**
 * Hook that alerts clicks outside of the passed ref
 */
function useOnClickOutside(ref: Ref<HTMLInputElement>, handler: () => void) {
  useEffect(() => {
    /**
     * Alert if clicked on outside of element
     */
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && (event.target == null || !ref.current.contains(event.target as Node))) {
        handler();
      }
    }
    // Bind the event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref]);
}

function StationComponent({
  diaStation,
  setDiaStation,
}: {
  diaStation: DiaStation;
  setDiaStation: (diaStation: DiaStation) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  // コントロール外をクリックしたときに編集を終了する
  const ref = useRef(null);
  useOnClickOutside(ref, () => setIsEditing(false));

  return isEditing ? (
    <>
      <input
        ref={ref}
        style={{ display: 'block', width: '50px', height: '18px' }}
        value={diaStation.diaStationName}
        onChange={(e) => {
          diaStation.diaStationName = (e.target as HTMLInputElement).value.trim();
          setDiaStation({ ...diaStation });
        }}
      />
      <div>-</div>
    </>
  ) : (
    <div>
      <div
        onClick={() => {
          setIsEditing(true);
        }}
        style={{ display: 'block', width: '50px', height: '24px' }}
      >
        {diaStation.diaStationName}
      </div>
      <div>-</div>
    </div>
  );
}

export function StationListComponent({
  timetable,
  setTimetable,
}: {
  timetable: Timetable;
  setTimetable: (timetable: Timetable) => void;
}) {
  return (
    <div>
      <div>
        {timetable.diaStations.map((diaStation) => (
          <StationComponent
            diaStation={diaStation}
            setDiaStation={(diaStation) => {
              diaStation.diaStationName = diaStation.diaStationName;
              setTimetable({ ...timetable });
            }}
          />
        ))}
      </div>
      <div>
        <button
          onClick={() => {
            timetable.diaStations.push({
              diaStationId: generateId(),
              diaStationName: '',
            });
            setTimetable({ ...timetable });
          }}
        >
          駅を追加
        </button>
      </div>
    </div>
  );
}

export function TimeInputComponent({ time, setTime }: { time: number; setTime: (time: number) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  // コントロール外をクリックしたときに編集を終了する
  // https://stackoverflow.com/questions/32553158/detect-click-outside-react-component
  const ref = useRef(null);
  useOnClickOutside(ref, () => setIsEditing(false));

  return isEditing ? (
    <input
      ref={ref}
      style={{ display: 'block', width: '50px', height: '18px' }}
      value={showGlobalTime(time)}
      onChange={(e) => {
        const stringValue = (e.target as HTMLInputElement).value;
        const newTime = parseTime(stringValue);
        if (newTime) {
          setTime(newTime);
        }
      }}
    />
  ) : (
    <div
      onClick={() => {
        setIsEditing(true);
      }}
      style={{ display: 'block', width: '50px' }}
    >
      {showGlobalTime(time)}
    </div>
  );
}

export function TrainListComponent({
  timetable,
  setTimetable,
}: {
  timetable: Timetable;
  setTimetable: (timetable: Timetable) => void;
}) {
  return (
    <div style={{ display: 'flex' }}>
      {timetable.diaTrains.map((diaTrain) => (
        <table>
          <tbody>
            {diaTrain.diaTimes.map((diaTime) => (
              <tr>
                <TimeInputComponent
                  time={diaTime.arrivalTime}
                  setTime={(time) => {
                    diaTime.arrivalTime = time;
                    setTimetable({ ...timetable });
                  }}
                />
                <TimeInputComponent
                  time={diaTime.departureTime}
                  setTime={(time) => {
                    diaTime.departureTime = time;
                    setTimetable({ ...timetable });
                  }}
                />
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

export function TimetableEditorComponent() {
  const [timetable, setTimetable] = useState<Timetable>({
    diaTrains: [
      {
        diaTrainId: 1,
        diaTimes: [
          {
            arrivalTime: 0,
            departureTime: 0,
            diaStation: {
              diaStationId: 1,
              diaStationName: 'a',
            },
          },
        ],
      },
    ],
    diaStations: [
      {
        diaStationId: 1,
        diaStationName: 'a',
      },
    ],
  });

  return (
    <div style={{ display: 'flex' }}>
      <StationListComponent timetable={timetable} setTimetable={setTimetable} />
      <TrainListComponent timetable={timetable} setTimetable={setTimetable} />
    </div>
  );
}
