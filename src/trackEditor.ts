import { assert, deepEqual } from './common';
import {
  BranchType,
  Cell,
  CellHeight,
  CellWidth,
  CurveType,
  LineAngle,
  LineDirection,
  Map,
  addVector,
  timesVector,
} from './mapEditorModel';
import { HalfTrack, Switch } from './model';
import { createNewTrack } from './trackUtil';

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

// この関数の座標系は直したはず
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

function getAdjacentTrackAndNewCellBase(cell1: Cell, angle: LineAngle): [HalfTrack[], Cell] | { error: string } {
  //: [HalfTrack[], Cell] | CreateLineError {
  function getLeftOrRightTrack(branchType: 'Left' | 'Right' | 'Top' | 'Bottom', track1: HalfTrack, track2: HalfTrack) {
    switch (branchType) {
      case 'Left':
        // tracks.tracksのうち、xが小さい方を選ぶ
        if (track1._begin.x < track2._begin.x || track1._end.x < track2._end.x) {
          return track1;
        }
        return track2;
      case 'Right':
        if (track1._begin.x > track2._begin.x || track1._end.x > track2._end.x) {
          return track1;
        }
        return track2;
      case 'Top':
        if (track1._begin.y > track2._begin.y || track1._end.y > track2._end.y) {
          return track1;
        }
        return track2;
      case 'Bottom':
        if (track1._begin.y < track2._begin.y || track1._end.y < track2._end.y) {
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
      tracks: [prevTrack],
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
      tracks: [prevTrack],
    };
    return [[prevTrack], newCell1];
  }

  return { error: '未対応の線路' };
}

function createTrackOnAdjacentCells(
  cell1: Cell,
  cell2: Cell,
  angle: LineAngle
): [[Cell, Cell], [HalfTrack, HalfTrack], Switch[]] | { error: string } {
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
  const [newTrack1, newTrack2, newSwitches] = createNewTrack(_begin, _end, prevTracks, nextTracks, null);
  const beginTrack = deepEqual(newTrack1._end, _begin) ? newTrack1 : newTrack2;
  const endTrack = deepEqual(newTrack1._end, _begin) ? newTrack2 : newTrack1;

  // セルのtracksは、そのセルに**入る**trackを設定する（次のtrackを設定しやすくするため。）。reverseTrackは設定しない。
  newCell1.lineType!.tracks.push(beginTrack);
  newCell1.lineType!.switch = beginTrack._nextSwitch;
  newCell2.lineType!.tracks.push(endTrack);
  newCell2.lineType!.switch = endTrack._nextSwitch;

  return [[newCell1, newCell2], [newTrack1, newTrack2], newSwitches];
}

export function createLine(map: Map, cell1: Cell, cell2: Cell): [HalfTrack[], Switch[]] | CreateLineError {
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
  const angle = (() => {
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
  })();

  if (angle === 'Error') {
    return { error: '始点と終点が直線上にない' };
  }

  let x = cell1.position.x;
  let y = cell1.position.y;
  let ix = cell2.position.x < cell1.position.x ? -1 : cell2.position.x === cell1.position.x ? 0 : 1;
  let iy = cell2.position.y < cell1.position.y ? -1 : cell2.position.y === cell1.position.y ? 0 : 1;
  const resultTracks: HalfTrack[] = [];
  const resultSwitches: Switch[] = [];
  const mapUpdateData: [number, number, Cell][] = [];
  let prevCell = map[x][y];

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
      for (const [x, y, cell] of mapUpdateData) {
        map[x][y] = cell;
      }
      return [resultTracks, resultSwitches];
    }
  }
}
