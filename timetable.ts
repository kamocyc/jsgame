type Houkou = "Kudari" | "Nobori";

interface Time {
  hour: number;
  minute: number;
}

interface Dia {
  name: string;
  index: number;
}

interface Eki {
  name: string;
  index: number;
}

interface Ressya {
  name: string;
  houkou: Houkou;
}

interface EkiJikoku {
  currentEki: string;
  nextEki: string;
  jikoku: Time;
}

function parseEkiJikoku(jikoku: string): Time | undefined {
  console.log(jikoku);
  
  const result: {
    bansen: number | undefined,
    chakuJikoku: Time | undefined,
    hatsuJikoku: Time | undefined,
    ekiOperation: number | undefined,
  } = {
    bansen: undefined,
    chakuJikoku: undefined,
    hatsuJikoku: undefined,
    ekiOperation: undefined,
  };

  let startIndex = 0;
  let mode = 'bansen';

  for (let i = 0; i < jikoku.length; i++) {
    if (jikoku[i] === ';' || jikoku[i] === '$') {
      
      switch (mode) {
        case 'bansen':
          result.bansen = Number(jikoku.substring(startIndex, i));
          break;
        case 'jikoku':
          const s = jikoku.substring(startIndex, i);
          const s_ = s.split('/').map(ss => parseJikoku(ss));
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
      mode = 'ekiOperation';
    } 
  }

  result.ekiOperation = Number(jikoku.substring(startIndex));

  console.log(result);
  return result.hatsuJikoku;
}

function parseJikoku(text: string): Time | undefined {
  if (text === "") {
    return undefined;
  }
  if (text.length === 3) {
    text = "0" + text;
  }
  const hour = parseInt(text.substring(0, 2));
  const minute = parseInt(text.substring(2));
  return { hour, minute };
}

function getDias(lines: string[]): Dia[] {
  const dias = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "Dia.") {
      const dia = getProperty(lines, i, "DiaName");
      dias.push({ name: dia, index: i });
    }
  }
  return dias;
}

function getEkis(lines: string[]): Eki[] {
  const ekis = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "Eki.") {
      const eki = getProperty(lines, i, "Ekimei");
      ekis.push({ name: eki, index: i });
    }
  }
  return ekis;
}

function getRessyas(lines: string[]): Ressya[] {
  const ressyas = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "Ressya.") {
      const ressya = getProperty(lines, i, "EkiJikoku");
      const houkou: Houkou = getProperty(lines, i, "Houkou") === "Nobori" ? "Nobori" : "Kudari";
      ressyas.push({ name: ressya, houkou });
    }
  }
  return ressyas;
}

function getProperty(lines: string[], i: number, propertyName: string): string {
  const lastIndexOfBlock = getLastIndexOfBlock(lines, i);
  for (let j = i + 1; j < lastIndexOfBlock; j++) {
    const line = lines[j];
    if (line.startsWith(propertyName + "=")) {
      return line.substring(propertyName.length + 1);
    }
  }
  throw new Error("Property not found (" + propertyName + ")");
}

function getLastIndexOfBlock(lines: string[], startIndex: number): number {
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line[line.length - 1] === ".") {
      return i;
    }
  }
  return lines.length;
}

function createKey(s1: string, s2: string): string {
  return s1 + "-" + s2;
}

function getEkiJikokus(audBuf: string, diaName: string | undefined) {
  let lines = audBuf.split(/\r\n|\n/);
  
  const dias = getDias(lines);
  if (diaName === undefined && dias.length > 1) {
    throw new Error("diaName is not specified");
  }

  const dia = diaName === undefined ? dias[0] : dias.find(d => d.name === diaName);
  if (dia === undefined) {
    throw new Error("diaName is not found");
  }

  const ekis = getEkis(lines);
  
  lines = lines.slice(dia.index);
  const ressyas = getRessyas(lines)
    .map(x => {
      return [
        x.name
          .split(',')
          .map(jikoku => {
            if (jikoku === '') {
              return undefined;
            }
            return parseEkiJikoku(jikoku);
          }),
        x.houkou
      ] as const;
    });
  
    var ekiJikokus = new Map<string, Time[]>();

    for (let ekiIndex = 0; ekiIndex < ekis.length - 1; ekiIndex++) {
      ekiJikokus.set(createKey(ekis[ekiIndex].name, ekis[ekiIndex + 1].name), []);
      ekiJikokus.set(createKey(ekis[ekis.length - ekiIndex - 1].name, ekis[ekis.length - ekiIndex - 2].name), []);
    }
    for (const [ressya, houkou] of ressyas) {
      let ekiIndex = 0;
      for (const jikoku of ressya) {
        if (jikoku != null) {
          var adjustedEkiIndex = houkou === "Kudari" ? ekiIndex : ekis.length - 1 - ekiIndex;
          var currentEki = ekis[adjustedEkiIndex];
          var nextEki = ekis[adjustedEkiIndex + (houkou === "Kudari" ? 1 : -1)];
          ekiJikokus.get(createKey(currentEki.name, nextEki.name))!.push(jikoku);
        }
        ekiIndex++;
      }
    }

    return ekiJikokus;
}
