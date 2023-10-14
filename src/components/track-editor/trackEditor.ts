import { assert, deepEqual } from '../../common';
import {
  AppStates,
  BranchType,
  Cell,
  CellHeight,
  CellWidth,
  CurveType,
  ExtendedGameMap,
  GameMap,
  LineAngle,
  LineDirection,
  LineTypeBranch,
  LineTypeCurve,
  LineTypeStraight,
  LineTypeTerminal,
  addVector,
  timesVector,
} from '../../mapEditorModel';
import { StationLike, Switch, Track } from '../../model';
import { createNewTrack, getRadian, validateSwitch } from '../../trackUtil';

type CreateLineError = { error: string };

function getDirectionFromAngle(angle: LineAngle): LineDirection {
  switch (angle) {
    case 0:
    case 180:
      return 'Horizontal';
    case 90:
    case 270:
      return 'Vertical';
    case 45:
    case 225:
      return 'BottomTop';
    case 135:
    case 315:
      return 'TopBottom';
  }
}

function getCurveTypeFromAngles(angle1: LineAngle, angle2: LineAngle): CurveType | undefined {
  if (angle1 > angle2) {
    return getCurveTypeFromAngles(angle2, angle1);
  }

  if (angle1 === 0 && angle2 === 135) {
    return 'Right_TopLeft';
  } else if (angle1 === 0 && angle2 === 225) {
    return 'Right_BottomLeft';
  } else if (angle1 === 90 && angle2 === 225) {
    return 'Top_BottomLeft';
  } else if (angle1 === 90 && angle2 === 315) {
    return 'Top_BottomRight';
  } else if (angle1 === 45 && angle2 === 180) {
    return 'Left_TopRight';
  } else if (angle1 === 180 && angle2 === 315) {
    return 'Left_BottomRight';
  } else if (angle1 === 45 && angle2 === 270) {
    return 'Bottom_TopRight';
  } else if (angle1 === 135 && angle2 === 270) {
    return 'Bottom_TopLeft';
  }

  return undefined;
}

// BranchTypeと、分岐元の線路(prevTrack)は左右のどちらかであるかを返す
function getBranchTypeFromDirectionAndAngle(
  straightType: LineDirection,
  angle: LineAngle
): [BranchType, 'Left' | 'Right' | 'Top' | 'Bottom'] | undefined {
  switch (straightType) {
    case 'Horizontal':
      if (angle === 45) {
        return ['Horizontal_TopRight', 'Left'];
      } else if (angle === 135) {
        return ['Horizontal_TopLeft', 'Right'];
      } else if (angle === 225) {
        return ['Horizontal_BottomLeft', 'Right'];
      } else if (angle === 315) {
        return ['Horizontal_BottomRight', 'Left'];
      }
      break;
    case 'Vertical':
      if (angle === 45) {
        return ['Vertical_TopRight', 'Bottom'];
      } else if (angle === 135) {
        return ['Vertical_TopLeft', 'Bottom'];
      } else if (angle === 225) {
        return ['Vertical_BottomLeft', 'Top'];
      } else if (angle === 315) {
        return ['Vertical_BottomRight', 'Top'];
      }
      break;
    case 'TopBottom':
      if (angle === 0) {
        return ['TopBottom_Right', 'Left'];
      } else if (angle === 90) {
        return ['TopBottom_Top', 'Right'];
      } else if (angle === 180) {
        return ['TopBottom_Left', 'Right'];
      } else if (angle === 270) {
        return ['TopBottom_Bottom', 'Left'];
      }
      break;
    case 'BottomTop':
      if (angle === 0) {
        return ['BottomTop_Right', 'Left'];
      } else if (angle === 90) {
        return ['BottomTop_Top', 'Left'];
      } else if (angle === 180) {
        return ['BottomTop_Left', 'Right'];
      } else if (angle === 270) {
        return ['BottomTop_Bottom', 'Right'];
      }
      break;
  }
}

