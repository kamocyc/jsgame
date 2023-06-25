import { useState } from 'preact/hooks';
import { Station } from '../../model';
import { DiaTime, DiaTrain, TimetableDirection } from './model';

function getStationTimetable(diaTrains: DiaTrain[], diaStation: Station) {
  const stationTimetable = diaTrains
    .map((diaTrain) => {
      const stationTimes = diaTrain.diaTimes.filter(
        (diaTime) => diaTime.diaStation.stationId === diaStation.stationId && !diaTime.isPassing
      );
      if (stationTimes.length === 0) {
        return null;
      }

      // 終着駅の情報はこれだとまずい？
      const finalStation = diaTrain.diaTimes[diaTrain.diaTimes.length - 1].diaStation;

      return [stationTimes[0], finalStation] as [DiaTime, Station];
    })
    .filter((t) => t != null && t[0].departureTime != null) as [DiaTime, Station][];

  return stationTimetable.reduce((acc, [diaTime, diaStation]) => {
    const hour = Math.floor(diaTime.departureTime! / 60 / 60);
    if (acc[hour] === undefined) {
      acc[hour] = [];
    }
    acc[hour].push([diaTime, diaStation]);
    return acc;
  }, [] as { [key: number]: [DiaTime, Station][] });
}

function StationTimetableComponent({ diaTrains, diaStation }: { diaTrains: DiaTrain[]; diaStation: Station }) {
  const stationTimetable = getStationTimetable(diaTrains, diaStation);

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
  inboundDiaTrains,
  outboundDiaTrains,
  diaStations,
}: {
  inboundDiaTrains: DiaTrain[];
  outboundDiaTrains: DiaTrain[];
  diaStations: Station[];
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
          diaTrains={timetableDirection === 'Inbound' ? inboundDiaTrains : outboundDiaTrains}
        />
      </div>
    </div>
  );
}
