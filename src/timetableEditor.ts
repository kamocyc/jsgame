import { DiaStation, DiaTrain } from './model.js';
import { DiagramExt } from './oudParser.js';

export function showGlobalTime(timeSeconds: number): string {
  const m = Math.floor((timeSeconds / 60) % 60);
  return '' + Math.floor(timeSeconds / 60 / 60) + (m < 10 ? '0' + m : '' + m);
}

const rowHeight = 24;
const columnWidth = 50;

function parseInputTextAsTime(text: string): string | undefined {
  text = text.replace(/[^0-9]/g, '');
  if (text.length <= 2) {
    // 分のみ => TODO: 直前の時間の次の分を利用する
  } else if (text.length === 3) {
    // 時が1桁
    const _hourText = text.substring(0, 1);
    const minuteText = text.substring(1);

    if (Number(minuteText) < 60) {
      return text;
    }
  } else if (text.length === 4) {
    // 時が2桁
    const hourText = text.substring(0, 2);
    const minuteText = text.substring(2);

    if (Number(hourText) < 24 && Number(minuteText) < 60) {
      return text;
    }
  } else {
    return undefined;
  }
}

export function parseTime(text: string): number | undefined {
  if (text === '') {
    return undefined;
  }
  if (text.length === 3) {
    text = '0' + text;
  }
  const hour = parseInt(text.substring(0, 2));
  const minute = parseInt(text.substring(2));

  // 1日の範囲害ならundefinedを返す
  if (hour >= 24 || minute >= 60 || hour < 0 || minute < 0) {
    return undefined;
  }

  return hour * 60 * 60 + minute * 60;
}

