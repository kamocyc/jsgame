import { assert, removeNull } from '../../common';
import { CellHeight, CellWidth, ExtendedGameMap, GameMap, RailwayLine, RailwayLineStop } from '../../mapEditorModel';
import { DiaTime, OutlinedTimetable, Point, Station, generateId } from '../../model';
import { abstractSearch, getDistance, getMidPoint } from '../../trackUtil';
import { CellPoint, ExtendedCellConstruct, toCellPosition, toPixelPosition } from '../extendedMapModel';
import { AgentManager2, AgentManager2Props } from './agentManager2';
import { TrainMove } from './trainMove';
import { PlacedTrain } from './trainMoveBase';

export type AgentStatus = 'Idle' | 'Move';

type StationPathStep = {
  /**
   * 次の駅
   */
  nextStation: Station;
  /**
   * 現在の駅の発車時刻などの情報
   */
  diaTime: DiaTime;
};

type StationPath = StationPathStep[];

type AgentPath = (
  | {
      stepType: 'station';
      stationPathStep: StationPathStep;
    }
  | {
      stepType: 'walk';
      direction: 'up' | 'down' | 'left' | 'right';
      destination: CellPoint;
    }
)[];

export interface AgentBase {
  id: string;
  name: string;
  position: Point;
  inDestination: boolean;
  placedTrain: PlacedTrain | null;
  status: AgentStatus;
}

interface Agent {
  id: string;
  name: string;
  position: Point;
  status: AgentStatus;
  destination: ExtendedCellConstruct | null;
  inDestination: boolean;
  path: AgentPath;
  placedTrain: PlacedTrain | null;
}

type NextStationInfo = {
  currentStationDiaTime: DiaTime;
  nextStation: Station;
  nextStationArrivalTime: number;
};

/**
 * 時刻表上での次の駅と、到着時間（探索における距離）を取得する
 * @param currentStation 始点駅
 * @param timetable 時刻表
 * @param currentTime 現在時刻。始点駅の発車時刻はこれ以降である必要がある
 * @returns
 */
export function getAdjacentStations(
  currentStation: Station,
  timetable: OutlinedTimetable,
  currentTime: number
): NextStationInfo[] {
  const nextStations = removeNull(
    timetable.inboundTrains.concat(timetable.outboundTrains).map((train) => {
      const [currentStationDiaTime, nextStationDiaTime] = (() => {
        const i = train.diaTimes.findIndex((diaTime) => diaTime.station.stationId === currentStation.stationId);
        if (i === -1 || i >= train.diaTimes.length - 1) {
          // 駅を通らない or 最後の駅
          return [null, null];
        } else {
          return [train.diaTimes[i], train.diaTimes[i + 1]];
        }
      })();

      // 次の駅が無い
      if (currentStationDiaTime === null || nextStationDiaTime === null) {
        return null;
      }

      const nextStationArrivalTime = nextStationDiaTime.arrivalTime || nextStationDiaTime.departureTime;
      assert(nextStationArrivalTime !== null, 'nextStationArrivalTime is null');

      // 今の駅の発車時刻が過ぎている
      assert(currentStationDiaTime.departureTime !== null, 'currentStationDiaTime is null');
      if (currentStationDiaTime.departureTime < currentTime) {
        return null;
      }

      return {
        currentStationDiaTime,
        nextStation: nextStationDiaTime.station,
        nextStationArrivalTime,
      };
    })
  );

  return nextStations;
}

