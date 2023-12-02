import { FunctionDefinition, fst, getInterpolatedFunctionValue, getRandomElement, lst } from '../../common';
import { CellHeight, GameMap } from '../../mapEditorModel';
import { Point, StationLike } from '../../model';
import { getDistance, getMidPoint } from '../../trackUtil';
import { ConstructType, ExtendedCell, ExtendedCellConstruct, toPixelPosition } from '../extendedMapModel';
import { GlobalTimeManager } from './globalTimeManager';

type MoveProbFunc = { [key in ConstructType]: { [key in ConstructType]: FunctionDefinition } };

const moveProbFuncs: MoveProbFunc = {
  House: {
    House: [
      [0, 0],
      [5, 0],
      [6, 1],
      [7, 3],
      [8, 5],
      [9, 5],
      [10, 5],
      [12, 5],
      [16, 5],
      [19, 5],
      [21, 5],
      [23, 3],
      [24, 0],
    ],
    Shop: [
      [0, 0],
      [5, 0],
      [6, 1],
      [7, 3],
      [8, 5],
      [9, 10],
      [10, 15],
      [12, 15],
      [16, 25],
      [19, 20],
      [21, 5],
      [23, 1],
      [24, 0],
    ],
    Office: [
      [0, 0],
      [5, 0],
      [6, 5],
      [7, 70],
      [8, 100],
      [9, 80],
      [10, 30],
      [12, 10],
      [16, 10],
      [19, 10],
      [21, 5],
      [23, 5],
      [24, 0],
    ],
  },
  Shop: {
    House: [
      [0, 0],
      [5, 0],
      [6, 1],
      [7, 1],
      [8, 1],
      [9, 3],
      [10, 10],
      [12, 15],
      [16, 25],
      [19, 20],
      [21, 15],
      [23, 5],
      [24, 0],
    ],
    Shop: [
      [0, 0],
      [24, 0],
    ],
    Office: [
      [0, 0],
      [24, 0],
    ],
  },
  Office: {
    House: [
      [0, 0],
      [5, 0],
      [6, 5],
      [7, 5],
      [8, 5],
      [9, 5],
      [10, 10],
      [12, 15],
      [16, 20],
      [19, 100],
      [21, 80],
      [23, 20],
      [24, 0],
    ],
    Shop: [
      [0, 0],
      [5, 0],
      [6, 1],
      [7, 3],
      [8, 5],
      [9, 5],
      [10, 5],
      [12, 5],
      [16, 20],
      [19, 20],
      [21, 10],
      [23, 1],
      [24, 0],
    ],
    Office: [
      [0, 0],
      [5, 0],
      [6, 1],
      [7, 1],
      [8, 5],
      [9, 10],
      [10, 15],
      [12, 15],
      [16, 15],
      [19, 10],
      [21, 5],
      [23, 1],
      [24, 0],
    ],
  },
};

interface AgentDestinationProps {
  stations: Map<string, StationLike>;
  extendedMap: ExtendedCell[][];
  gameMap: GameMap;
  globalTimeManager: GlobalTimeManager;
}

function getMoveProbs(fromConstructType: ConstructType, globalTimeManager: GlobalTimeManager) {
  const hour = globalTimeManager.globalTime / 60 / 60;
  const probs = {
    House: getInterpolatedFunctionValue(moveProbFuncs[fromConstructType]['House'], hour),
    Shop: getInterpolatedFunctionValue(moveProbFuncs[fromConstructType]['Shop'], hour),
    Office: getInterpolatedFunctionValue(moveProbFuncs[fromConstructType]['Office'], hour),
  };
  return probs;
}

// ランダムな目的地を決める
// もっとうまくやりたいところ
function getRandomDestination(
  agentPosition: Point,
  props: AgentDestinationProps,
  destinationType: ConstructType
): ExtendedCellConstruct | null {
  const [stationPositions, platforms] = getStationPositions(props.stations, props.gameMap);

  const candidates = getDestinationCandidates(agentPosition, props).filter(
    (cell) => cell.constructType === destinationType
  );
  // 今いる場所に近いか、駅の近くのみ選択可能とする
  const candidates2 = candidates.filter(
    (c) =>
      getDistance(toPixelPosition(c.position), agentPosition) < CellHeight * 5 ||
      (stationPositions.some((s) => getDistance(agentPosition, s.topPosition) < CellHeight * 5) &&
        stationPositions.some((s) => getDistance(toPixelPosition(c.position), s.topPosition) < CellHeight * 5))
  );

  if (candidates2.length === 0) {
    return null;
  }

  return getRandomElement(candidates2);
}

function getDestinationCandidates(agentPosition: Point, props: AgentDestinationProps) {
  const candidates = props.extendedMap.flatMap((row) =>
    row.filter(
      (cell) =>
        cell.type === 'Construct' && getDistance(toPixelPosition(cell.position), agentPosition) > CellHeight * 1.4
    )
  ) as ExtendedCellConstruct[];
  return candidates;
}

export function getAgentDestination(
  cell: ExtendedCellConstruct,
  position: Point,
  props: AgentDestinationProps
): ExtendedCellConstruct | null {
  const probCoefficient = 1000;
  const probs = getMoveProbs(cell.constructType, props.globalTimeManager);
  const r = Math.random();
  let destinationType: ConstructType | null = null;
  if (r < probs.House / probCoefficient) {
    destinationType = 'House';
  }
  if (r < probs.Shop / probCoefficient) {
    destinationType = 'Shop';
  }
  if (r < probs.Office / probCoefficient) {
    destinationType = 'Office';
  }

  if (destinationType === null) return null;

  const destination = getRandomDestination(position, props, destinationType);
  return destination;
}

export function getStationPositions(stations: Map<string, StationLike>, gameMap: GameMap) {
  const platforms = gameMap
    .map((row) =>
      row
        .map((cell) => cell.lineType)
        .filter((lineType) => lineType !== null)
        .map((lineType) => lineType!.tracks)
        .flat()
    )
    .flat()
    .filter((track) => track?.track?.platform != null);
  const stations_ = [...stations.values()].map((station) => {
    // ホームは横向きになっている。その一番上と下のセルを取得する
    const stationPlatforms = platforms.filter((p) => p.track.platform!.stationId === station.stationId);
    stationPlatforms.sort((a, b) => a.begin.y - b.begin.y);
    const topPlatform = fst(stationPlatforms);
    const bottomPlatform = lst(stationPlatforms);
    return {
      station: station,
      top: topPlatform,
      topPosition: getMidPoint(topPlatform.begin, topPlatform.begin),
      bottom: bottomPlatform,
      bottomPosition: getMidPoint(bottomPlatform.begin, bottomPlatform.begin),
    };
  });
  return [stations_, platforms] as const;
}
