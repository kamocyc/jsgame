import { useState } from 'preact/hooks';
import { DiaTime, StationLike, TimetableDirection, Train } from '../../model';

function getStationTimetable(trains: Train[], diaStation: StationLike) {
  const stationTimetable = trains
    .map((train) => {
      const stationTimes = train.diaTimes.filter(
        (diaTime) => diaTime.station.stationId === diaStation.stationId && !diaTime.isPassing
      );
      if (stationTimes.length === 0) {
        return null;
      }

      // 終着駅の情報はこれだとまずい？
      const finalStation = train.diaTimes[train.diaTimes.length - 1].station;

      return [stationTimes[0], finalStation] as [DiaTime, StationLike];
    })
    .filter((t) => t != null && t[0].departureTime != null) as [DiaTime, StationLike][];

  return stationTimetable.reduce((acc, [diaTime, diaStation]) => {
    const hour = Math.floor(diaTime.departureTime! / 60 / 60);
    if (acc[hour] === undefined) {
      acc[hour] = [];
    }
    acc[hour].push([diaTime, diaStation]);
    return acc;
  }, [] as { [key: number]: [DiaTime, StationLike][] });
}

function StationTimetableComponent({ trains, diaStation }: { trains: Train[]; diaStation: StationLike }) {
  const stationTimetable = getStationTimetable(trains, diaStation);

  function showMinutes(seconds: number) {
    return (Math.floor(seconds / 60) % 60).toString().padStart(2, '0');
  }

  return (
    <div>
      <table>
        <tbody>
          {Object.keys(stationTimetable).map((hour) => (
            <tr>
              <td style={{ borderRight: 'solid 1px black', padding: '3px' }}>{hour}</td>
              <td>
                {stationTimetable[Number(hour)].map(([diaTime, diaStation]) => (
                  <span style={{ margin: '5px' }}>
                    <span>{showMinutes(diaTime.departureTime!)}</span>
                    <span style={{ fontSize: '10px' }}>{diaStation.stationName}</span>
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StationTimetablePageComponent({
  inboundTrains,
  outboundTrains,
  diaStations,
}: {
  inboundTrains: Train[];
  outboundTrains: Train[];
  diaStations: StationLike[];
}) {
  const [selectedDiaStation, setSelectedDiaStation] = useState(diaStations[0]);
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');

  return (
    <div>
      <div>
        <span>駅:</span>
        <select
          value={selectedDiaStation.stationId}
          onChange={(e) => {
            const diaStationId = e.currentTarget.value;
            const diaStation = diaStations.find((diaStation) => diaStation.stationId === diaStationId);
            if (diaStation == null) {
              return;
            }
            setSelectedDiaStation(diaStation);
          }}
        >
          {diaStations.map((diaStation) => (
            <option value={diaStation.stationId}>{diaStation.stationName}</option>
          ))}
        </select>
      </div>
      <div>
        <select
          value={timetableDirection}
          onChange={(e) => {
            const timetableDirection = e.currentTarget.value as TimetableDirection;
            setTimetableDirection(timetableDirection);
          }}
        >
          <option value='Inbound'>上り</option>
          <option value='Outbound'>下り</option>
        </select>
      </div>
      <div>
        <StationTimetableComponent
          diaStation={selectedDiaStation}
          trains={timetableDirection === 'Inbound' ? inboundTrains : outboundTrains}
        />
      </div>
    </div>
  );
}