function getBranchTypeFromCurveTypeAndAngle(
  curveType: CurveType,
  angle: LineAngle
): [BranchType, 'Left' | 'Right' | 'Top' | 'Bottom'] | undefined {
  switch (curveType) {
    case 'Bottom_TopLeft':
      if (angle === 90) {
        return ['Vertical_TopLeft', 'Bottom'];
      } else if (angle === 315) {
        return ['TopBottom_Bottom', 'Left'];
      } else {
        return undefined;
      }
    case 'Bottom_TopRight':
      if (angle === 90) {
        return ['Vertical_TopRight', 'Bottom'];
      } else if (angle === 225) {
        return ['BottomTop_Bottom', 'Right'];
      } else {
        return undefined;
      }
    case 'Top_BottomLeft':
      if (angle === 45) {
        return ['BottomTop_Top', 'Left'];
      } else if (angle === 270) {
        return ['Vertical_BottomLeft', 'Top'];
      } else {
        return undefined;
      }
    case 'Top_BottomRight':
      if (angle === 135) {
        return ['TopBottom_Top', 'Right'];
      } else if (angle === 270) {
        return ['Vertical_BottomRight', 'Top'];
      } else {
        return undefined;
      }
    case 'Left_TopRight':
      if (angle === 0) {
        return ['Horizontal_TopRight', 'Left'];
      } else if (angle === 225) {
        return ['BottomTop_Left', 'Right'];
      } else {
        return undefined;
      }
    case 'Left_BottomRight':
      if (angle === 0) {
        return ['Horizontal_BottomRight', 'Left'];
      } else if (angle === 135) {
        return ['TopBottom_Left', 'Right'];
      } else {
        return undefined;
      }
    case 'Right_TopLeft':
      if (angle === 180) {
        return ['Horizontal_TopLeft', 'Right'];
      } else if (angle === 315) {
        return ['TopBottom_Right', 'Left'];
      } else {
        return undefined;
      }
    case 'Right_BottomLeft':
      if (angle === 180) {
        return ['Horizontal_BottomLeft', 'Right'];
      } else if (angle === 45) {
        return ['BottomTop_Right', 'Left'];
      } else {
        return undefined;
      }
    default:
      return undefined;
  }
}

function getAdjacentTrackAndNewCellBase(cell1: Cell, angle: LineAngle): [Track[], Cell] | { error: string } {
  function getLeftOrRightTrack(branchType: 'Left' | 'Right' | 'Top' | 'Bottom', track1: Track, track2: Track) {
    switch (branchType) {
      case 'Left':
        // tracks.tracksのうち、xが小さい方を選ぶ
        if (track1.begin.x < track2.begin.x || track1.end.x < track2.end.x) {
          return track1;
        }
        return track2;
      case 'Right':
        if (track1.begin.x > track2.begin.x || track1.end.x > track2.end.x) {
          return track1;
        }
        return track2;
      case 'Top':
        if (track1.begin.y > track2.begin.y || track1.end.y > track2.end.y) {
          return track1;
        }
        return track2;
      case 'Bottom':
        if (track1.begin.y < track2.begin.y || track1.end.y < track2.end.y) {
          return track1;
        }
        return track2;
    }
  }

  // Cellっぽいが、まだlineTypeが決まっていない。
  const newCell1 = {
    position: cell1.position,
    lineType: null as any,
  };
  if (cell1.lineType === null) {
    newCell1.lineType = {
      lineClass: 'Terminal',
      angle: angle, // TODO: 始点だった場合は反転する
      tracks: [],
    };
    return [[], newCell1];
  } else if (cell1.lineType.lineClass === 'Terminal') {
    if (cell1.lineType.angle === (angle + 180) % 360) {
      // 同じ方向の延長
      assert(cell1.lineType.tracks.length === 1);
      const prevTrack = cell1.lineType.tracks[0];
      newCell1.lineType = {
        lineClass: 'Straight',
        straightType: getDirectionFromAngle(cell1.lineType.angle),
        tracks: [prevTrack],
      };
      return [[prevTrack], newCell1];
    } else {
      // カーブ
      const curveType = getCurveTypeFromAngles(cell1.lineType.angle, angle);
      if (curveType === undefined) {
        return { error: 'カーブ元の線路との角度が不正' };
      }
      assert(cell1.lineType.tracks.length === 1);
      const prevTrack = cell1.lineType.tracks[0];
      newCell1.lineType = {
        lineClass: 'Curve',
        curveType: curveType,
        tracks: [prevTrack],
      };
      return [[prevTrack], newCell1];
    }
  } else if (cell1.lineType.lineClass === 'Straight') {
    assert(cell1.lineType.tracks.length === 2);
    const result = getBranchTypeFromDirectionAndAngle(cell1.lineType.straightType, angle);
    if (result === undefined) {
      return { error: '分岐元の線路との角度が不正' };
    }
    const [straightType, branchType] = result;
    const prevTrack = getLeftOrRightTrack(branchType, cell1.lineType.tracks[0], cell1.lineType.tracks[1]);

    newCell1.lineType = {
      lineClass: 'Branch',
      branchType: straightType,
      tracks: [...cell1.lineType.tracks],
    };
    return [[prevTrack], newCell1];
  } else if (cell1.lineType.lineClass === 'Curve') {
    assert(cell1.lineType.tracks.length === 2);
    const result = getBranchTypeFromCurveTypeAndAngle(cell1.lineType.curveType, angle);
    if (result === undefined) {
      return { error: '分岐元の線路との角度が不正（curve）' };
    }
    const [curveType, branchType] = result;
    const prevTrack = getLeftOrRightTrack(branchType, cell1.lineType.tracks[0], cell1.lineType.tracks[1]);

    newCell1.lineType = {
      lineClass: 'Branch',
      branchType: curveType,
      tracks: [...cell1.lineType.tracks],
    };
    return [[prevTrack], newCell1];
  }

  return { error: '未対応の線路' };
}

