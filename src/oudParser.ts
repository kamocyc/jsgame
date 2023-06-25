import { DiaStation, DiaTrain, Diagram, Platform, Station, StationTrain, generateId } from './model.js';

// oud形式をjson形式に変換する
function oudToJson(oudBuf: string): any {
  const obj: any = {};
  let currentObj = obj;
  let parentObjects = [];
  const lines = oudBuf.split(/\r\n|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 文字列プロパティ
    // 同名は後のもので上書きする
    const propertyMatches = line.match(/^(\w+)=(.*)$/);
    if (propertyMatches !== null) {
      const propertyName = propertyMatches[1];
      const propertyValue = propertyMatches[2];
      currentObj[propertyName] = propertyValue;
    }

    // オブジェクトプロパティ
    // 同名は配列にする
    const objectMatches = line.match(/^(\w+)\./);
    if (objectMatches !== null) {
      const propertyName = objectMatches[1];
      if (currentObj[propertyName] === undefined) {
        currentObj[propertyName] = [];
      }
      const newObject = {};
      currentObj[propertyName].push(newObject);
      parentObjects.push(currentObj);
      currentObj = newObject;
    }

    if (line === '.') {
      currentObj = parentObjects[parentObjects.length - 1];
      parentObjects.splice(parentObjects.length - 1);
    }
  }

  if (parentObjects.length !== 0) {
    throw new Error('illegal format');
  }

  return obj;
}

type Houkou = 'Kudari' | 'Nobori' /* */;

interface Time {
  hour: number;
  minute: number;
}

interface EkiJikokuData {
  bansen: number | undefined;
  chakuJikoku: Time | undefined;
  hatsuJikoku: Time | undefined;
  ekiOperation: number | undefined;
}

export interface DiaTrainExt extends DiaTrain {
  trainCode: string | undefined; // 列車番号
  // operationCode: string | undefined;  // 運用番号
  trainTypeName: string | undefined; // 列車種別名
  trainMei: string | undefined; // 列車名
  trainGo: string | undefined; // 列車の○号
}

export interface DiagramExt extends Diagram {
  trains: DiaTrainExt[];
}

function parseEkiJikoku(jikoku: string): EkiJikokuData | undefined {
  // console.log(jikoku);

  if (jikoku.trim() === '') return undefined;

  const result: EkiJikokuData = {
    bansen: undefined,
    chakuJikoku: undefined,
    hatsuJikoku: undefined,
    ekiOperation: undefined,
  };

  let startIndex = 0;
  let mode = 'ekiOperation';

  for (let i = 0; i < jikoku.length; i++) {
    if (jikoku[i] === ';' || jikoku[i] === '$') {
      switch (mode) {
        case 'ekiOperation':
          result.ekiOperation = Number(jikoku.substring(startIndex));
          break;
        case 'jikoku':
          const s = jikoku.substring(startIndex, i);
          const s_ = s.split('/').map((ss) => parseJikoku(ss));
          if (s_.length === 2) {
            result.chakuJikoku = s_[0];
            result.hatsuJikoku = s_[1];
          } else {
            result.hatsuJikoku = s_[0];
          }
          break;
      }

      startIndex = i + 1;
    }

    if (jikoku[i] === ';') {
      mode = 'jikoku';
    }
    if (jikoku[i] === '$') {
      mode = 'bansen';
    }
  }

  if (mode === 'bansen') {
    result.bansen = Number(jikoku.substring(startIndex));
  }

  // console.log(result);
  return result;
}

function parseJikoku(text: string): Time | undefined {
  if (text === '') {
    return undefined;
  }
  if (text.length === 3) {
    text = '0' + text;
  }
  const hour = parseInt(text.substring(0, 2));
  const minute = parseInt(text.substring(2));
  return { hour, minute };
}

function timeToSeconds(time: Time): number {
  return time.hour * 60 * 60 + time.minute * 60;
}

