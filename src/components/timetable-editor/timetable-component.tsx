import { useState } from 'react';
import { DeepReadonly } from 'ts-essentials';
import { nn } from '../../common';
import { DiaTime, StationLike, TimetableDirection, Train } from '../../model';

function getStationTimetable(trains: DeepReadonly<Train[]>, stationId: string) {
  const stationTimetable: [DiaTime, string][] = trains
    .map((train) => {
      const stationTimes = train.diaTimes.filter((diaTime) => diaTime.stationId === stationId && !diaTime.isPassing);
      if (stationTimes.length === 0) {
        return null;
      }

      // 終着駅の情報はこれだとまずい？
      const finalStationId = train.diaTimes[train.diaTimes.length - 1].stationId;

      return [stationTimes[0], finalStationId] as [DiaTime, string];
    })
    .filter((t) => t != null && t[0].departureTime != null) as [DiaTime, string][];

  return stationTimetable.reduce((acc, [diaTime, stationId]) => {
    const hour = Math.floor(diaTime.departureTime! / 60 / 60);
    if (acc[hour] === undefined) {
      acc[hour] = [];
    }
    acc[hour].push([diaTime, stationId]);
    return acc;
  }, [] as { [key: number]: [DiaTime, string][] });
}

function StationTimetableComponent({
  trains,
  stationMap,
  stationId,
}: DeepReadonly<{ trains: Train[]; stationMap: Map<string, StationLike>; stationId: string }>) {
  const stationTimetable = getStationTimetable(trains, stationId);

  function showMinutes(seconds: number) {
    return (Math.floor(seconds / 60) % 60).toString().padStart(2, '0');
  }

  return (
    <div>
      <table>
        <tbody>
          {Object.keys(stationTimetable).map((hour) => (
            <tr key={hour}>
              <td style={{ borderRight: 'solid 1px black', padding: '3px' }}>{hour}</td>
              <td>
                {stationTimetable[Number(hour)].map(([diaTime, stationId]) => (
                  <span key={diaTime.diaTimeId} style={{ margin: '5px' }}>
                    <span>{showMinutes(diaTime.departureTime!)}</span>
                    <span style={{ fontSize: '10px' }}>{nn(stationMap.get(stationId)).stationName}</span>
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
  stationMap,
  stationIds,
}: DeepReadonly<{
  inboundTrains: Train[];
  outboundTrains: Train[];
  stationMap: Map<string, StationLike>;
  stationIds: string[];
}>) {
  const [selectedStationId, setSelectedDiaStation] = useState(stationIds[0]);
  const [timetableDirection, setTimetableDirection] = useState<TimetableDirection>('Inbound');

  return (
    <div>
      <div>
        <span>駅:</span>
        <select
          value={selectedStationId}
          onChange={(e) => {
            const diaStationId = e.currentTarget.value;
            const diaStation = stationIds.find((stationId) => stationId === diaStationId);
            if (diaStation == null) {
              return;
            }
            setSelectedDiaStation(diaStation);
          }}
        >
          {stationIds.map((stationId) => (
            <option key={stationId} value={stationId}>
              {nn(stationMap.get(stationId)).stationName}
            </option>
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
          stationId={selectedStationId}
          stationMap={stationMap}
          trains={timetableDirection === 'Inbound' ? inboundTrains : outboundTrains}
        />
      </div>
    </div>
  );
}
