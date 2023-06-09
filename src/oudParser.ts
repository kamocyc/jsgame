import { DiaTime, Operation, Platform, Station, Timetable, Train, TrainType, generateId } from './model';

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
    // 配列にする。同名のものは配列に追加する
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

// 方向
type Houkou = 'Kudari' /* 下り. Outbound */ | 'Nobori' /* 上り. Inbound */;

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

export interface DiaTrainExt extends Train {
  houkou: Houkou;
  // ここらへんはとりあえず後回しにする。
  // operationCode: string | undefined;  // 運用番号
  // trainMei: string | undefined; // 列車名
  // trainGo: string | undefined; // 列車の○号
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
          // 駅扱い（通過、停車、運行無し）
          result.ekiOperation = Number(jikoku.substring(startIndex, i));
          break;
        case 'jikoku':
          // 発着時刻
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
    // 番線
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

function convertEkis(ekis: any[]): Station[] {
  return ekis.map((eki, i) => {
    const station: Station = {
      stationId: generateId(),
      stationName: (eki['Ekimei'] ?? '') as string,
      distance: i * 10 /* TODO: 距離はOudiaSecondでは時間から算出している */,
      platforms: [],
      defaultInboundPlatformId: '', // dummy
      defaultOutboundPlatformId: '', // dummy
    };
    for (const track of eki['EkiTrack2Cont'][0]['EkiTrack2'] as any[]) {
      const platform: Platform = {
        platformId: generateId(),
        platformName: (track['TrackRyakusyou'] ?? track['TrackName'] ?? '') as string,
        station: station,
      };
      station.platforms.push(platform);
    }

    // 上下主本線
    (station as any).defaultOutboundDiaPlatformId = station.platforms[Number(eki['DownMain'])].platformId;
    (station as any).defaultInboundDiaPlatformId = station.platforms[Number(eki['UpMain'])].platformId;

    return station;
  });
}

// 始発駅作業、終着駅作業の変換
// 仕様全体は大きいので、とりあえず必要な部分だけ解釈する http://oudiasecond.seesaa.net/article/467843165.html
function convertOperations(ressha: any): {
  firstOperation?: Operation;
  lastOperation?: Operation;
} {
  const operations: {
    beforeOrAfter: string;
    ekiNumber: number;
    data: string;
  }[] = [];
  for (const [k, v] of Object.entries(ressha)) {
    if (k.startsWith('Operation')) {
      const beforeOrAfter = k.substring(k.length - 1);
      const ekiNumber = Number(k.substring(9, k.length - 1));
      operations.push({
        beforeOrAfter,
        ekiNumber,
        data: v as string,
      });
    }
  }

  operations.sort((a, b) => a.ekiNumber - b.ekiNumber);
  const firstOperationEkiNumber = operations[0].ekiNumber;
  const lastOperationEkiNumber = operations[operations.length - 1].ekiNumber;
  const firstOperationRaw = operations.find(
    (operation) => operation.ekiNumber === firstOperationEkiNumber && operation.beforeOrAfter === 'B'
  );
  const lastOperationRaw = operations.find(
    (operation) => operation.ekiNumber === lastOperationEkiNumber && operation.beforeOrAfter === 'A'
  );

  const convertOperationSub = ({ data }: { data: string }): Operation => {
    const [operationType, remaining] = data.split('/');
    if (operationType === '5') {
      return {
        operationType: 'Connection',
      };
    }

    const [operationTime, operationCode] = remaining.split('$');
    const jikoku = parseJikoku(operationTime);
    return {
      operationType: 'InOut',
      operationTime: jikoku !== undefined ? timeToSeconds(jikoku) : 0,
      operationCode,
    };
  };

  return {
    firstOperation: firstOperationRaw != null ? convertOperationSub(firstOperationRaw) : undefined,
    lastOperation: lastOperationRaw != null ? convertOperationSub(lastOperationRaw) : undefined,
  };
}

function convertRessyas(ressyas: any[], stations: Station[], trainTypes: TrainType[]): DiaTrainExt[] {
  return ressyas.map((ressya) => {
    const houkou = ressya['Houkou'] as Houkou;
    const diaTimes = (ressya['EkiJikoku'] as string)
      .split(',')
      .map(parseEkiJikoku)
      .map((ekiJikoku, index) => {
        if (!ekiJikoku) {
          return undefined;
        }

        const stationIndex = houkou === 'Kudari' ? index : stations.length - index - 1;
        const station = stations[stationIndex];
        const platform = ekiJikoku.bansen !== undefined ? station.platforms[ekiJikoku.bansen] : null;
        const departureTime = ekiJikoku.hatsuJikoku;
        const arrivalTime = ekiJikoku.chakuJikoku;

        return {
          diaTimeId: generateId(),
          arrivalTime: arrivalTime !== undefined ? timeToSeconds(arrivalTime) : null,
          departureTime: departureTime !== undefined ? timeToSeconds(departureTime) : null,
          platform: platform,
          station: station,
          isPassing: ekiJikoku.ekiOperation === 2 /* 2は通過。なお、運行無しのときはデータ自体が無い */,
        };
      })
      .filter((e: DiaTime | undefined) => e !== undefined) as DiaTime[];

    const trainType = ressya['Syubetsu'] !== undefined ? trainTypes[Number(ressya['Syubetsu'])] : undefined;
    const trainName = (ressya['Ressyamei'] ?? '') + (ressya['Gousuu'] != null ? ' ' + ressya['Gousuu'] : '');
    const { firstOperation, lastOperation } = convertOperations(ressya);

    return {
      trainId: generateId(),
      trainType: trainType,
      trainName: trainName,
      diaTimes: diaTimes,
      houkou: houkou,
      trainCode: (ressya['Ressyabangou'] ?? '') as string,
      firstOperation,
      lastOperation,
      // trainMei: ressya['Ressyamei'],
      // trainGo: ressya['Gousuu'],
    };
  });
}

function convertTrainTypes(ressyasyubetsus: any[]): TrainType[] {
  return ressyasyubetsus.map((trainTypeObject) => {
    const trainTypeName = trainTypeObject?.['Syubetsumei'];
    const trainTypeColor = trainTypeObject?.['JikokuhyouMojiColor'];
    return {
      trainTypeId: generateId(),
      trainTypeName: trainTypeName,
      trainTypeColor: '#' + trainTypeColor.substring(2),
    };
  });
}

// 足りない駅の時刻を補完する
function fillMissingTimes(trains: DiaTrainExt[], stations: Station[]): void {
  for (const station of stations) {
    for (const train of trains) {
      const diaTime = train.diaTimes.find((diaTime) => diaTime.station.stationId === station.stationId);
      if (diaTime === undefined) {
        train.diaTimes.push({
          diaTimeId: generateId(),
          station: station,
          platform: null,
          arrivalTime: null,
          departureTime: null,
          isPassing: false,
        });
      }
    }
  }
}

export function getEkiJikokus(oudBuf: string): Timetable {
  const oudJson = oudToJson(oudBuf);
  const rosen = oudJson['Rosen'][0];
  const stations = convertEkis(rosen['Eki']);
  const trainTypes = convertTrainTypes(rosen['Ressyasyubetsu']);
  const dia = rosen['Dia'][0];
  const ressyas = (dia['Kudari'][0]['Ressya'] ?? []).concat(dia['Nobori'][0]['Ressya'] ?? []);
  const trains = convertRessyas(ressyas, stations, trainTypes);
  fillMissingTimes(trains, stations);

  return {
    trainTypes,
    inboundTrains: trains.filter((t) => t.houkou === 'Nobori'),
    outboundTrains: trains.filter((t) => t.houkou === 'Kudari'),
    stations: stations,
  };
}
