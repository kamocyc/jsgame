import { DeepReadonly } from 'ts-essentials';
import { nn } from '../../common';
import { PlatformLike, StationLike } from '../../model';
import { ViewState } from './konva-util';
import { getPlatformPositions } from './station-view-konva';

export function getPlatformUnderCursor(
  y: number,
  stationMap: DeepReadonly<Map<string, StationLike>>,
  viewState: DeepReadonly<ViewState>
): { platform: DeepReadonly<PlatformLike>; stationId: null } | { platform: null; stationId: string } | null {
  const stationPositions = viewState.stationPositions;

  const stationLineWidth = 32;
  const platformLineWidth = 16;

  const foundStations = stationPositions.map((stationPosition) => {
    const station = nn(stationMap.get(stationPosition.stationId));
    const isPlatformExpanded = viewState.isStationExpanded.get(stationPosition.stationId) ?? false;
    const stationY = stationPosition.diagramPosition;

    const getStation = () => {
      // 駅
      const stationYStart = stationY - stationLineWidth / 2;
      const stationYEnd = stationY + stationLineWidth / 2;
      if (stationYStart <= y && y <= stationYEnd) {
        return { platform: null, stationId: stationPosition.stationId };
      } else {
        return null;
      }
    };

    if (isPlatformExpanded) {
      // プラットフォーム
      if (stationY < y) {
        const [platformPositions, _] = getPlatformPositions(station.platforms);

        const platformPositionIndex = platformPositions.findIndex((platformPosition, i) => {
          const platformY = stationPosition.diagramPosition + platformPosition;
          const platformYStart = platformY - platformLineWidth / 2;
          const platformYEnd = platformY + platformLineWidth / 2;
          return platformYStart <= y && y <= platformYEnd;
        });
        if (platformPositionIndex !== -1) {
          return { platform: station.platforms[platformPositionIndex], stationId: null };
        } else {
          return getStation();
        }
      } else {
        return getStation();
      }
    } else {
      return getStation();
    }
  });
  const foundStations_ = foundStations.filter((s) => s !== null);
  if (foundStations_.length === 0) {
    return null;
  }

  return foundStations_[0];
}
