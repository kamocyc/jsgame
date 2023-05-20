import { HalfTrack, Point, generateId } from './model.js';
import { createNewTrack, getRadian } from './trackUtil.js';
import { TrainMove } from './trainMove.js';
import { assert, deepEqual, max } from './common.js';
import { draw } from './drawer.js';

interface SvgTrack {
  _begin: Point,
  _end: Point,
}

interface SvgText {
  position: Point,
  text: string,
}

interface SvgPlatform {
  position: Point;
  width: number;
  height: number;
}

interface SvgParsedData {
  tracks: SvgTrack[];
  texts: SvgText[];
  platforms: SvgPlatform[];
}

// TODO: oudのデータに合わせるために、下（y座標が大きい）ほうが小さい番線を割り当てる
// なんかいい感じに指定したい
const trackSortMode: 'ASC' | 'DESC' = 'DESC';

function parseSvgObject(rootObj: any): SvgParsedData {
  const tracks: SvgTrack[] = [];
  const texts: SvgText[] = [];
  const platforms: SvgPlatform[] = [];

  let maxX = 0;

  function sub(obj: any, translateX: number, translateY: number) {
    const subGroups = obj['g'] === undefined ? [] : Array.isArray(obj['g']) ? obj['g'] : [obj['g']];
    for (const subGroup of subGroups) {
      let offsetX = 0, offsetY = 0;
      const transform = subGroup['_attributes']?.['transform'] as string | undefined;
      if (transform && /translate\(/.test(transform.trim())) {
        const matches = transform.trim().match(/translate\((-?\d+),\s*(-?\d+)\)/);
        if (matches != null) {
          offsetX = Number(matches[1]);
          offsetY = Number(matches[2]);
        }
      }
      sub(subGroup, translateX + offsetX, translateY + offsetY);
    }

    // TODO: rect, text, pathが複数のとき、それ自体のtransform等での座標の指定
    const rect = obj['rect'];
    if (rect) {
      if (Number(rect['_attributes']['width']) > 5 && Number(rect['_attributes']['height']) > 5) {
        platforms.push({
          position: {
            x: translateX,
            y: translateY,
          },
          width: Number(rect['_attributes']['width']),
          height: Number(rect['_attributes']['height']),
        });
      }
    }

    const text = obj['text'];
    if (text && text['tspan']) {
      const textContent = text['tspan']['_text'] as string;

      texts.push({
        position: {
          x: translateX,
          y: translateY,
        },
        text: textContent,
      });
    }

    const path = obj['path'];
    if (path) {
      const ds = (path['_attributes']['d'] as string).split(' ');
      let prevPoint = { x: Number(ds[1]) + translateX, y: Number(ds[2]) + + translateY };
      const currentPoint = { x: Number(ds[ds.length - 2]) + translateX, y: Number(ds[ds.length - 1]) + translateY };
      if (prevPoint.y === currentPoint.y && currentPoint.x < prevPoint.x) {
        // TODO: 順番を変えるんじゃなくて線路の重複判定を治すべき
        tracks.push({ _begin: currentPoint, _end: prevPoint });
      } else {
        tracks.push({ _begin: prevPoint, _end: currentPoint });
      }
      // for (let i = 3; i < ds.length; i ++) {
      //   if (ds[i] === 'L') {
      //     tracks.push({ _begin: prevPoint, _end: { x: Number(ds[i + 1]) + translateX, y: Number(ds[i + 2]) + translateY } });
      //   }
      // }
    }
  }
  
  sub(rootObj, 0, 0);

  return {
    tracks,
    texts,
    platforms,
  };
}

// function createKey(point: Point): string {
//   return point.x + '__' + point.y;
// }

function isTransitionableRadian(r: number) {
  return Math.abs(r) > Math.PI / 2;// + Math.PI / 20;
}

function createTrainMove(data: SvgParsedData): TrainMove {
  // createTrack基本的には座標が一致したらつなげる。
  const trainMove = new TrainMove();
  
  if (false) {
    for (const track of data.tracks) {
      const [track1, track2, switches_] = createNewTrack(
        track._begin,
        track._end,
        [],
        [],
        null)
      trainMove.tracks.push(track1, track2);
      
      draw(trainMove, null, null);
      console.log('debug');
    }
  }

  // 横長の連続する線路をマージする
  {
    const merged: SvgTrack[] = [];
    data.tracks.sort((t1, t2) => t1._begin.x - t2._end.x);
    while (data.tracks.length > 0) {
      const track = data.tracks[0];
      if (track._begin.y !== track._end.y) {
        merged.push(track);
        data.tracks.splice(0, 1);
      } else {
        const tracksOnSameLine = data.tracks.filter(t => t !== track && t._begin.y === track._begin.y && t._end.y === track._begin.y);
        let prevX = track._end.x;
        const toDeleteTracks = [track];
        for (const t of tracksOnSameLine) {
          if (t._begin.x === prevX) {
            prevX = t._end.x;
            toDeleteTracks.push(t);
          } else {
            break;
          }
        }

        merged.push({ _begin: { x: track._begin.x, y: track._begin.y }, _end: { x: prevX, y: track._end.y }});
        
        for (const t of toDeleteTracks) {
          const i = data.tracks.map((tt, i) => [tt, i] as const).filter(([tt, _]) => tt === t)[0][1];
          data.tracks.splice(i, 1);
        }
      }
    }

    data.tracks = merged;
  }

  // 駅の前後で線路を分割する
  for (const rect of data.platforms) {
    // TODO: 絞りこむ
    const adjacentTracks =
      data.tracks
      .filter(p => p._end.x > rect.position.x && rect.position.x + rect.width > p._begin.x)
      .filter(p => p._begin.y === p._end.y);

    for (const adjacentTrack of adjacentTracks) {
      if (adjacentTrack._begin.x < rect.position.x) {
        data.tracks.push({
          _begin: { ...adjacentTrack._begin },
          _end: { x: rect.position.x, y: adjacentTrack._begin.y },
        });
        adjacentTrack._begin.x = rect.position.x;
      }

      if (adjacentTrack._end.x > rect.position.x + rect.width) {
        data.tracks.push({
          _begin: { x: rect.position.x + rect.width, y: adjacentTrack._begin.y },
          _end: { ...adjacentTrack._end },
        });

        adjacentTrack._end.x = rect.position.x + rect.width;
      }
    }
  }

  // 斜めの線の終点が横の線の途中の場合は分割（TODO: 本当はもっと多様な場合に対応すべきだが）
  for (const track of data.tracks.filter(t => t._begin.y !== t._end.y)) {
    if (data.tracks.filter(t => t !== track && (deepEqual(t._begin, track._begin) || deepEqual(t._end, track._begin))).length === 0) {
      const horizontalTracks = data.tracks.filter(t => t._begin.y === track._begin.y && t._end.y === track._begin.y && t._begin.x < track._begin.x && t._end.x > track._begin.x);
      if (horizontalTracks.length > 0) {
        const horizontalTrack = horizontalTracks[0];
        data.tracks.push({
          _begin: {
            x: track._begin.x,
            y: horizontalTrack._begin.y
          },
          _end: { ...horizontalTrack._end }
        });
        horizontalTrack._end.x = track._begin.x;
      }
    }
    
    if (data.tracks.filter(t => t !== track && (deepEqual(t._begin, track._end) || deepEqual(t._end, track._end))).length === 0) {
      const horizontalTracks = data.tracks.filter(t => t._begin.y === track._end.y && t._end.y === track._end.y && t._begin.x < track._end.x && t._end.x > track._end.x);
      if (horizontalTracks.length > 0) {
        const horizontalTrack = horizontalTracks[0];
        data.tracks.push({
          _begin: {
            x: track._end.x,
            y: horizontalTrack._begin.y
          },
          _end: { ...horizontalTrack._end }
        });
        horizontalTrack._end.x = track._end.x;
      }
    }
  }

  // const beginTracksMap = new Map<string, HalfTrack[]>();

  // trackの設定
  for (const track of data.tracks) {
    // 作る線となす角が90を超える場合のみnext / prevに指定。そうでないときは、switchのみを利用
    const prevTrackCandidates = trainMove.tracks.filter(t => deepEqual(t._end, track._begin));
    const prevTracks = prevTrackCandidates.filter(t => isTransitionableRadian(getRadian(t, track)));
    const nextTrackCandidates = trainMove.tracks.filter(t => deepEqual(t._begin, track._end));
    const nextTracks = nextTrackCandidates.filter(t => isTransitionableRadian(getRadian(t, track)));
    if (nextTrackCandidates.length > 0) {
      const s = nextTrackCandidates[0]._prevSwitch;
      nextTrackCandidates.forEach(t => assert(t._prevSwitch === s));
    }

    const [track1, track2, switches_] = createNewTrack(
      track._begin,
      track._end,
      nextTracks,
      prevTracks,
      null,
      nextTrackCandidates.length > 0 ? nextTrackCandidates[0]._prevSwitch : undefined,
      prevTrackCandidates.length > 0 ? prevTrackCandidates[0]._nextSwitch : undefined)
    trainMove.tracks.push(track1, track2);
    trainMove.switches.push(...switches_);
    
    draw(trainMove, null, null);
  }
  // rectからstationを設定
  // textで駅を設定
  // lineとstationとの隣接でplatformと設定
  // y軸でソート
  // x軸は四角の端と端
  const platformGap = 20;
  const platformCandidateSet = new Set(data.platforms);
  // 隣接判定。。。
  while (platformCandidateSet.size > 0) {
    const rect = Array.from(platformCandidateSet)[0];
    // TODO: y座標を考慮するなどして、もう少し絞る
    // TODO: 理想的にはstationから連続的に近い部分を取得してグループ化
    const adjacentRects = data.platforms.filter(p => p.position.x + p.width > rect.position.x && rect.position.x + rect.width > p.position.x);
    const adjacentTracks =
      data.tracks
      .filter(p => p._end.x > rect.position.x && rect.position.x + rect.width > p._begin.x)
      .filter(p => p._begin.y === p._end.y);
    const adjacentTexts = data.texts.filter(p => p.position.x > rect.position.x && rect.position.x + rect.width > p.position.x);
    
    for(const rect of adjacentRects) {
      platformCandidateSet.delete(rect);
    }

    if (adjacentTexts.length === 0) continue;
    const stationName = adjacentTexts[0].text;
    
    // rectに隣接するtrackからplatformを決める
    const stationTracks = adjacentTracks;/*.filter(track =>
      adjacentRects.filter(rect =>
        // 上
        (track._begin.y < rect.position.y && track._begin.y >= rect.position.y + platformGap) ||
        // 下
        (track._begin.y > rect.position.y + rect.height && track._begin.y <= rect.position.y + rect.height + platformGap)
      ).length > 0
    );*/
    if (trackSortMode === 'ASC') {
      stationTracks.sort((track1, track2) => track1._begin.y - track2._begin.y);
    } else {
      stationTracks.sort((track1, track2) => track2._begin.y - track1._begin.y);
    }
    stationTracks.forEach((stationTrack, trackIndex) => {
      const tracks_ = trainMove.tracks.filter(track => deepEqual(track._begin, stationTrack._begin) && deepEqual(track._end, stationTrack._end));
      if (tracks_.length !== 1) throw new Error('tracks_.length');
      const track = tracks_[0];
      track.track.station = {
        stationId: generateId(),
        stationName: stationName + ' ' + (trackIndex + 1),
        shouldDepart: () => true,
      };
    });

    draw(trainMove, null, null);
  }

  return trainMove;
}

export async function svgLoaderMain() {
  const svg = await (await fetch('./narasen.svg')).text();
  // xml2jsonはviteだとstreamがpolyfillされなくて動かないのでscriptタグから入れた
  // @ts-ignore
  const obj = JSON.parse(xml2json(svg, {compact: true, spaces: 2}));
  console.log(obj['svg']);
  
  const data = parseSvgObject(obj['svg']);
  const maxX = max(data.tracks.map(t => t._end.x));
  console.log(data);
  console.log(maxX);

  (document.getElementById('canvas') as HTMLCanvasElement).width = maxX + 10;

  const trainMove = createTrainMove(data);
  draw(trainMove, null, null);

  return trainMove;
}