function convertEkis(ekis: any[]): DiaStation[] {
  return ekis.map((eki, i) => {
    const station: DiaStation = {
      stationId: generateId(),
      name: eki['Ekimei'] as string,
      distance: i * 10 /* TODO */,
      platforms: [],
    };
    for (const track of eki['EkiTrack2Cont'][0]['EkiTrack2'] as any[]) {
      const platform: Platform = {
        platformId: generateId(),
        platformName: track['TrackName'] as string,
        station: station as unknown as Station,
      };
      station.platforms.push(platform);
    }

    // 本来はこれらはoutデータから取得するべき
    (station as any).defaultOutboundDiaPlatformId = station.platforms[0].platformId;
    (station as any).defaultInboundDiaPlatformId = station.platforms[0].platformId;

    return station;
  });
}

function convertRessyas(ressyas: any[], stations: DiaStation[], ressyasyubetsus: any[]): DiaTrainExt[] {
  return ressyas.map((ressya) => {
    const houkou = ressya['Houkou'] as Houkou;
    const timetable = (ressya['EkiJikoku'] as string)
      .split(',')
      .map(parseEkiJikoku)
      .map((ekiJikoku, index) => {
        if (!ekiJikoku) {
          return undefined;
        }

        const stationIndex = houkou === 'Kudari' ? index : stations.length - index - 1;
        const station = stations[stationIndex];
        const platform =
          ekiJikoku.bansen !== undefined
            ? station.platforms[ekiJikoku.bansen]
            : station.platforms[0]; /* TODO: これで大丈夫？ */
        let departureTime = ekiJikoku.hatsuJikoku;
        let arrivalTime = ekiJikoku.chakuJikoku ?? departureTime;
        departureTime = departureTime ?? arrivalTime;
        // 通過や経由しないの時とかは時刻がない。。。 => 番線の扱いとか後で対応したい
        // if (departureTime === undefined && arrivalTime === undefined) throw new Error('departureTime and arrivalTime are undefined');
        if (departureTime === undefined && arrivalTime === undefined) {
          return undefined;
        }

        return {
          stationId: station.stationId,
          platformId: platform.platformId,
          arrivalTime: timeToSeconds(arrivalTime as Time) - (arrivalTime === departureTime ? 20 : 0), // 0秒停車はまずい気がするので20秒くらい停車させる
          departureTime: timeToSeconds(departureTime as Time),
        };
      })
      .filter((e) => e !== undefined) as StationTrain[];

    const trainType = ressya['Syubetsu'] !== undefined ? ressyasyubetsus[ressya['Syubetsu']] : undefined;
    const trainTypeName = trainType?.['Syubetsumei'];
    const trainTypeColor = trainType?.['JikokuhyouMojiColor'];
    const trainName =
      (ressya['Ressyabangou'] ?? '') + (trainTypeName ?? '') + (ressya['Ressyamei'] ?? '') + (ressya['Gousuu'] ?? '');

    return {
      trainId: generateId(),
      color: trainTypeColor !== undefined ? '#' + trainTypeColor.substring(2) : undefined,
      trainCode: ressya['Ressyabangou'],
      trainTypeName: trainTypeName,
      trainMei: ressya['Ressyamei'],
      trainGo: ressya['Gousuu'],
      trainName: trainName,
      trainTimetable: timetable,
    };
  });
}

export function getEkiJikokus(oudBuf: string): DiagramExt {
  const oudJson = oudToJson(oudBuf);
  const rosen = oudJson['Rosen'][0];
  const stations = convertEkis(rosen['Eki']);
  const ressyasyubetsus = rosen['Ressyasyubetsu'];
  const dia = rosen['Dia'][0];
  const ressyas = (dia['Kudari'][0]['Ressya'] ?? []).concat(dia['Nobori'][0]['Ressya'] ?? []);
  const trains = convertRessyas(ressyas, stations, ressyasyubetsus);

  return {
    stations,
    trains,
  };
}