// 定位のパターンのインデックスを返す
function getStraightPatternIndex(Switch: Switch): [number, number] {
  // 一直線に近いもの2つを定位とする
  const sortedPatterns = Switch.switchPatterns
    .map(([track1, track2], i) => [Math.abs(Math.PI - Math.abs(getRadian(track1, track2))), i] as const)
    .sort((a, b) => a[0] - b[0]);

  console.log({ sortedPatterns, switchPatterns: Switch.switchPatterns });

  return [sortedPatterns[0][1], sortedPatterns[1][1]];
}

// 破壊的変更はしない
// 返すtracksは、順方向のtrack, 逆方向のtrackの順で、複数セルをまとめて作った場合はその配列
function createTrackOnAdjacentCells(
  cell1: Cell,
  cell2: Cell,
  angle: LineAngle
): [[Cell, Cell], [Track, Track], Switch[]] | { error: string } {
  const result_ = getAdjacentTrackAndNewCellBase(cell1, angle);
  if ('error' in result_) {
    return { error: '始点: ' + result_.error };
  }
  const [prevTracks, newCell1] = result_;

  const result__ = getAdjacentTrackAndNewCellBase(cell2, ((angle + 180) % 360) as LineAngle);
  if ('error' in result__) {
    return { error: '終点: ' + result__.error };
  }
  const [nextTracks, newCell2] = result__;

  const _begin = addVector(timesVector(cell1.position, CellWidth), {
    x: CellWidth / 2,
    y: CellHeight / 2,
  });
  const _end = addVector(timesVector(cell2.position, CellWidth), {
    x: CellWidth / 2,
    y: CellHeight / 2,
  });

  // そのセルで終端となるtrackをtracksに設定する
  const [newTrack1, newTrack2, newSwitches] = createNewTrack(
    _begin,
    _end,
    nextTracks.map((t) => t.reverseTrack),
    prevTracks
  );
  const beginTrack = deepEqual(newTrack1.end, _begin) ? newTrack1 : newTrack2;
  const endTrack = deepEqual(newTrack1.end, _begin) ? newTrack2 : newTrack1;

  if (beginTrack.nextSwitch.switchPatterns.length >= 2) {
    beginTrack.nextSwitch.straightPatternIndex = getStraightPatternIndex(beginTrack.nextSwitch);
  }
  if (endTrack.nextSwitch.switchPatterns.length >= 2) {
    endTrack.nextSwitch.straightPatternIndex = getStraightPatternIndex(endTrack.nextSwitch);
  }

  // セルのtracksは、そのセルに**入る**trackを設定する（次のtrackを設定しやすくするため。）。reverseTrackはtracksには設定しない。
  newCell1.lineType!.tracks.push(beginTrack);
  newCell1.lineType!.switch = beginTrack.nextSwitch;
  newCell2.lineType!.tracks.push(endTrack);
  newCell2.lineType!.switch = endTrack.nextSwitch;

  return [[newCell1, newCell2], [newTrack1, newTrack2], newSwitches];
}

