import { JSON_retrocycle } from './cycle';
import { Train } from './model';
import { getEkiJikokus } from './oudParser';
import { OutlinedTimetable, OutlinedTimetableData } from './outlinedTimetableData';

export async function loadUtf8File(event: Event): Promise<string | null> {
  return new Promise((resolve) => {
    const file = (event.target as HTMLInputElement).files![0];
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      resolve(reader.result as string);
    });

    if (file) {
      reader.readAsText(file, 'utf-8');
    } else {
      resolve(null);
    }
  });
}

type FileType = 'oud' | 'diafreaks';

export async function importOutdiaFile(event: Event): Promise<null | [OutlinedTimetable, Train[]]> {
  return new Promise((resolve) => {
    const file = (event.target as HTMLInputElement).files![0];
    const reader = new FileReader();

    reader.addEventListener(
      'load',
      () => {
        const [diagram, newTrains] = getEkiJikokus(reader.result as string);
        resolve([diagram, newTrains]);
      },
      false
    );

    if (file) {
      reader.readAsText(file, 'Shift_JIS');
    } else {
      resolve(null);
    }
  });
}

export async function loadCustomFile(file: File): Promise<null | OutlinedTimetableData> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    let fileType: FileType | null = null;

    reader.addEventListener(
      'load',
      () => {
        const rawData = JSON_retrocycle(JSON.parse(reader.result as string));
        if ('timetableData' in rawData) {
          // 独自形式
          console.log(rawData.timetableData);
          rawData.timetableData._trains = new Map(Object.entries(rawData.timetableData._trains));
          resolve(rawData.timetableData as OutlinedTimetableData);
        } else {
          // diaFreakの対応はとりあえず後回し
          // const diagram = getDiaFreaks(reader.result as string);
          // resolve(diagram);
          throw new Error('diaFreaks形式は未対応です');
        }
      },
      false
    );

    if (file) {
      // json形式 (独自 or diafreaks)
      fileType = 'diafreaks';
      reader.readAsText(file, 'utf-8');
    } else {
      resolve(null);
    }
  });
}
