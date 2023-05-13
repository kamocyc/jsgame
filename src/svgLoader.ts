import { HalfTrack, Point, generateId } from './model.js';
import { createNewTrack, getRadian } from './trackUtil.js';
import { TrainMove } from './trainMove.js';
import { deepEqual } from './common.js';
import { draw } from './drawer.js';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0,0,1090,222.70269775390625" width="1090"
height="223">
<g transform="translate(-200, -150)">
  <g transform="translate(320,180)">
    <rect stroke-width="2" stroke="#2c3e50" fill="#ecf0f1" stroke-dasharray="false" width="110"
      height="20" />
  </g>
  <g transform="translate(320,250)">
    <rect stroke-width="2" stroke="#2c3e50" fill="#ecf0f1" stroke-dasharray="false" width="110"
      height="20" />
  </g>
  <g transform="translate(540,210)">
    <rect stroke-width="2" stroke="#2c3e50" fill="#ecf0f1" stroke-dasharray="false" width="120"
      height="20" />
  </g>
  <g transform="translate(540,280)">
    <rect stroke-width="2" stroke="#2c3e50" fill="#ecf0f1" stroke-dasharray="false" width="120"
      height="20" />
  </g>
  <g transform="translate(750,210)">
    <rect stroke-width="2" stroke="#2c3e50" fill="#ecf0f1" stroke-dasharray="false" width="110"
      height="20" />
  </g>
  <g transform="translate(750,280)">
    <rect stroke-width="2" stroke="#2c3e50" fill="#ecf0f1" stroke-dasharray="false" width="110"
      height="20" />
  </g>
  <g transform="translate(950,240)">
    <rect stroke-width="2" stroke="#2c3e50" fill="#ecf0f1" stroke-dasharray="false" width="120"
      height="20" />
  </g>
  <g transform="translate(950,190)">
    <rect stroke-width="2" stroke="#2c3e50" fill="#ecf0f1" stroke-dasharray="false" width="120"
      height="20" />
  </g>
  <g transform="translate(370,330)">
    <rect stroke-width="2" stroke="transparent" fill="transparent" width="1" height="1" />
    <text font-size="24" xml:space="preserve" text-anchor="middle" fill="#2c3e48"
      font-weight="bold" font-style="normal"
      font-family="&quot;Helvetica Neue&quot;, Arial, &quot;Hiragino Kaku Gothic ProN&quot;, Meiryo, YuGothic, &quot;Yu Gothic&quot;, sans-serif"
      writing-mode="horizontal-tb" transform="matrix(1,0,0,1,0.5,0.5)"><tspan dy="0.3em">城陽</tspan></text>
  </g>
  <g transform="translate(600,330)">
    <rect stroke-width="2" stroke="transparent" fill="transparent" width="1" height="1" />
    <text font-size="24" xml:space="preserve" text-anchor="middle" fill="#2c3e48"
      font-weight="bold" font-style="normal"
      font-family="&quot;Helvetica Neue&quot;, Arial, &quot;Hiragino Kaku Gothic ProN&quot;, Meiryo, YuGothic, &quot;Yu Gothic&quot;, sans-serif"
      writing-mode="horizontal-tb" transform="matrix(1,0,0,1,0.5,0.5)"><tspan dy="0.3em">新田</tspan></text>
  </g>
  <g transform="translate(800,330)">
    <rect stroke-width="2" stroke="transparent" fill="transparent" width="1" height="1" />
    <text font-size="24" xml:space="preserve" text-anchor="middle" fill="#2c3e48"
      font-weight="bold" font-style="normal"
      font-family="&quot;Helvetica Neue&quot;, Arial, &quot;Hiragino Kaku Gothic ProN&quot;, Meiryo, YuGothic, &quot;Yu Gothic&quot;, sans-serif"
      writing-mode="horizontal-tb" transform="matrix(1,0,0,1,0.5,0.5)"><tspan dy="0.3em">JR小倉</tspan></text>
  </g>
  <g transform="translate(1010,330)">
    <rect stroke-width="2" stroke="transparent" fill="transparent" width="1" height="1" />
    <text font-size="24" xml:space="preserve" text-anchor="middle" fill="#2c3e48"
      font-weight="bold" font-style="normal"
      font-family="&quot;Helvetica Neue&quot;, Arial, &quot;Hiragino Kaku Gothic ProN&quot;, Meiryo, YuGothic, &quot;Yu Gothic&quot;, sans-serif"
      writing-mode="horizontal-tb" transform="matrix(1,0,0,1,0.5,0.5)"><tspan dy="0.3em">宇治</tspan></text>
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false"
      d="M 260 210 L 280 210 L 300 210 L 430 210 L 450 210 L 470 210"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false"
      d="M 260 240 L 270 240 L 290 240 L 300 240 L 320 240 L 440 240 L 460 240 L 470 240"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 310 240 L 300 210"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 290 210 L 280 240"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 260 210 L 230 210"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 440 210 L 450 240"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 470 240 L 520 240"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 520 240 L 680 240"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 510 240 L 520 270"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 520 270 L 680 270"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 680 270 L 920 270 L 940 270 L 1080 270"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 680 240 L 910 240"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 930 270 L 940 230"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 940 230 L 1080 230"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 1080 220 L 930 220"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 930 220 L 920 240"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 920 240 L 910 240"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 1080 230 L 1090 270"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 1080 270 L 1090 270"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 1090 270 L 1100 270 L 1120 270 L 1260 270"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 1080 220 L 1090 220"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 930 220 L 940 180"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 940 180 L 1080 180"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 1090 220 L 1110 270"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
  <g>
    <path fill="none" stroke-linejoin="round" connector="[object Object]" stroke="#2c3e50"
      stroke-width="2" stroke-dasharray="false" d="M 1080 180 L 1090 220"
      marker-start="url(#v-891-2063096985)" marker-end="url(#v-891-2019156546)" />
  </g>