function getAngleBetweenCells(cell1: Cell, cell2: Cell): LineAngle | 'Error' {
  if (cell1.position.x === cell2.position.x) {
    if (cell1.position.y < cell2.position.y) {
      return 90;
    } else {
      // cell1.position.y > cell2.position.y
      return 270;
    }
  } else if (cell1.position.y === cell2.position.y) {
    if (cell1.position.x < cell2.position.x) {
      return 0;
    } else {
      // cell1.position.x > cell2.position.x
      return 180;
    }
  } else if (cell1.position.x - cell2.position.x === cell1.position.y - cell2.position.y) {
    if (cell1.position.x < cell2.position.x) {
      return 45;
    } else {
      // cell1.position.x > cell2.position.x
      return 225;
    }
  } else if (cell1.position.x - cell2.position.x === cell2.position.y - cell1.position.y) {
    if (cell1.position.x < cell2.position.x) {
      return 315;
    } else {
      // cell1.position.x > cell2.position.x
      return 135;
    }
  } else {
    return 'Error';
  }
}

// mapに対して破壊的変更をする
export function createLine(
  map: GameMap,
  cell1: Cell,
  cell2: Cell,
  extendedMap: ExtendedGameMap
): [Track[], Switch[]] | CreateLineError {
  if (cell1.position.x === cell2.position.x && cell1.position.y === cell2.position.y) {
    return { error: '同じセル' };
  }

  if (cell1.lineType?.lineClass === 'Branch') {
    return { error: '始点が分岐' };
  }
  if (cell2.lineType?.lineClass === 'Branch') {
    return { error: '終点が分岐' };
  }

  // 始点のセルの種類ごとに可能なものと分岐対象が違ってくる
  // 今回は、何もないところにswitchが生成されることは無いとする。また、分岐する線路は高々2つ（本線と側線の2つ）とする

  // cell1とcell2の位置関係から種類を決定する
  const angle = getAngleBetweenCells(cell1, cell2);

  if (angle === 'Error') {
    return { error: '始点と終点が直線上にない' };
  }

  let x = cell1.position.x;
  let y = cell1.position.y;
  let ix = cell2.position.x < cell1.position.x ? -1 : cell2.position.x === cell1.position.x ? 0 : 1;
  let iy = cell2.position.y < cell1.position.y ? -1 : cell2.position.y === cell1.position.y ? 0 : 1;
  const resultTracks: Track[] = [];
  const resultSwitches: Switch[] = [];
  const mapUpdateData: [number, number, Cell][] = [];
  let prevCell = map[x][y];

  // 始点から終点まで線路を作る
  while (true) {
    const result = createTrackOnAdjacentCells(prevCell, map[x + ix][y + iy], angle);
    if ('error' in result) {
      return { error: result.error };
    }
    const [[newCell1, newCell2], tracks, switches] = result;
    resultTracks.push(...tracks);
    resultSwitches.push(...switches);
    mapUpdateData.push([x, y, newCell1], [x + ix, y + iy, newCell2]);
    prevCell = newCell2;
    x += ix;
    y += iy;
    if (x === cell2.position.x && y === cell2.position.y) {
      // 終点にエラー無く到達したら、mapを更新して終了
      for (const [x, y, cell] of mapUpdateData) {
        map[x][y] = cell;
        extendedMap[x][y].type = 'Railway';
      }
      return [resultTracks, resultSwitches];
    }
  }
}