export function getStationPositions(stations: Station[], gameMap: GameMap) {
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
  const stations_ = stations.map((station) => {
    // ホームは横向きになっている。その一番上と下のセルを取得する
    const stationPlatforms = platforms.filter((p) => p.track.platform!.station.stationId === station.stationId);
    stationPlatforms.sort((a, b) => a.begin.y - b.begin.y);
    const topPlatform = stationPlatforms[0];
    const bottomPlatform = stationPlatforms[stationPlatforms.length - 1];
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

export function getRandomDestination(agent: Agent, extendedMap: ExtendedGameMap): ExtendedCellConstruct {
  const candidates = extendedMap.flatMap((row) =>
    row.filter(
      (cell) =>
        cell.type === 'Construct' && getDistance(toPixelPosition(cell.position), agent.position) > CellHeight * 1.4
    )
  ) as ExtendedCellConstruct[];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function createAgentPath(
  stations: Station[],
  agent: Agent,
  gameMap: GameMap,
  currentTime: number,
  timetable: OutlinedTimetable
): AgentPath {
  // 現在地から最も近い駅を探す
  const [stationPositions, _] = getStationPositions(stations, gameMap);

  function addTopPosition(position: Point): Point {
    return {
      x: position.x,
      y: position.y + CellHeight / 2,
    };
  }

  function addBottomPosition(position: Point): Point {
    return {
      x: position.x,
      y: position.y - CellHeight / 2,
    };
  }

  function getNearestStation(currentPosition: Point) {
    const nearestStation = stationPositions.reduce((a, b) => {
      const aDistanceTop = getDistance(addTopPosition(a.topPosition), currentPosition);
      const aDistanceBottom = getDistance(addBottomPosition(a.bottomPosition), currentPosition);
      const bDistanceTop = getDistance(addTopPosition(b.topPosition), currentPosition);
      const bDistanceBottom = getDistance(addBottomPosition(b.bottomPosition), currentPosition);
      const aDistance = aDistanceTop < aDistanceBottom ? aDistanceTop : aDistanceBottom;
      const bDistance = bDistanceTop < bDistanceBottom ? bDistanceTop : bDistanceBottom;
      return aDistance < bDistance ? a : b;
    });

    return nearestStation;
  }

  const agentCellPosition = toCellPosition(agent.position);
  const agentDestinationCellPosition = agent.destination!.position;
  // console.log({ agent });
  // console.log({ agentCellPosition });
  // console.log({ agentDestinationCellPosition });

  function getWalkOnlyPath() {
    const path: AgentPath = [
      {
        stepType: 'walk',
        direction: agentCellPosition.cx < agentDestinationCellPosition.cx ? 'right' : 'left',
        destination: {
          cx: agentDestinationCellPosition.cx,
          cy: agentCellPosition.cy,
        },
      },
      {
        stepType: 'walk',
        direction: agentCellPosition.cy < agentDestinationCellPosition.cy ? 'down' : 'up',
        destination: {
          cx: agentDestinationCellPosition.cx,
          cy: agentDestinationCellPosition.cy,
        },
      },
    ];

    return path;
  }

  // 徒歩のみの場合
  if (stationPositions.length <= 2) {
    return getWalkOnlyPath();
  }

  const nearestStation = getNearestStation(agent.position);
  const destinationNearestStation = getNearestStation(toPixelPosition(agent.destination!.position));
  const toC = toPixelPosition;

  // 歩いたほうが近い場合は、徒歩のみのパスを返す
  if (
    getDistance(toC(agentCellPosition), toC(agentDestinationCellPosition)) <
      getDistance(toC(agentCellPosition), nearestStation.bottomPosition) ||
    getDistance(toC(agentCellPosition), toC(agentDestinationCellPosition)) <
      getDistance(toC(agentCellPosition), nearestStation.topPosition) ||
    getDistance(toC(agentCellPosition), toC(agentDestinationCellPosition)) <
      getDistance(toC(agentDestinationCellPosition), destinationNearestStation.bottomPosition) ||
    getDistance(toC(agentCellPosition), toC(agentDestinationCellPosition)) <
      getDistance(toC(agentDestinationCellPosition), destinationNearestStation.topPosition)
  ) {
    return getWalkOnlyPath();
  }

  // 横、縦の順で移動する。
  const nearestStationCellPosition = toCellPosition(nearestStation.topPosition);
  const destinationNearestStationCellPosition = toCellPosition(destinationNearestStation.topPosition);
  // console.log({ nearestStation });
  // console.log({ destinationNearestStation });
  // console.log({ nearestStationCellPosition });
  // console.log({ destinationNearestStationCellPosition });

  const stationPath = searchPath(nearestStation.station, currentTime, destinationNearestStation.station, timetable)[1];
  if (stationPath === null) {
    return [];
  }

  const path: AgentPath = [
    {
      stepType: 'walk',
      direction: agentCellPosition.cx < nearestStationCellPosition.cx ? 'right' : 'left',
      destination: {
        cx: nearestStationCellPosition.cx,
        cy: agentCellPosition.cy,
      },
    },
    {
      stepType: 'walk',
      direction: agentCellPosition.cy < nearestStationCellPosition.cy ? 'down' : 'up',
      destination: {
        cx: nearestStationCellPosition.cx,
        cy: nearestStationCellPosition.cy,
      },
    },
    ...stationPath.map((stationPathStep) => ({
      stepType: 'station' as const,
      stationPathStep,
    })),
    {
      stepType: 'walk',
      direction: destinationNearestStationCellPosition.cy < agentDestinationCellPosition.cy ? 'up' : 'down',
      destination: {
        cx: destinationNearestStationCellPosition.cx,
        cy: agentDestinationCellPosition.cy,
      },
    },
    {
      stepType: 'walk',
      direction: destinationNearestStationCellPosition.cx < agentDestinationCellPosition.cx ? 'left' : 'right',
      destination: {
        cx: agentDestinationCellPosition.cx,
        cy: agentDestinationCellPosition.cy,
      },
    },
  ];

  return path;
}

type StationAndRailwayLine = {
  station: Station;
  railwayLine: RailwayLine;
  stop: RailwayLineStop;
};

function getAdjacentStations2(sr: StationAndRailwayLine, railwayLines: RailwayLine[]): StationAndRailwayLine[] {
  const candidates: StationAndRailwayLine[] = [];

  // 1. 現在の路線の次の駅を取得
  const stopIndex = sr.railwayLine.stops.findIndex((s) => s.stopId === sr.stop.stopId);
  if (stopIndex === -1) {
    throw new Error('stopIndex is -1');
  }
  const nextStopIndex = stopIndex === sr.railwayLine.stops.length - 1 ? 0 : stopIndex + 1;
  const nextStop = sr.railwayLine.stops[nextStopIndex];
  const nextStation = nextStop.platform.station;
  candidates.push({
    station: nextStation,
    railwayLine: sr.railwayLine,
    stop: nextStop,
  });

  // 2. 現在の駅の別の路線の駅を取得
  const otherRailwayLineStops = railwayLines
    .filter((r) => r.railwayLineId !== sr.railwayLine.railwayLineId)
    .map((r) => r.stops.map((s) => [r, s] as const))
    .flat()
    .filter(([_, s]) => s.platform.station.stationId === sr.station.stationId);
  candidates.push(
    ...otherRailwayLineStops.map(([r, s]) => ({
      station: sr.station,
      railwayLine: r,
      stop: s,
    }))
  );

  return candidates;
}

function getDistanceBetweenStation2(sr1: StationAndRailwayLine, sr2: StationAndRailwayLine): number {
  if (sr1.railwayLine.railwayLineId === sr2.railwayLine.railwayLineId) {
    if (sr1.stop.platformPaths === null) {
      throw new Error('sr1.stop.platformPaths === null');
    }
    // 同じ路線の場合 => pathの長さを利用
    let length = 0;
    for (const path of sr1.stop.platformPaths) {
      if (
        path.track.platform?.station.stationId !== sr1.station.stationId &&
        path.track.platform?.station.stationId !== sr2.station.stationId
      ) {
        length += getDistance(path.begin, path.end);
      }
      return length;
    }
  }

  // 異なる路線の場合 => 同じ駅であるはず
  if (sr1.station.stationId !== sr2.station.stationId) {
    throw new Error('sr1.station.stationId !== sr2.station.stationId');
  }

  // 乗り換え時間として適当な固定値を返す
  return 5;
}

export function searchPath2(
  initialPosition: Station,
  destination: Station,
  railwayLine: RailwayLine,
  stop: RailwayLineStop,
  railwayLines: RailwayLine[]
) {
  return abstractSearch<StationAndRailwayLine>(
    {
      station: initialPosition,
      railwayLine: railwayLine,
      stop: stop,
    },
    (sr) => sr.station.stationId + '__' + sr.railwayLine.railwayLineId + '__' + sr.stop.stopId,
    (sr) => getAdjacentStations2(sr, railwayLines),
    (sr1, sr2) => getDistanceBetweenStation2(sr1, sr2),
    (sr) => sr.station.stationId === destination.stationId
  );
}

// 時刻表を元にしてダイクストラ法で探索する
export function searchPath(
  initialPosition: Station,
  startTime: number,
  destination: Station,
  timetable: OutlinedTimetable
): readonly [readonly [Station, number][], StationPath | null] {
  const previous: { [key: string]: [Station, DiaTime] } = {};

  // 駅ノードの初期化（未確定のノードのみ）
  let stationNodes = timetable.stations.map((station) => ({
    station: station,
    distance: station.stationId === initialPosition.stationId ? startTime : Number.MAX_SAFE_INTEGER,
  }));

  const determinedIds = new Map<string, [Station, number]>();
  let currentTime = startTime;

  while (stationNodes.length > 0) {
    // 時間が一番少ない（最小距離が最小）の駅（ノード）の距離を確定する
    const nextDetermineNode = stationNodes.reduce((a, b) => (a.distance < b.distance ? a : b));
    determinedIds.set(nextDetermineNode.station.stationId, [nextDetermineNode.station, nextDetermineNode.distance]);
    currentTime = nextDetermineNode.distance;
    stationNodes = stationNodes.filter((node) => node.station.stationId !== nextDetermineNode.station.stationId);

    const adjacentStations = getAdjacentStations(nextDetermineNode.station, timetable, currentTime).filter(
      (node_) => !determinedIds.has(node_.nextStation.stationId)
    );

    for (const adjacentStation of adjacentStations) {
      const newDistance = adjacentStation.nextStationArrivalTime;
      const adjacentStationNode = stationNodes.find(
        (node) => node.station.stationId === adjacentStation.nextStation.stationId
      );
      assert(adjacentStationNode !== undefined, 'adjacentStationNode is undefined');
      if (newDistance < adjacentStationNode.distance) {
        adjacentStationNode.distance = newDistance;
        previous[adjacentStationNode.station.stationId] = [
          nextDetermineNode.station,
          adjacentStation.currentStationDiaTime,
        ];
      }
    }
  }

  const path: StationPath = [];
  let currentNode = destination;
  while (currentNode !== initialPosition) {
    const previousNode = previous[currentNode.stationId];
    if (previousNode === undefined) {
      return [[...determinedIds.values()], null] as const;
    }
    path.unshift({
      nextStation: currentNode,
      diaTime: previousNode[1],
    });
    currentNode = previousNode[0];
  }

  return [[...determinedIds.values()], path] as const;
}

function toPoint(cellPoint: CellPoint): Point {
  return {
    x: cellPoint.cx * CellWidth,
    y: cellPoint.cy * CellHeight,
  };
}

export interface AgentManagerProps {
  extendedMap: ExtendedGameMap;
  stations: Station[];
  gameMap: GameMap;
  timetable: OutlinedTimetable;
  trainMove: TrainMove;
  currentTime: number;
}

export type AgentManagerCommonProps = AgentManagerProps & AgentManager2Props;

export interface AgentManagerBase {
  clear(): void;
  add(position: Point): void;
  remove(agentId: string): void;
  tick(props: AgentManagerCommonProps): void;
  getAgents(): AgentBase[];
}

export function createAgentManager(): AgentManagerBase {
  if (true) {
    return new AgentManager2();
  } else {
    return new AgentManager();
  }
}

// 時刻表ベースの実装
export class AgentManager implements AgentManagerBase {
  agents: Agent[];

  constructor() {
    this.agents = [];
  }
  clear() {
    this.agents = [];
  }
  getAgents() {
    return this.agents;
  }

  add(position: Point) {
    const id = generateId();
    this.agents.push({
      id: 'agent-' + id,
      name: 'Agent ' + id,
      position: { ...position },
      status: 'Idle',
      destination: null,
      inDestination: false,
      path: [],
      placedTrain: null,
    });
  }

  remove(agentId: string) {
    this.agents = this.agents.filter((a) => a.id !== agentId);
  }

  private actAgent(agent: Agent, props: AgentManagerProps) {
    if (agent.status === 'Idle') {
      // ランダムに目的地を決める
      if (Math.random() < 0.1) {
        const destination = getRandomDestination(agent, props.extendedMap);
        if (destination) {
          agent.destination = destination;
          agent.inDestination = false;
          agent.status = 'Move';
          agent.path = createAgentPath(props.stations, agent, props.gameMap, props.currentTime, props.timetable);
        }
      }
    } else if (agent.status === 'Move') {
      assert(agent.destination !== null, 'agent.destination is null');

      if (agent.path.length === 0) {
        // 目的地に到着したら
        agent.destination = null;
        agent.inDestination = true;
        agent.status = 'Idle';
        return;
      }

      const step = agent.path[0];
      if (step.stepType === 'station') {
        // 駅に到着している
        if (agent.placedTrain === null) {
          const diaTime = step.stationPathStep.diaTime;
          assert(diaTime.departureTime !== null, 'diaTime.departureTime is null');
          if (props.currentTime >= diaTime.departureTime) {
            // 時刻表の時間を過ぎたら、対応するtrainを探す
            // diaTime -> Train -> operations.train
            const train = props.timetable.inboundTrains
              .concat(props.timetable.outboundTrains)
              .find((train) => train.diaTimes.some((dt) => dt.diaTimeId === diaTime.diaTimeId));
            assert(train !== undefined, 'train is undefined');
            const placedTrain = props.trainMove.getPlacedTrains().find((t) => t.train?.trainId === train.trainId);
            if (placedTrain === undefined) {
              console.error('placedTrain is undefined');
              return;
            }
            assert(placedTrain !== undefined, 'placedTrain is undefined');

            agent.placedTrain = placedTrain;
          }
        }

        // 電車に乗っている途中
        if (agent.placedTrain !== null) {
          agent.position = { ...agent.placedTrain.position };

          // 電車から降りる
          if (
            agent.placedTrain.stationStatus === 'Arrived' &&
            agent.placedTrain.track.track.platform?.station.stationId === step.stationPathStep.nextStation.stationId
          ) {
            agent.placedTrain = null;
            agent.path.shift();
          }
        }
      } else if (step.stepType === 'walk') {
        // 歩いている途中
        const destination = toPoint(step.destination);
        const dx = destination.x - agent.position.x;
        const dy = destination.y - agent.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 5) {
          agent.position = destination;
          agent.path.shift();

          // 駅にちょうど到着した
          if (
            agent.path.length > 0 &&
            agent.path[0].stepType === 'station' &&
            props.currentTime >= (agent.path[0].stationPathStep.diaTime.departureTime ?? 0)
          ) {
            console.error('時間が過ぎている');
            console.log({ agent });
          }
        } else {
          agent.position = {
            x: agent.position.x + (dx / distance) * 5,
            y: agent.position.y + (dy / distance) * 5,
          };
        }
      }
    }
  }

  tick(props: AgentManagerProps) {
    for (const agent of this.agents) {
      this.actAgent(agent, props);
    }
  }
}
