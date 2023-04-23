// convert the C# program to TypeScript
// using System.Text;
// using System.Xml;

// namespace OuDiaConverter;

// public enum Houkou {
//   Nobori,
//   Kudari,
// }

// public class Time {
//   public int Hour { get; }
//   public int Minute { get; }
//   public Time(int hour, int minute) {
//     Hour = hour;
//     Minute = minute;
//   }
// }

// public class OuDiaConverter
// {
//   static void Main()
//   {
//     var audPath = "D:\\Users\\kamo\\Desktop\\SchedulerTest.oud2";
//     var configPath = "D:\\SteamLibrary\\steamapps\\common\\Cities_Skylines\\TimeTables.xml";

//     var ekiJikokus = GetEkiJikokus(audPath, "てすと");
//     UpdateTrainSchedulerConfig(ekiJikokus, configPath, "Train Line 1");
//   }

//   public static Dictionary<(string, string), List<Time>> GetEkiJikokus(string audPath, string diaName) {
//     System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
//     var lines = File.ReadAllLines(audPath, Encoding.GetEncoding("Shift_JIS")).ToList();

//     var dias = GetDias(lines);
//     if (diaName == null && dias.Count != 1) throw new Exception("ダイヤ名が指定されませんでしたが、ファイルに2つ以上のダイヤが含まれています。");
    
//     var (_, diaSkip) = dias.Where(dia => dia.Item1 == diaName).FirstOrDefault();
//     if (diaSkip == 0) throw new Exception("指定されたダイヤが見つかりません。");

//     var ekis = GetEkis(lines);

//     lines = lines.Skip(diaSkip).ToList();
//     var ressyas =
//       GetRessyas(lines)
//       .Select(x => {
//         var (ressha, houkou) = x;
//         return (
//           ressha.Split(',')
//           .Select(jikoku => {
//             if (jikoku == "") {
//               return null;
//             }
//             return ParseEkiJikoku(jikoku);
//           }),
//           houkou
//         );
//       });
//     // get jikokus of each eki
//     var ekiJikokus = new Dictionary<(string, string), List<Time>>();
//     for(var ekiIndex = 0; ekiIndex < ekis.Count - 1; ekiIndex++) {
//       ekiJikokus[(ekis[ekiIndex], ekis[ekiIndex + 1])] = new List<Time>();
//       ekiJikokus[(ekis[ekis.Count - ekiIndex - 1], ekis[ekis.Count - ekiIndex - 2])] = new List<Time>();
//     }
//     foreach (var (ressya, houkou) in ressyas) {
//       var ekiIndex = 0;
//       foreach (var jikoku in ressya) {
//         if (jikoku != null) {
//           var adjustedEkiIndex = houkou == Houkou.Kudari ? ekiIndex : ekis.Count - 1 - ekiIndex;
//           var currentEki = ekis[adjustedEkiIndex];
//           var nextEki = ekis[adjustedEkiIndex + (houkou == Houkou.Kudari ? 1 : -1)];
//           ekiJikokus[(currentEki, nextEki)].Add(jikoku);
//         }
//         ekiIndex++;
//       }
//     }

//     return ekiJikokus;
//   }
//   public static void UpdateTrainSchedulerConfig(Dictionary<(string, string), List<Time>> ekiJikokus, string configPath, string lineName)
//   {
//     var config = File.ReadAllText(configPath, Encoding.GetEncoding("UTF-8"));
//     var doc = new XmlDocument();
//     doc.LoadXml(config);
//     var root = doc.DocumentElement;
//     var lines = root.SelectNodes("Lines/Line");
//     var line = lines.Cast<XmlNode>().Where(line => line.Attributes["Name"].Value == lineName).FirstOrDefault();
//     if (line == null) throw new Exception($"路線名 {lineName} が見つかりません。");

//     var stops = line.SelectNodes("Stops/Stop");
//     foreach (XmlNode stop in stops) {
//       var currentStation = stop.Attributes["Name"].Value;
//       var nextStation = stop.Attributes["NextName"].Value;
        