// deleteにおいて返り値のtracksは常に空配列、switchは常にlineTypeと同じ

function deleteStraightLine(cell: Cell, angle: LineAngle): LineTypeTerminal | { error: string } {
  const lineType = cell.lineType as LineTypeStraight;

  if (lineType.straightType === 'Horizontal') {
    if (angle === 0 || angle === 180) {
      return {
        lineClass: 'Terminal',
        angle: angle === 0 ? 180 : 0,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.straightType === 'Vertical') {
    if (angle === 90 || angle === 270) {
      return {
        lineClass: 'Terminal',
        angle: angle === 90 ? 270 : 90,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.straightType === 'BottomTop') {
    if (angle === 45 || angle === 225) {
      return {
        lineClass: 'Terminal',
        angle: angle === 45 ? 225 : 45,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else {
    // lineType.straightType === 'TopBottom'
    if (angle === 135 || angle === 315) {
      return {
        lineClass: 'Terminal',
        angle: angle === 135 ? 315 : 135,
        tracks: [],
        switch: lineType.switch,
      };
    }
  }

  return { error: 'lineTypeとangleの関係がおかしい' };
}

function deleteCurveLine(cell: Cell, angle: LineAngle): LineTypeTerminal | { error: string } {
  const lineType = cell.lineType as LineTypeCurve;

  if (lineType.curveType === 'Bottom_TopLeft') {
    if (angle === 270 || angle === 135) {
      return {
        lineClass: 'Terminal',
        angle: angle === 270 ? 135 : 270,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.curveType === 'Bottom_TopRight') {
    if (angle === 270 || angle === 45) {
      return {
        lineClass: 'Terminal',
        angle: angle === 270 ? 45 : 270,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.curveType === 'Top_BottomLeft') {
    if (angle === 90 || angle === 225) {
      return {
        lineClass: 'Terminal',
        angle: angle === 90 ? 225 : 90,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.curveType === 'Top_BottomRight') {
    if (angle === 90 || angle === 315) {
      return {
        lineClass: 'Terminal',
        angle: angle === 90 ? 315 : 90,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.curveType === 'Left_TopRight') {
    if (angle === 180 || angle === 45) {
      return {
        lineClass: 'Terminal',
        angle: angle === 180 ? 45 : 180,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.curveType === 'Left_BottomRight') {
    if (angle === 180 || angle === 315) {
      return {
        lineClass: 'Terminal',
        angle: angle === 180 ? 315 : 180,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.curveType === 'Right_TopLeft') {
    if (angle === 0 || angle === 135) {
      return {
        lineClass: 'Terminal',
        angle: angle === 0 ? 135 : 0,
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else {
    // lineType.curveType === 'Right_BottomLeft'
    if (angle === 0 || angle === 225) {
      return {
        lineClass: 'Terminal',
        angle: angle === 0 ? 225 : 0,
        tracks: [],
        switch: lineType.switch,
      };
    }
  }

  return { error: 'lineTypeとangleの関係がおかしい' };
}

function deleteBranchLine(cell: Cell, angle: LineAngle): LineTypeStraight | LineTypeCurve | { error: string } {
  const lineType = cell.lineType as LineTypeBranch;

  if (lineType.branchType === 'Horizontal_TopLeft') {
    if (angle === 135) {
      return {
        lineClass: 'Straight',
        straightType: 'Horizontal',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 180) {
      return {
        lineClass: 'Curve',
        curveType: 'Right_TopLeft',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'Horizontal_TopRight') {
    if (angle === 45) {
      return {
        lineClass: 'Straight',
        straightType: 'Horizontal',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 0) {
      return {
        lineClass: 'Curve',
        curveType: 'Left_TopRight',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'Horizontal_BottomLeft') {
    if (angle === 225) {
      return {
        lineClass: 'Straight',
        straightType: 'Horizontal',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 180) {
      return {
        lineClass: 'Curve',
        curveType: 'Right_BottomLeft',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'Horizontal_BottomRight') {
    if (angle === 315) {
      return {
        lineClass: 'Straight',
        straightType: 'Horizontal',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 0) {
      return {
        lineClass: 'Curve',
        curveType: 'Left_BottomRight',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'Vertical_TopLeft') {
    if (angle === 135) {
      return {
        lineClass: 'Straight',
        straightType: 'Vertical',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 90) {
      return {
        lineClass: 'Curve',
        curveType: 'Bottom_TopLeft',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'Vertical_TopRight') {
    if (angle === 45) {
      return {
        lineClass: 'Straight',
        straightType: 'Vertical',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 90) {
      return {
        lineClass: 'Curve',
        curveType: 'Bottom_TopRight',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'Vertical_BottomLeft') {
    if (angle === 225) {
      return {
        lineClass: 'Straight',
        straightType: 'Vertical',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 270) {
      return {
        lineClass: 'Curve',
        curveType: 'Top_BottomLeft',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'Vertical_BottomRight') {
    if (angle === 315) {
      return {
        lineClass: 'Straight',
        straightType: 'Vertical',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 270) {
      return {
        lineClass: 'Curve',
        curveType: 'Top_BottomRight',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'BottomTop_Top') {
    if (angle === 90) {
      return {
        lineClass: 'Straight',
        straightType: 'BottomTop',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 45) {
      return {
        lineClass: 'Curve',
        curveType: 'Top_BottomLeft',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'BottomTop_Bottom') {
    if (angle === 270) {
      return {
        lineClass: 'Straight',
        straightType: 'BottomTop',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 225) {
      return {
        lineClass: 'Curve',
        curveType: 'Bottom_TopRight',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'BottomTop_Left') {
    if (angle === 180) {
      return {
        lineClass: 'Straight',
        straightType: 'BottomTop',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 225) {
      return {
        lineClass: 'Curve',
        curveType: 'Left_TopRight',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'BottomTop_Right') {
    if (angle === 0) {
      return {
        lineClass: 'Straight',
        straightType: 'BottomTop',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 45) {
      return {
        lineClass: 'Curve',
        curveType: 'Right_BottomLeft',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'TopBottom_Top') {
    if (angle === 90) {
      return {
        lineClass: 'Straight',
        straightType: 'TopBottom',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 135) {
      return {
        lineClass: 'Curve',
        curveType: 'Top_BottomRight',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'TopBottom_Bottom') {
    if (angle === 270) {
      return {
        lineClass: 'Straight',
        straightType: 'TopBottom',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 315) {
      return {
        lineClass: 'Curve',
        curveType: 'Bottom_TopLeft',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'TopBottom_Left') {
    if (angle === 180) {
      return {
        lineClass: 'Straight',
        straightType: 'TopBottom',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 135) {
      return {
        lineClass: 'Curve',
        curveType: 'Left_BottomRight',
        tracks: [],
        switch: lineType.switch,
      };
    }
  } else if (lineType.branchType === 'TopBottom_Right') {
    if (angle === 0) {
      return {
        lineClass: 'Straight',
        straightType: 'TopBottom',
        tracks: [],
        switch: lineType.switch,
      };
    } else if (angle === 315) {
      return {
        lineClass: 'Curve',
        curveType: 'Right_TopLeft',
        tracks: [],
        switch: lineType.switch,
      };
    }
  }

  return { error: 'lineTypeとangleの関係がおかしい' };
}

function deleteAdjacentLine(
  cell: Cell,
  angle: LineAngle
): [LineTypeStraight | LineTypeTerminal | LineTypeCurve | null, Track] | { error: string } {
  // angle方向のtrackを削除する
  const tracksToBeDeleted = cell.lineType!.tracks.filter((track) => {
    const r = Math.atan2(track.end.y - track.begin.y, track.end.x - track.begin.x);
    const trackAngle = ((r * 180) / Math.PI + 180) % 360;
    return Math.abs(trackAngle - angle) < 1 || Math.abs(trackAngle - angle) > 359;
  });

  console.log({ tracksToBeDeleted });

  if (tracksToBeDeleted.length === 0) {
    return { error: '削除するtrackがない' };
  }

  if (tracksToBeDeleted.length !== 1) {
    throw new Error('trackの数がおかしい');
  }

  const trackToBeDeleted = tracksToBeDeleted[0];

  const tempResult = (() => {
    switch (cell.lineType?.lineClass) {
      case 'Straight':
        return deleteStraightLine(cell, angle);
      case 'Curve':
        return deleteCurveLine(cell, angle);
      case 'Branch':
        return deleteBranchLine(cell, angle);
      case 'Terminal':
        if (cell.lineType.angle !== angle) {
          return { error: 'terminalの角度が違う' };
        }
        return null;
      default:
        return { error: '線路がない' };
    }
  })();

  if (tempResult === null) {
    return [null, trackToBeDeleted];
  }

  if ('error' in tempResult) {
    return tempResult;
  }

  const trackAfterDeleted = cell.lineType!.tracks.filter((track) => track.trackId !== trackToBeDeleted.trackId);
  updateSwitchByDeletingTrack(cell.lineType!.switch, trackToBeDeleted);

  return [
    {
      ...tempResult,
      tracks: trackAfterDeleted,
    },
    trackToBeDeleted,
  ];
}

function updateSwitchByDeletingTrack(Switch: Switch, trackToBeDeleted: Track): void {
  Switch.beginTracks = Switch.beginTracks.filter((track) => track.trackId !== trackToBeDeleted.trackId);
  Switch.endTracks = Switch.endTracks.filter((track) => track.trackId !== trackToBeDeleted.trackId);
  Switch.switchPatterns = Switch.switchPatterns.filter((pattern) => {
    return pattern[0].trackId !== trackToBeDeleted.trackId && pattern[1].trackId !== trackToBeDeleted.trackId;
  });
  if (Switch.switchPatterns.length >= 2) {
    Switch.straightPatternIndex = getStraightPatternIndex(Switch);
  } else {
    Switch.straightPatternIndex = null;
  }

  validateSwitch(Switch);
}

// TODO: 他も実装したい
export function validateAppState(appStates: AppStates) {
  const tracks = appStates.map.map((row) => row.map((cell) => cell.lineType?.tracks ?? [])).flat(2);
  const tracksInSwitches = tracks
    .map((track) =>
      track.nextSwitch.beginTracks
        .concat(track.nextSwitch.endTracks)
        .concat(track.prevSwitch.beginTracks.concat(track.prevSwitch.endTracks))
    )
    .flat(2);

  // tracksとtracksInSwitchesで不一致がないかチェック
  const trackIdSet = new Set(tracks.map((track) => track.trackId));
  const trackIdSetInSwitches = new Set(tracksInSwitches.map((track) => track.trackId));
  if (trackIdSet.size !== trackIdSetInSwitches.size) {
    throw new Error('tracksとtracksInSwitchesで不一致');
  }
  for (const trackId of trackIdSet) {
    if (!trackIdSetInSwitches.has(trackId)) {
      throw new Error('tracksとtracksInSwitchesで不一致');
    }
  }
}

// cell1とcell2の間の線路を削除する（破壊的変更はしない）
export function deleteLineSub(
  cell1: Cell,
  cell2: Cell
):
  | CreateLineError
  | [
      LineTypeStraight | LineTypeCurve | LineTypeTerminal | null,
      LineTypeStraight | LineTypeCurve | LineTypeTerminal | null
    ] {
  if (cell1.lineType == null || cell2.lineType == null) {
    return { error: '線路がないsub' };
  }

  if (cell1.position.x === cell2.position.x && cell1.position.y === cell2.position.y) {
    return { error: '同じセルsub' };
  }

  if (Math.abs(cell1.position.x - cell2.position.x) > 1 || Math.abs(cell1.position.y - cell2.position.y) > 1) {
    return { error: '複数セルsub' };
  }

  const angle = getAngleBetweenCells(cell1, cell2);
  if (angle === 'Error') {
    return { error: '始点と終点が直線上にないsub' };
  }

  const result1 = deleteAdjacentLine(cell1, angle);
  const result2 = deleteAdjacentLine(cell2, ((angle + 180) % 360) as LineAngle);

  if (result1 !== null && 'error' in result1) {
    return result1;
  }
  if (result2 !== null && 'error' in result2) {
    return result2;
  }

  const [newLineType1, deletedTrack1] = result1;
  const [newLineType2, deletedTrack2] = result2;

  if (newLineType1 !== null) {
    newLineType1.tracks = newLineType1.tracks.filter((track) => track.trackId !== deletedTrack2.trackId);
    updateSwitchByDeletingTrack(newLineType1.switch, deletedTrack2);
  }
  if (newLineType2 !== null) {
    newLineType2.tracks = newLineType2.tracks.filter((track) => track.trackId !== deletedTrack1.trackId);
    updateSwitchByDeletingTrack(newLineType2.switch, deletedTrack1);
  }

  return [newLineType1, newLineType2];
}

// cell1とcell2の間の線路を削除する（mapに対して破壊的変更をする）
export function deleteLine(map: GameMap, cell1: Cell, cell2: Cell): CreateLineError | { ok: true } {
  if (cell1.lineType == null || cell2.lineType == null) {
    return { error: '線路がない' };
  }

  if (cell1.position.x === cell2.position.x && cell1.position.y === cell2.position.y) {
    return { error: '同じセル' };
  }

  const angle = getAngleBetweenCells(cell1, cell2);
  if (angle === 'Error') {
    return { error: '始点と終点が直線上にない' };
  }

  let x = cell1.position.x;
  let y = cell1.position.y;
  let ix = cell2.position.x < cell1.position.x ? -1 : cell2.position.x === cell1.position.x ? 0 : 1;
  let iy = cell2.position.y < cell1.position.y ? -1 : cell2.position.y === cell1.position.y ? 0 : 1;
  const mapUpdateData: [number, number, null | LineTypeStraight | LineTypeTerminal | LineTypeCurve | LineTypeBranch][] =
    [];
  let prevCell = map[x][y];

  // 始点から終点まで線路を作る
  while (true) {
    const result = deleteLineSub(prevCell, map[x + ix][y + iy]);
    if ('error' in result) {
      return { error: result.error };
    }
    const [newLineType1, newLineType2] = result;
    mapUpdateData.push([x, y, newLineType1], [x + ix, y + iy, newLineType2]);
    prevCell = { ...map[x + ix][y + iy], lineType: newLineType2 };
    x += ix;
    y += iy;
    if (x === cell2.position.x && y === cell2.position.y) {
      // 終点にエラー無く到達したら、mapを更新して終了
      for (const [x, y, lineType] of mapUpdateData) {
        map[x][y].lineType = lineType;
      }
      return { ok: true };
    }
  }
}

export function deleteStation(map: GameMap, station: StationLike): CreateLineError | true {
  const platformCells = map
    .map((row) =>
      row.filter((cell) =>
        cell.lineType?.tracks.some((track) =>
          station.platforms.some((p) => p.platformId === track.track.platform?.platformId)
        )
      )
    )
    .filter((row) => row.length > 0);

  if (platformCells.length === 0) {
    return { error: '駅がない' };
  }

  if (platformCells.length !== 2) {
    return { error: '駅が2列ではない' };
  }

  let results: [Cell, LineTypeStraight | LineTypeCurve | LineTypeTerminal | null][] = [];
  for (let i = 0; i < platformCells[0].length; i++) {
    const result = deleteLineSub(platformCells[0][i], platformCells[1][i]);
    if ('error' in result) {
      return result;
    }
    results.push([platformCells[0][i], result[0]]);
    results.push([platformCells[1][i], result[1]]);
  }

  for (const [oldCell, newLineType] of results) {
    map[oldCell.position.x][oldCell.position.y].lineType = newLineType;
  }

  return true;
}

export function getAllTracks(map: GameMap): Track[] {
  return map.map((row) => row.map((cell) => cell.lineType?.tracks ?? []).flat()).flat();
}