</g>
</svg>`;

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

function parseSvgObject(rootObj: any): SvgParsedData {
  const tracks: SvgTrack[] = [];
  const texts: SvgText[] = [];
  const platforms: SvgPlatform[] = [];

  function sub(obj: any, translateX: number, translateY: number) {
    const subGroups = obj['g'] === undefined ? [] : Array.isArray(obj['g']) ? obj['g'] : [obj['g']];
    for (const subGroup of subGroups) {
      let offsetX = 0, offsetY = 0;
      const transform = subGroup['_attributes']?.['transform'] as string | undefined;
      if (transform && /translate\(/.test(transform.trim())) {
        const matches = transform.trim().match(/translate\((-?\d+),\s*(-?\d+)\)/);
        if (matches != null) {
          offsetX += Number(matches[1]);
          offsetY += Number(matches[2]);
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
    if (text) {
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
      let prevPoint = { x: Number(ds[1]), y: Number(ds[2]) };
      for (let i = 3; i < ds.length; i ++) {
        if (ds[i] === 'L') {
          tracks.push({ _begin: prevPoint, _end: { x: Number(ds[i + 1]), y: Number(ds[i + 2]) } });
        }
      }
    }
  }
  
  sub(rootObj, 0, 0);

  return {
    tracks,
    texts,
    platforms,
  };
}

function createKey(point: Point): string {
  return point.x + '__' + point.y;
}

function isTransitionableRadian(r: number) {
  return Math.abs(r) > Math.PI / 2 + Math.PI / 20;
}

function createTrainMove(data: SvgParsedData): TrainMove {
  // createTrack基本的には座標が一致したらつなげる。
  const trainMove = new TrainMove();

  // const beginTracksMap = new Map<string, HalfTrack[]>();

  // trackの設定
  for (const track of data.tracks) {
    // 作る線となす角が90を超える場合のみnext / prevに指定。そうでないときは、switchのみを利用
    const prevTrackCandidates = trainMove.tracks.filter(t => deepEqual(t._end, track._begin));
    const prevTracks = prevTrackCandidates.filter(t => isTransitionableRadian(getRadian(t, track)));
    const nextTrackCandidates = trainMove.tracks.filter(t => deepEqual(t._begin, track._end));
    const nextTracks = nextTrackCandidates.filter(t => isTransitionableRadian(getRadian(t, track)));

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
  }

  // rectからstationを設定
  // textで駅を設定
  // lineとstationとの隣接でplatformと設定
  // y軸でソート
  // x軸は四角の端と端
  const platformGap = 20;
  // 隣接判定。。。
  for (const rect of data.platforms) {
    // TODO: y座標を考慮するなどして、もう少し絞る
    // TODO: 理想的にはstationから連続的に近い部分を取得してグループ化
    const adjacentRects = data.platforms.filter(p => p.position.x + p.width >= rect.position.x && rect.position.x + rect.width >= p.position.x);
    const adjacentTracks =
      data.tracks
      .filter(p => p._end.x >= rect.position.x && rect.position.x + rect.width >= p._begin.x)
      .filter(p => p._begin.y === p._end.y);
    const adjacentTexts = data.texts.filter(p => p.position.x >= rect.position.x && rect.position.x + rect.width >= p.position.x);
    
    if (adjacentTexts.length === 0) continue;
    const stationName = adjacentTexts[0].text;
    
    // rectに隣接するtrackからplatformを決める
    const stationTracks = adjacentRects.map(rect =>
        adjacentTracks.filter(track =>
          // 上
          (track._begin.y > rect.position.y && track._begin.y <= rect.position.y + platformGap) ||
          // 下
          (track._begin.y < rect.position.y && track._begin.y >= rect.position.y + platformGap)
        )
      ).flat();
    stationTracks.sort((track1, track2) => track1._begin.y - track2._begin.y);
    stationTracks.forEach((stationTrack, trackIndex) => {
      const tracks_ = trainMove.tracks.filter(track => deepEqual(track._begin, stationTrack._begin) && deepEqual(track._end, stationTrack._end));
      if (tracks_.length !== 1) throw new Error('tracks_.length');
      const track = tracks_[0];
      track.track.station = {
        stationId: generateId(),
        stationName: stationName + trackIndex,
        shouldDepart: () => true,
      };
    });
  }

  return trainMove;
}

export function svgLoaderMain() {
  // @ts-ignore
  const obj = JSON.parse(xml2json(svg, {compact: true, spaces: 2}));
  console.log(obj['svg']);
  
  const data = parseSvgObject(obj['svg']);
  console.log(data);
  const trainMove = createTrainMove(data);
  draw(trainMove, null, null);
}
