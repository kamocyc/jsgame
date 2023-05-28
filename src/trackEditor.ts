import { assert } from "./common";
import { draw, drawLine } from "./drawer";
import { CellHeight, CellWidth, LineType, LineTypeStraight, LineTypeTerminal, addVector, mapHeight, mapWidth, timesVector, Map, LineAngle, LineDirection, CurveType, BranchType, Cell } from "./mapEditorModel";
import { HalfTrack, Point, Switch } from "./model";
import { drawEditor } from "./trackEditorDrawer";
import { createNewTrack, isTrainOutTrack } from "./trackUtil";
import { TrainMove } from "./trainMove";

function mouseToMapPosition(mousePoint: Point) {
  return {
    x: Math.floor(mousePoint.x / CellWidth),
    y: Math.floor(mousePoint.y / CellHeight),
  };
}

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
  if (angle1 === 0 && angle2 === 45) {
    return 'Left_TopRight';
  } else if (angle1 === 0 && angle2 === 315) {
    return 'Left_BottomRight';
  } else if (angle1 === 90 && angle2 === 135) {
    return 'Top_BottomLeft';
  } else if (angle1 === 90 && angle2 === 45) {
    return 'Top_BottomRight';
  } else if (angle1 === 180 && angle2 === 135) {
    return 'Right_BottomLeft';
  } else if (angle1 === 180 && angle2 === 225) {
    return 'Right_TopLeft';
  } else if (angle1 === 270 && angle2 === 225) {
    return 'Bottom_TopLeft';
  } else if (angle1 === 270 && angle2 === 315) {
    return 'Bottom_TopRight';
  } else if (angle1 === 45 && angle2 === 90) {
    return 'Bottom_TopLeft';
  } else if (angle1 === 45 && angle2 === 0) {
    return 'Right_TopLeft';
  } else if (angle1 === 135 && angle2 === 180) {
    return 'Left_TopRight';
  } else if (angle1 === 135 && angle2 === 90) {
    return 'Bottom_TopRight';
  } else if (angle1 === 225 && angle2 === 180) {
    return 'Left_BottomRight';
  } else if (angle1 === 225 && angle2 === 270) {
    return 'Top_BottomRight';
  } else if (angle1 === 315 && angle2 === 270) {
    return 'Top_BottomLeft';
  } else if (angle1 === 315 && angle2 === 0) {
    return 'Right_BottomLeft';
  } else {
    return undefined;
  }
}

function getBranchTypeFromDirectionAndAngle(straightType: LineDirection, angle: LineAngle): [BranchType, 'Left' | 'Right'] | undefined {
  switch (straightType) {
    case 'Horizontal':
      if (angle === 45) {
        return ['Horizontal_BottomRight', 'Left'];
      } else if (angle === 135) {
        return ['Horizontal_BottomLeft', 'Right'];
      } else if (angle === 225) {
        return ['Horizontal_TopLeft', 'Right'];
      } else if (angle === 315) {
        return ['Horizontal_TopRight', 'Left'];
      }
      break;
    case 'Vertical':
      if (angle === 45) {
        return ['Vertical_BottomRight', 'Left'];
      } else if (angle === 135) {
        return ['Vertical_BottomLeft', 'Right'];
      } else if (angle === 225) {
        return ['Vertical_TopLeft', 'Right'];
      } else if (angle === 315) {
        return ['Vertical_TopRight', 'Left'];
      }
      break;
    case 'TopBottom':
      if (angle === 0) {
        return ['UpDown_Right', 'Left'];
      } else if (angle === 90) {
        return ['UpDown_Bottom', 'Left'];
      } else if (angle === 180) {
        return ['UpDown_Left', 'Right'];
      } else if (angle === 270) {
        return ['UpDown_Top', 'Right'];
      }
      break;
    case 'BottomTop':
      if (angle === 0) {
        return ['DownUp_Right', 'Left']
      } else if (angle === 90) {
        return ['DownUp_Bottom', 'Right']
      } else if (angle === 180) {
        return ['DownUp_Left', 'Right']
      } else if (angle === 270) {
        return ['DownUp_Top', 'Left']
      }
      break;
  }
}

function getAdjacentTrackAndNewCellBase(cell1: Cell, angle: LineAngle): [HalfTrack[], Cell] | CreateLineError {
  const newCell1: Cell = {
    position: cell1.position,
    lineType: null,
  };
  if (cell1.lineType === null) {
    newCell1.lineType = {
      lineClass: 'Terminal',
      angle: angle, // TODO: 始点だった場合は反転する
      tracks: [],
    };
    return [[], newCell1];
  } else if (cell1.lineType.lineClass === 'Terminal') {
    if (cell1.lineType.angle === angle) {
      // 同じ方向の延長
      assert(cell1.lineType.tracks.length === 2);
      const prevTracks = cell1.lineType.tracks;
      newCell1.lineType = {
        lineClass: 'Straight',
        straightType: getDirectionFromAngle(cell1.lineType.angle),
        tracks: prevTracks,
      };
      return [prevTracks, newCell1];
    } else {
      // カーブ
      const curveType = getCurveTypeFromAngles(cell1.lineType.angle, angle);
      if (curveType === undefined) {
        return { error: 'カーブ元の線路との角度が不正' };
      }
      assert(cell1.lineType.tracks.length === 2);
      const prevTracks = cell1.lineType.tracks;
      newCell1.lineType = {
        lineClass: 'Curve',
        curveType: curveType,
        tracks: prevTracks,
      };
      return [prevTracks, newCell1];
    }
  } else if (cell1.lineType.lineClass === 'Straight') {
    assert(cell1.lineType.tracks.length === 2);
    const result = getBranchTypeFromDirectionAndAngle(cell1.lineType.straightType, angle);
    if (result === undefined) {
      return { error: '分岐元の線路との角度が不正' };
    }
    const [straightType, branchType] = result;
    const prevTrack = ((tracks: HalfTrack[]) => {
      if (branchType === 'Left') {
        // tracks.tracksのうち、xが小さい方を選ぶ
        if (tracks[0]._begin.x < tracks[1]._begin.x || tracks[0]._end.x < tracks[1]._end.x) {
          return tracks[0];
        }
        return tracks[1];
      } else {
        if (tracks[0]._begin.x > tracks[1]._begin.x || tracks[0]._end.x > tracks[1]._end.x) {
          return tracks[0];
        }
        return tracks[1];
      }
    })(cell1.lineType.tracks);

    newCell1.lineType = {
      lineClass: 'Branch',
      branchType: straightType,
      tracks: [prevTrack],
    };
    return [[prevTrack], newCell1];
  }

  return { error: '未対応の線路' };
}

