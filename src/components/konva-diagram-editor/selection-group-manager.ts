import { DeepReadonly } from 'ts-essentials';
import { nn } from '../../common';
import { StationLike } from '../../model';
import { ViewState } from './konva-util';
import { getPlatformPositions } from './station-view-konva';

export function getPlatformUnderCursor(
  y: number,
  stationMap: DeepReadonly<Map<string, StationLike>>,
  viewState: DeepReadonly<ViewState>
) {
  const stationPositions = viewState.stationPositions;
  const stationLineWidth = 16;
  const foundStations = stationPositions.map((stationPosition) => {
    const station = nn(stationMap.get(stationPosition.stationId));
    const isPlatformExpanded = viewState.isStationExpanded.get(stationPosition.stationId) ?? false;
    const stationY = stationPosition.diagramPosition;

    if (isPlatformExpanded) {
      // プラットフォーム
      if (stationY < y) {
        const [platformPositions, _] = getPlatformPositions(station.platforms);

        const platformPositionIndex = platformPositions.findIndex((platformPosition, i) => {
          const platformY = stationPosition.diagramPosition + platformPosition;
          const platformYStart = platformY - stationLineWidth / 2;
          const platformYEnd = platformY + stationLineWidth / 2;
          return platformYStart <= y && y <= platformYEnd;
        });
        if (platformPositionIndex !== -1) {
          return { platform: station.platforms[platformPositionIndex], station: null };
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      // 駅
      const stationYStart = stationY - stationLineWidth / 2;
      const stationYEnd = stationY + stationLineWidth / 2;
      if (stationYStart <= y && y <= stationYEnd) {
        return { platform: null, station: stationPosition };
      } else {
        return null;
      }
    }
  });
  const foundStations_ = foundStations.filter((s) => s !== null);
  if (foundStations_.length === 0) {
    return null;
  }

  return foundStations_[0];
}