//       if (ekiJikokus.ContainsKey((currentStation, nextStation))) {
//         var jikokus = ekiJikokus[(currentStation, nextStation)];
//         var departures = stop.SelectNodes("Departures/Departure");
//         foreach (XmlNode departure in departures) {
//           departure.ParentNode.RemoveChild(departure);
//         }
//         // add jikokus to Departures
//         foreach (var jikoku in jikokus) {
//           var departure = doc.CreateElement("Departure");
//           departure.InnerText = $"{jikoku.Hour:00}{jikoku.Minute:00}";
//           stop.SelectSingleNode("Departures").AppendChild(departure);
//         }
//       } else {
//         Console.WriteLine($"駅{currentStation}から駅{nextStation}へのダイヤが存在しません");
//       }
//     }

//     doc.Save(configPath);
//   }

//   private static List<(string, int)> GetDias(IList<string> lines) {
//     var dias = new List<(string, int)>();
//     for (int i = 0; i < lines.Count; i++) {
//       var line = lines[i];
//       if (line == "Dia.") {
//         var dia = GetProperty(lines, i, "DiaName");
//         dias.Add((dia, i));
//       }
//     }
//     return dias;
//   }

//   private static Time ParseEkiJikoku(string jikoku) {
//     var jikokus = jikoku.Split(';')[1].Split('$')[0].Split('/').Select(j => ParseJikoku(j)).ToList();
//     if (jikokus.Count == 1) {
//       return jikokus[0];
//     } else {
//       return jikokus[1];
//     }
//   }

//   private static Time ParseJikoku(string text) {
//     if (text == "") {
//       return null;
//     }
//     if (text.Length == 3) {
//       text = "0" + text;
//     }
//     var hour = int.Parse(text.Substring(0, 2));
//     var minute = int.Parse(text.Substring(2, 2));
//     return new Time(hour, minute);
//   }

//   private static int GetLastIndexOfBlock(IList<string> lines, int startIndex) {
//     for (int i = startIndex + 1; i < lines.Count; i++) {
//       var line = lines[i];
//       if (line.Last() == '.') {
//         return i;
//       }
//     }
//     return lines.Count;
//   }

//   private static List<string> GetEkis(IList<string> lines) {
//     var ekis = new List<string>();
//     for (int i = 0; i < lines.Count; i++) {
//       var line = lines[i];
//       if (line == "Eki.") {
//         var eki = GetProperty(lines, i, "Ekimei");
//         ekis.Add(eki);
//       }
//     }
//     return ekis;
//   }

//   private static List<(string, Houkou)> GetRessyas(IList<string> lines) {
//     var ressyas = new List<(string, Houkou)>();
//     for (int i = 0; i < lines.Count; i++) {
//       var line = lines[i];
//       if (line == "Ressya.") {
//         var ressya = GetProperty(lines, i, "EkiJikoku");
//         var houkou = GetProperty(lines, i, "Houkou") == "Nobori" ? Houkou.Nobori : Houkou.Kudari;
        
//         ressyas.Add((ressya, houkou));
//       }
//     }
//     return ressyas;
//   }

//   private static string GetProperty(IList<string> lines, int i, string propertyName) {
//     var lastIndexOfBlock = GetLastIndexOfBlock(lines, i);
//     for (int j = i + 1; j < lastIndexOfBlock; j++) {
//       var line = lines[j];
//       if (line.StartsWith(propertyName + "=")) {
//         return line.Substring(propertyName.Length + 1);
//       }
//     }
//     throw new Exception("Property not found (" + propertyName + ")");
//   }
// }

// TypeScript

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
  const jikokus = jikoku.split(";")[1].split("$")[0].split("/").map(j => parseJikoku(j));
  if (jikokus.length === 1) {
    return jikokus[0];
  } else {
    return jikokus[1];
  }
}

function parseJikoku(text: string): Time | undefined {
  if (text === "") {
    return undefined;
  }
  if (text.length === 3) {
    text = "0" + text;
  }
  const hour = parseInt(text.substring(0, 2));
  const minute = parseInt(text.substring(2, 2));
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

function getEkiJikokus(lines: string[], dias: Dia[], ekis: Eki[], ressyas: Ressya[]): EkiJikoku[] {
  const ekiJikokus = [];
  for (let i = 0; i < ressyas.length; i++) {
    const ressya = ressyas[i];
    const ekiJikoku = parseEkiJikoku(ressya.name);
    const currentEki = parseEkiJikoku(ressya.name).currentEki;
    const nextEki = parseEkiJikoku(ressya.name).nextEki;
    ekiJikokus.push({ currentEki, nextEki, jikoku: ekiJikoku });
  }
  return ekiJikokus;
}
