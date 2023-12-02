import { nn } from '../../common';
import { RailwayLine } from '../../mapEditorModel';
import { StationLike } from '../../model';
import { OutlinedTimetableData } from '../../outlinedTimetableData';
import { ListSettingCommonComponent } from './ListSettingCommonComponent';

export function LineInfoPanel({
  railwayLines,
  stations,
  timetableData,
  setRailwayLines,
  selectedRailwayLineId,
  setSelectedRailwayLineId,
}: {
  railwayLines: RailwayLine[];
  stations: Map<string, StationLike>;
  timetableData: OutlinedTimetableData;
  setRailwayLines: (railwayLines: RailwayLine[]) => void;
  selectedRailwayLineId: string | null;
  setSelectedRailwayLineId: (id: string) => void;
}) {
  return (
    <>
      <div>
        <h2
          style={{
            fontSize: '1.2rem',
            margin: 0,
            padding: '0.5rem',
          }}
        >
          路線情報
        </h2>
        <div>マップ上の駅をクリックで新規路線を作成</div>
        <button
          onClick={() => {
            setSelectedRailwayLineId('__ALL__');
          }}
          style={{
            backgroundColor: selectedRailwayLineId === '__ALL__' ? '#ddd' : '',
          }}
        >
          全て表示
        </button>
        <ListSettingCommonComponent<RailwayLine>
          datas={railwayLines}
          getKey={(railwayLine) => railwayLine.railwayLineId}
          setDatas={(railwayLines) => {
            setRailwayLines([...railwayLines]);
          }}
          selectData={(railwayLine) => {
            setSelectedRailwayLineId(railwayLine.railwayLineId);
          }}
          getSettingComponent={(railwayLine) => {
            return (
              <div>
                <div>
                  <label>路線名</label>
                  <input
                    type='text'
                    value={railwayLine.railwayLineName}
                    onChange={(e) => {
                      railwayLine.railwayLineName = (e.target as HTMLInputElement).value;
                      setRailwayLines([...railwayLines]);
                    }}
                  />
                </div>
                <div>
                  <label>路線色</label>
                  <input
                    type='color'
                    value={railwayLine.railwayLineColor}
                    onChange={(e) => {
                      railwayLine.railwayLineColor = (e.target as HTMLInputElement).value;
                      setRailwayLines([...railwayLines]);
                    }}
                  />
                </div>
                <div>
                  駅一覧:
                  <ul>
                    {railwayLine.stops.map((stop) => (
                      <li>{nn(stations.get(stop.platform.stationId)).stationName}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          }}
          getDisplayName={(railwayLine) => {
            return railwayLine.railwayLineName;
          }}
          excludeFromDatas={(railwayLines, railwayLine) => {
            // TODO: 削除確認ダイアログを出す？
            const timetable = timetableData._timetables.find((t) => t.railwayLineId === railwayLine.railwayLineId);
            if (timetable != null) {
              // TODO
              throw new Error('TODO');
              // OutlinedTimetableFunc.deleteTimetable(timetableData, timetable.timetableId);
            }
            return railwayLines.filter((rl) => rl.railwayLineId !== railwayLine.railwayLineId);
          }}
          getNewData={null}
        />
      </div>
    </>
  );
}
