import { CountBag, assert, removeNull } from '../../common';
import { CellHeight, CellWidth, ExtendedGameMap, GameMap, RailwayLine, RailwayLineStop } from '../../mapEditorModel';
import { DiaTime, Point, Station, StationLike, generateId } from '../../model';
import { OutlinedTimetableData } from '../../outlinedTimetableData';
import { abstractSearch, getDistance } from '../../trackUtil';
import { CellPoint, ExtendedCellConstruct, toCellPosition, toPixelPosition } from '../extendedMapModel';
import { getAgentDestination, getStationPositions } from './agentDestination';
import { AgentManager2Props, AgentManagerNoTimetable } from './agentManagerNoTimetable';
import { GlobalTimeManager } from './globalTimeManager';
import { MoneyManager } from './moneyManager';
import { PlacedTrain } from './trainMoveBase';

export type AgentStatus = 'Idle' | 'Move';

type StationPathStep = {
  /**
   * 次の駅
   */
  nextStation: StationLike;
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
  nextStationId: string;
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
  currentStation: StationLike,
  timetableData: OutlinedTimetableData,
  currentTime: number
): NextStationInfo[] {
  const nextStations = removeNull(
    [...timetableData._trains.values()].map((train) => {
      const [currentStationDiaTime, nextStationDiaTime] = (() => {
        const i = train.diaTimes.findIndex((diaTime) => diaTime.stationId === currentStation.stationId);
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
        nextStationId: nextStationDiaTime.stationId,
        nextStationArrivalTime,
      };
    })
  );

  return nextStations;
}

export function createAgentPath(
  stations: StationLike[],
  agent: Agent,
  gameMap: GameMap,
  currentTime: number,
  timetableData: OutlinedTimetableData
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

  const stationPath = searchPath(
    nearestStation.station,
    currentTime,
    destinationNearestStation.station,
    timetableData
  )[1];
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
  stationId: string;
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
  const nextStationId = nextStop.platform.stationId;
  candidates.push({
    stationId: nextStationId,
    railwayLine: sr.railwayLine,
    stop: nextStop,
  });

  // 2. 現在の駅の別の路線の駅を取得
  const otherRailwayLineStops = railwayLines
    .filter((r) => r.railwayLineId !== sr.railwayLine.railwayLineId)
    .map((r) => r.stops.map((s) => [r, s] as const))
    .flat()
    .filter(([_, s]) => s.platform.stationId === sr.stationId);
  candidates.push(
    ...otherRailwayLineStops.map(([r, s]) => ({
      stationId: sr.stationId,
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
      if (path.track.platform?.stationId !== sr1.stationId && path.track.platform?.stationId !== sr2.stationId) {
        length += getDistance(path.begin, path.end);
      }
      return length;
    }
  }

  // 異なる路線の場合 => 同じ駅であるはず
  if (sr1.stationId !== sr2.stationId) {
    throw new Error('sr1.station.stationId !== sr2.station.stationId');
  }

  // 乗り換え時間として適当な固定値を返す
  return 5;
}

export function searchPath2(
  initialPositionId: string,
  destination: Station,
  railwayLine: RailwayLine,
  stop: RailwayLineStop,
  railwayLines: RailwayLine[]
) {
  return abstractSearch<StationAndRailwayLine>(
    {
      stationId: initialPositionId,
      railwayLine: railwayLine,
      stop: stop,
    },
    (sr) => sr.stationId + '__' + sr.railwayLine.railwayLineId + '__' + sr.stop.stopId,
    (sr) => getAdjacentStations2(sr, railwayLines),
    (sr1, sr2) => getDistanceBetweenStation2(sr1, sr2),
    (sr) => sr.stationId === destination.stationId
  );
}

// 時刻表を元にしてダイクストラ法で探索する
export function searchPath(
  initialPosition: StationLike,
  startTime: number,
  destination: StationLike,
  timetableData: OutlinedTimetableData
): readonly [readonly [StationLike, number][], StationPath | null] {
  const previous: { [key: string]: [StationLike, DiaTime] } = {};

  const stations = timetableData._stations;
  // 駅ノードの初期化（未確定のノードのみ）
  let stationNodes = stations.map((station) => ({
    station: station,
    distance: station.stationId === initialPosition.stationId ? startTime : Number.MAX_SAFE_INTEGER,
  }));

  const determinedIds = new Map<string, [StationLike, number]>();
  let currentTime = startTime;

  while (stationNodes.length > 0) {
    // 時間が一番少ない（最小距離が最小）の駅（ノード）の距離を確定する
    const nextDetermineNode = stationNodes.reduce((a, b) => (a.distance < b.distance ? a : b));
    determinedIds.set(nextDetermineNode.station.stationId, [nextDetermineNode.station, nextDetermineNode.distance]);
    currentTime = nextDetermineNode.distance;
    stationNodes = stationNodes.filter((node) => node.station.stationId !== nextDetermineNode.station.stationId);

    const adjacentStations = getAdjacentStations(nextDetermineNode.station, timetableData, currentTime).filter(
      (node_) => !determinedIds.has(node_.nextStationId)
    );

    for (const adjacentStation of adjacentStations) {
      const newDistance = adjacentStation.nextStationArrivalTime;
      const adjacentStationNode = stationNodes.find((node) => node.station.stationId === adjacentStation.nextStationId);
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
  stations: StationLike[];
  gameMap: GameMap;
  outlinedTimetableData: OutlinedTimetableData;
  placedTrains: PlacedTrain[];
  moneyManager: MoneyManager;
  globalTimeManager: GlobalTimeManager;
}

export type AgentManagerCommonProps = AgentManagerProps & AgentManager2Props;

export interface AgentManagerBase {
  agentManagerType: 'AgentManager' | 'AgentManager2';
  addAgentsRandomly(position: Point, cell: ExtendedCellConstruct, props: AgentManagerCommonProps): boolean;
  clear(): void;
  // add(position: Point, props: AgentManagerCommonProps): void;
  remove(agentId: string): void;
  tick(props: AgentManagerCommonProps): void;
  getAgents(): AgentBase[];
  getNumberOfAgentsInPlatform(): CountBag;
}

export function createAgentManager(): AgentManagerBase {
  if (false) {
    return new AgentManagerNoTimetable();
  } else {
    return new AgentManager();
  }
}

// 時刻表ベースの実装
export class AgentManager implements AgentManagerBase {
  readonly agentMax = 30;
  agents: Agent[];
  readonly agentManagerType = 'AgentManager';

  constructor() {
    this.agents = [];
  }
  clear() {
    this.agents = [];
  }
  getAgents() {
    return this.agents;
  }

  addAgentsRandomly(position: Point, cell: ExtendedCellConstruct, props: AgentManagerProps): boolean {
    if (this.agents.length >= this.agentMax) return false;

    const destination = getAgentDestination(cell, position, props);
    if (destination) {
      const agent = this.createRawAgent(position);
      agent.destination = destination;
      agent.inDestination = false;
      agent.status = 'Move';
      agent.path = createAgentPath(
        props.stations,
        agent,
        props.gameMap,
        props.globalTimeManager.globalTime,
        props.outlinedTimetableData
      );
      this.agents.push(agent);
      return true;
    } else {
      return false;
    }
  }

  private createRawAgent(position: Point) {
    const id = generateId();
    const agent: Agent = {
      id: 'agent-' + id,
      name: 'Agent ' + id,
      position: { ...position },
      status: 'Idle',
      destination: null,
      inDestination: false,
      path: [],
      placedTrain: null,
    };
    return agent;
  }

  getNumberOfAgentsInPlatform(): CountBag {
    const counts = new CountBag();
    for (const agent of this.agents) {
      if (agent.status !== 'Move') continue;
      if (agent.path.length === 0) continue;
      if (agent.path[0].stepType !== 'station') continue;
      if (agent.placedTrain !== null) continue;
      const platformId = agent.path[0].stationPathStep.diaTime.platformId;
      assert(platformId != null, 'platformId != null');
      counts.add([platformId]);
    }

    return counts;
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
    // if (agent.status === 'Idle') {
    //   // ランダムに目的地を決める
    //   if (Math.random() < 0.1) {
    //     const destination = getRandomDestination(agent, props.extendedMap);
    //     if (destination) {
    //       agent.destination = destination;
    //       agent.inDestination = false;
    //       agent.status = 'Move';
    //       agent.path = createAgentPath(
    //         props.stations,
    //         agent,
    //         props.gameMap,
    //         props.globalTimeManager.globalTime,
    //         props.timetableData
    //       );
    //     }
    //   }
    // } else
    if (agent.status === 'Move') {
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
          if (props.globalTimeManager.globalTime >= diaTime.departureTime) {
            // 時刻表の時間になった（過ぎた）ら、対応するtrainを探して。乗る
            // diaTime -> Train -> operations.train
            const train = [...props.outlinedTimetableData._trains.values()].find((train) =>
              train.diaTimes.some((dt) => dt.diaTimeId === diaTime.diaTimeId)
            );
            assert(train !== undefined, 'train is undefined');
            const placedTrain = props.placedTrains.find((t) => t.train?.trainId === train.trainId);
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
            agent.placedTrain.track.track.platform?.stationId === step.stationPathStep.nextStation.stationId
          ) {
            agent.placedTrain = null;

            // 距離に応じた運賃を払う
            // const startPosition = step.stationPathStep;
            // const distance = getDistance(startPosition, agent.position);
            // props.moneyManager.addMoney(Math.round((distance / CellHeight) * 200));

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
            props.globalTimeManager.globalTime >= (agent.path[0].stationPathStep.diaTime.departureTime ?? 0)
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
