
import { getDiaFreaks } from "./diaFreaksParser.js";
import { Diagram } from "./model.js";
import { getEkiJikokus } from "./oudParser.js";

type FileType = 'oud' | 'diafreaks';

export async function onFileSelectorChange(event: Event): Promise<null | Diagram> {
  return new Promise((resolve) => {
    const file = (event.target as HTMLInputElement).files![0];
    const reader = new FileReader();
    let fileType: FileType | null = null;
    
    reader.addEventListener(
      "load",
      () => {
        console.log(reader.result);
        if (fileType === 'oud') {
          const r = getEkiJikokus(reader.result as string);
          console.log(r);
          resolve(r);
        } else {
          const r = getDiaFreaks(reader.result as string);
          console.log(r)
          resolve(r);
        }
      },
      false
    );
  
    if (file) {
      if (/.*\.oud2?$/.test(file.name)) {
        // oud形式
        fileType = 'oud';
        reader.readAsText(file, "Shift_JIS");
      } else {
        // json形式 (diafreaks)
        fileType = 'diafreaks';
        reader.readAsText(file, "utf-8");
      }
    } else {
      resolve(null);
    }
  });
}