// 要素の配置で重なりは無い；エンティティとして管理して取得で来たら楽かもしれない？
// 基本はinlineで編集だが、詳細を一覧したいときはダイアログ（吹き出し？）を表示するイメージか？
// canvasではなくて、absolute配置でdomを使ったほうがcssの適用とか便利かもしれない。
// TODO: first or errorとか
// 行の表示切替機能ほしい。駅の一部とか
// 基本的に、テキストボックスを使うとかって面倒そうなので、描画
// DOMを使ったバージョン
export function drawTimetable_(diagram: DiagramExt) {
  const parentNode = document.getElementById('timetable-root')!;
  const inputElements: HTMLInputElement[] = [];

  function changeToDivElement(element: HTMLDivElement | HTMLInputElement, textContent: string) {
    const parent = element.parentElement!;
    const { position, left, top, width, height } = element.style;
    const id = element.id;

    parent.removeChild(element);

    const newElement = document.createElement('div');
    newElement.textContent = textContent;
    newElement.style.position = position;
    newElement.style.left = left;
    newElement.style.top = top;
    newElement.style.width = width;
    newElement.style.height = height;
    newElement.style.padding = '0';
    newElement.id = id;
    newElement.onclick = clickHandler;
    parentNode.appendChild(newElement);
  }

  function getTtItemById(id: string) {
    const [trainId, stationId] = id
      .replace('edit-item-', '')
      .split('__')
      .map((s) => Number(s));
    return diagram.trains
      .filter((train) => train.trainId === trainId)[0]
      .trainTimetable.filter((tt) => tt.stationId === stationId)[0];
  }

  function keydownHandler(e: KeyboardEvent) {
    const elem = e.target as HTMLInputElement;

    if (e.key === 'Enter') {
      for (const e of inputElements) {
        resetToDivElement(e);
      }
      inputElements.splice(0);

      const ttItem = getTtItemById(elem.id);
      // tt;
    }
  }

  function changeToInputElement(element: HTMLDivElement | HTMLInputElement, textContent: string) {
    const parent = element.parentElement!;
    const { position, left, top, width, height } = element.style;
    const id = element.id;

    parent.removeChild(element);

    const newElement = document.createElement('input');
    (newElement as HTMLInputElement).value = textContent;
    newElement.style.position = position;
    newElement.style.left = left;
    newElement.style.top = top;
    newElement.style.width = width;
    newElement.style.height = height;
    newElement.style.padding = '0';
    newElement.id = id;
    newElement.onkeydown = keydownHandler;
    parentNode.appendChild(newElement);

    inputElements.push(newElement);
  }

  function resetToDivElement(elem: HTMLInputElement) {
    const ttItem = getTtItemById(elem.id);
    const value = parseInputTextAsTime(elem.value);
    if (value !== undefined) {
      ttItem.departureTime = parseTime(value)!;
    }
    const divText = showGlobalTime(ttItem.departureTime);
    changeToDivElement(elem, divText);
  }

  function clickHandler(e: Event) {
    for (const e of inputElements) {
      resetToDivElement(e);
    }
    inputElements.splice(0);

    const target_ = e.target as Element;
    if (target_.tagName === 'DIV') {
      const elem = target_ as HTMLDivElement;
      changeToInputElement(elem, elem.textContent!);
    }
  }

  function putText(text: string, x: number, y: number, id?: string) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.position = 'absolute';
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.style.width = 40 + 'px';
    div.style.height = 22 + 'px';
    if (id) {
      div.id = id;
    }
    div.onclick = clickHandler;

    parentNode.appendChild(div);
  }

  function getId(diaTrain: DiaTrain, station: DiaStation): string {
    return 'edit-item-' + diaTrain.trainId + '__' + station.stationId;
  }

  function putVerticalText(text: string, x: number, y: number, opt: any) {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.writingMode = 'vertical-rl';
    div.style.position = 'absolute';
    div.style.left = x + 'px';
    div.style.top = y + 'px';

    if (opt.color) {
      div.style.color = opt.color;
    }
    div.onclick = clickHandler;

    parentNode.appendChild(div);
  }

  let offsetX = 0;
  let offsetY = rowHeight;

  const rowHeightMap = {
    trainCode: undefined as number | undefined,
    trainTypeName: undefined as number | undefined,
    trainMei: undefined as number | undefined,
    initialStation: undefined as number | undefined,
    finalStation: undefined as number | undefined,
  };

  // 列車番号等を表示
  putText('列車番号', offsetX, offsetY);
  rowHeightMap.trainCode = offsetY;
  offsetY += rowHeight;
  putText('列車種別', offsetX, offsetY + rowHeight);
  rowHeightMap.trainTypeName = offsetY;
  offsetY += rowHeight + rowHeight * 2;
  putText('列車名', offsetX, offsetY);
  rowHeightMap.trainMei = offsetY;
  offsetY += rowHeight;
  putText('始発駅', offsetX, offsetY);
  rowHeightMap.initialStation = offsetY;
  offsetY += rowHeight;
  putText('終着駅', offsetX, offsetY);
  rowHeightMap.finalStation = offsetY;
  offsetY += rowHeight;

  const stationYMap = new Map<number, number>();
  const stations = diagram.stations; // これは別のほうがいい？当然stationごとに表示するものが異なるので、station基準で。
  for (let stationIndex = 0; stationIndex < stations.length; stationIndex++) {
    const station = stations[stationIndex];
    putText(station.name, offsetX, offsetY);

    stationYMap.set(station.stationId, offsetY);
    offsetY += rowHeight;
  }

  offsetX += columnWidth + columnWidth;

  for (const diaTrain of diagram.trains) {
    const timetable = diaTrain.trainTimetable;

    putText(diaTrain.trainCode ?? '', offsetX, rowHeightMap.trainCode);
    putVerticalText(diaTrain.trainTypeName ?? '', offsetX, rowHeightMap.trainTypeName, { color: diaTrain.color });
    putText(diaTrain.trainMei ?? '', offsetX, rowHeightMap.trainMei); // TODO:  高さなど調整
    putText(
      diagram.stations.filter((s) => s.stationId === timetable[0].stationId)[0].name,
      offsetX,
      rowHeightMap.initialStation
    );
    putText(
      diagram.stations.filter((s) => s.stationId === timetable[timetable.length - 1].stationId)[0].name,
      offsetX,
      rowHeightMap.finalStation
    );

    for (const station of stations) {
      const positionY = stationYMap.get(station.stationId)!;

      const ttItems = timetable.filter((tt) => tt.stationId === station.stationId);
      if (ttItems.length === 0) {
        // 通過など TODO: 通過と経由しないを区別
        putText('..', offsetX, positionY, getId(diaTrain, station));
      } else {
        const ttItem = ttItems[0];
        putText(showGlobalTime(ttItem.departureTime), offsetX, positionY, getId(diaTrain, station));
      }
    }

    // for (let timeIndex = 0; timeIndex < timetable.length; timeIndex++) {
    //   const ttItem = timetable[timeIndex];

    //   // oudiaだと駅ごとに表示種別が変わったが、GUIで変えられるようにできるようにしたい
    //   // 上下に分かれて表示されるのは紙の時刻表に由来する。横とかのほうがわかりやすい？そうでもないか。
    //   const positionY = stationYMap.get(ttItem.stationId);
    //   if (positionY === undefined) {
    //     throw new Error('illegal stationId');
    //   }

    //   putText(showGlobalTime(ttItem.departureTime), offsetX, positionY);
    // }

    offsetX += columnWidth;
  }
}

