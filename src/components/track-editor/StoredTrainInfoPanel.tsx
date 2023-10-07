import { getNewName } from '../../common';
import { RailwayLine } from '../../mapEditorModel';
import { generateId } from '../../model';
import { ListSettingCommonComponent } from './ListSettingCommonComponent';
import { StoredTrain } from './trainMoveBase';

export function StoreTrainInfoPanel({
  storedTrains,
  railwayLines,
  setStoredTrains,
  selectedPlacedTrainId,
  setSelectedPlacedTrainId,
}: {
  storedTrains: StoredTrain[];
  railwayLines: RailwayLine[];
  setStoredTrains: (storedTrains: StoredTrain[]) => void;
  selectedPlacedTrainId: string | null;
  setSelectedPlacedTrainId: (id: string) => void;
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
          車両情報
        </h2>
        <ListSettingCommonComponent<StoredTrain>
          datas={storedTrains}
          setDatas={(storedTrains) => {
            setStoredTrains([...storedTrains]);
          }}
          selectData={(storedTrain) => {
            setSelectedPlacedTrainId(storedTrain.placedTrainId);
          }}
          getSettingComponent={(storedTrain) => {
            return (
              <div>
                <div>
                  <label>車両名</label>
                  <input
                    type='text'
                    value={storedTrain.placedTrainName}
                    onChange={(e) => {
                      storedTrain.placedTrainName = (e.target as HTMLInputElement).value;
                      setStoredTrains([...storedTrains]);
                    }}
                  />
                </div>
                <div>
                  <label>割り当て路線</label>
                  <select
                    value={storedTrain.placedRailwayLineId ?? 'none'}
                    onChange={(e) => {
                      storedTrain.placedRailwayLineId = (e.target as HTMLSelectElement).value;
                      setStoredTrains([...storedTrains]);
                    }}
                  >
                    <option value='none'>-</option>
                    {railwayLines.map((railwayLine) => (
                      <option value={railwayLine.railwayLineId}>{railwayLine.railwayLineName}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          }}
          getDisplayName={(storedTrain) => {
            return storedTrain.placedTrainName;
          }}
          excludeFromDatas={(storedTrains, storedTrain) => {
            return storedTrains.filter((rl) => rl.placedTrainId !== storedTrain.placedTrainId);
          }}
          getNewData={() => {
            const id = generateId();
            const newName = getNewName(
              storedTrains.map((train) => train.placedTrainName),
              '新しい車両'
            );
            return {
              placedTrainId: id,
              placedTrainName: newName,
              placedRailwayLineId: null,
            };
          }}
        />
      </div>
    </>
  );
}
