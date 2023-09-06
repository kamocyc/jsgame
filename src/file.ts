import { JSON_retrocycle } from './cycle';
import { OutlinedTimetable } from './model';
import { getEkiJikokus } from './oudParser';

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

export async function loadFile(event: Event): Promise<null | OutlinedTimetable> {
  return new Promise((resolve) => {
    const file = (event.target as HTMLInputElement).files![0];
    const reader = new FileReader();
    let fileType: FileType | null = null;

    reader.addEventListener(
      'load',
      () => {
        if (fileType === 'oud') {
          const diagram = getEkiJikokus(reader.result as string);
          resolve(diagram);
        } else {
          const rawData = JSON_retrocycle(JSON.parse(reader.result as string));
          if ('timetableData' in rawData) {
            // 独自形式
            console.log(rawData.timetableData.timetable);
            resolve(rawData.timetableData.timetable as OutlinedTimetable);
          } else {
            // diaFreakの対応はとりあえず後回し
            // const diagram = getDiaFreaks(reader.result as string);
            // resolve(diagram);
            console.warn('diaFreaks形式は未対応です');
          }
        }
      },
      false
    );

    if (file) {
      if (/.*\.oud2?$/.test(file.name)) {
        // oud形式
        fileType = 'oud';
        reader.readAsText(file, 'Shift_JIS');
      } else if (/.*\.json$/.test(file.name)) {
        // json形式 (独自 or diafreaks)
        fileType = 'diafreaks';
        reader.readAsText(file, 'utf-8');
      } else {
        resolve(null);
      }
    } else {
      resolve(null);
    }
  });
}