// // 縦書き 改行とか禁則処理とかいろいろ対応していないがとりあえず表示する
// function fillVerticalText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
//   text.split('').forEach(c => {
//     ctx.fillText(c, x, y);
//     const metrics = ctx.measureText(c)
//     y += metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
//   });
// }

// export function drawTimetableOld(diagram: DiagramExt) {
//   const ctx = (document.getElementById('canvas') as HTMLCanvasElement).getContext("2d")!;
//   let offsetX = 0;
//   let offsetY = rowHeight;

//   const rowHeightMap = {
//     trainCode: undefined as number | undefined,
//     trainTypeName: undefined as number | undefined,
//     trainMei: undefined as number | undefined,
//     initialStation: undefined as number | undefined,
//     finalStation: undefined as number | undefined,
//   };

//   // 列車番号等を表示
//   ctx.fillText('列車番号', offsetX, offsetY);
//   rowHeightMap.trainCode = offsetY;
//   offsetY += rowHeight;
//   ctx.fillText('列車種別', offsetX, offsetY + rowHeight);
//   rowHeightMap.trainTypeName = offsetY;
//   offsetY += rowHeight + rowHeight * 2;
//   ctx.fillText('列車名', offsetX, offsetY);
//   rowHeightMap.trainMei = offsetY;
//   offsetY += rowHeight;
//   ctx.fillText('始発駅', offsetX, offsetY);
//   rowHeightMap.initialStation = offsetY;
//   offsetY += rowHeight;
//   ctx.fillText('終着駅', offsetX, offsetY);
//   rowHeightMap.finalStation = offsetY;
//   offsetY += rowHeight;

//   const stationYMap = new Map<number, number>();
//   const stations = diagram.stations;  // これは別のほうがいい？当然stationごとに表示するものが異なるので、station基準で。
//   for (let stationIndex = 0; stationIndex < stations.length; stationIndex ++) {
//     const station = stations[stationIndex];
//     ctx.fillText(station.name, offsetX, offsetY);

//     stationYMap.set(station.stationId, offsetY);
//     offsetY += rowHeight;
//   }

//   offsetX += columnWidth;

//   for (const diaTrain of diagram.trains) {
//     const timetable = diaTrain.trainTimetable;

//     ctx.fillText(diaTrain.trainCode ?? '', offsetX, rowHeightMap.trainCode);
//     if (diaTrain.color) {
//       ctx.strokeStyle = diaTrain.color;
//     }
//     fillVerticalText(ctx, diaTrain.trainTypeName ?? '', offsetX, rowHeightMap.trainTypeName);
//     ctx.strokeStyle = 'black';
//     ctx.fillText(diaTrain.trainMei ?? '', offsetX, rowHeightMap.trainMei);  // TODO:  高さなど調整
//     ctx.fillText(diagram.stations.filter(s => s.stationId === timetable[0].stationId)[0].name, offsetX, rowHeightMap.initialStation);
//     ctx.fillText(diagram.stations.filter(s => s.stationId === timetable[timetable.length - 1].stationId)[0].name, offsetX, rowHeightMap.finalStation);

//     for (let timeIndex = 0; timeIndex < timetable.length; timeIndex++) {
//       const ttItem = timetable[timeIndex];

//       // oudiaだと駅ごとに表示種別が変わったが、GUIで変えられるようにできるようにしたい
//       // 上下に分かれて表示されるのは紙の時刻表に由来する。横とかのほうがわかりやすい？そうでもないか。
//       const positionY = stationYMap.get(ttItem.stationId);
//       if (positionY === undefined) {
//         throw new Error('illegal stationId');
//       }

//       ctx.fillText(showGlobalTime(ttItem.departureTime), offsetX, positionY);
//     }

//     offsetX += columnWidth;
//   }

//   // 罫線を書く
// }

// function onClick(x: number, y: number) {

// }
