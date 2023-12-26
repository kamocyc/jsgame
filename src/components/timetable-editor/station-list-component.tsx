import { DeepReadonly } from 'ts-essentials';
import { nn } from '../../common';
import { SettingData, StationLike, Train } from '../../model';
import { SetTimetable } from './common-component';
import './timetable-editor.css';

export function StationListComponent({
  stationIds,
  stations,
}: DeepReadonly<{
  stationIds: string[];
  stations: DeepReadonly<StationLike[]>;
  setTimetable: SetTimetable;
  trains: readonly Train[];
  otherDirectionTrains: readonly Train[];
  timetableDirection: 'Inbound' | 'Outbound';
  setSettingData: (settingData: DeepReadonly<SettingData>) => void;
}>) {
  return (
    <div>
      <div>
        {stationIds.map((stationId) => (
          <div
            key={stationId}
            style={{ height: 24 * 3 + 'px', borderStyle: 'solid', borderWidth: '1px', paddingRight: '3px' }}
            id={'dia-station-block-' + stationId}
          >
            {nn(stations.find((s) => s.stationId === stationId)).stationName}
          </div>
        ))}
      </div>
    </div>
  );
}