// 間のセルも作る必要がある。
function createLine(cell1: Cell, cell2: Cell): [HalfTrack[], Switch[]] | CreateLineError {
  if (cell1.position.x === cell2.position.x && cell1.position.y === cell2.position.y) {
    return { error: '同じセル' };
  }

  const _begin = addVector(timesVector(cell1.position, 50), { x: CellWidth / 2, y : CellHeight / 2 });
  const _end = addVector(timesVector(cell2.position, 50), {x: CellWidth / 2, y: CellHeight / 2 });

  if (cell1.lineType?.lineClass === 'Branch') {
    return { error: '始点が分岐' };
  }
  if (cell2.lineType?.lineClass === 'Branch') {
    return { error: '終点が分岐' }
  }

  // 始点のセルの種類ごとに可能なものと分岐対象が違ってくる
  // 今回は、何もないところにswitchが生成されることは無いとする。また、分岐する線路は高々2つ（本線と側線の2つ）とする

  // cell1とcell2の位置関係から種類を決定する
  const angle = (() => {
    if (cell1.position.x === cell2.position.x) {
      if (cell1.position.y < cell2.position.y) {
        return 90;
      } else { // cell1.position.y > cell2.position.y
        return 270;
      }
    } else if (cell1.position.y === cell2.position.y) {
      if (cell1.position.x < cell2.position.x) {
        return 0;
      } else { // cell1.position.x > cell2.position.x
        return 180;
      }
    } else if (cell1.position.x - cell2.position.x === cell1.position.y - cell2.position.y) {
      if (cell1.position.x < cell2.position.x) {
        return 45;
      } else { // cell1.position.x > cell2.position.x
        return 225;
      }
    } else if (cell1.position.x - cell2.position.x === cell2.position.y - cell1.position.y) {
      if (cell1.position.x < cell2.position.x) {
        return 315;
      } else { // cell1.position.x > cell2.position.x
        return 135;
      }
    } else {
      return 'Error';
    }
  })();

  if (angle === 'Error') {
    return { error: '始点と終点が直線上にない' };
  }

  // TODO: prevTrack / nextTrackの扱いを修正
  const result_ = getAdjacentTrackAndNewCellBase(cell1, angle);
  if ('error' in result_) {
    return { error: '始点: ' + result_.error };
  }
  const [prevTracks, newCell1] = result_;

  const result__ = getAdjacentTrackAndNewCellBase(cell2, (angle + 180) % 360 as LineAngle);
  if ('error' in result__) {
    return { error: '終点: ' + result__.error };
  }
  const [nextTracks, newCell2] = result__;

  const [newTrack1, newTrack2, newSwitches] = createNewTrack(_begin, _end, prevTracks, nextTracks, null);
  
  newCell1.lineType!.tracks.push(newTrack1, newTrack2);
  newCell2.lineType!.tracks.push(newTrack1, newTrack2);

  cell1.lineType = newCell1.lineType;
  cell2.lineType = newCell2.lineType;

  return [[newTrack1, newTrack2], newSwitches];
}

let mouseStartCell: null | Cell = null;

function initializeMap(): Map {
  const map =
    [0,0,0,0,0].map((_, x) =>
      [0,0,0,0,0].map((_, y) =>
        ({
          position: {x, y},
          lineType: null,
        } as Cell)
      )
    );
  
  map[0][0].lineType = {
    lineClass: 'Straight',
    straightType: 'Horizontal',
    tracks: [],
  };
  return map;
}

export const map = initializeMap();
export const trainMove = new TrainMove()

export function initializeTrackEditor() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  canvas.onmousedown = onmousedown;
  canvas.onmouseup = onmouseup;

  drawEditor(map);
}

function onmousedown(e: MouseEvent) {
  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({x, y});
  if (mapPosition.x >= 0 && mapPosition.x < mapWidth && mapPosition.y >= 0 && mapPosition.y < mapHeight) {
    mouseStartCell = map[mapPosition.x][mapPosition.y];
  }

  drawEditor(map);
}

function onmouseup(e: MouseEvent) {
  if (!mouseStartCell) return;

  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const mapPosition = mouseToMapPosition({x, y});
  if (mapPosition.x >= 0 && mapPosition.x < mapWidth && mapPosition.y >= 0 && mapPosition.y < mapHeight) {
    const mouseEndCell = map[mapPosition.x][mapPosition.y];
    const result = createLine(mouseStartCell, mouseEndCell);
    if ('error' in result) {
      console.warn(result.error);
    } else {
      const [tracks, switches] = result;
      trainMove.tracks.push(...tracks);
      trainMove.switches.push(...switches);
    }
    drawEditor(map);
    // draw(trainMove, null, null);
  }
  drawEditor(map);
}