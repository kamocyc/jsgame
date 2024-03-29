// import { useEffect } from 'react';
// import { DeepReadonly } from 'ts-essentials';
// import { assert, nn } from '../../common';
// import { StationLike, StationOperation, Train } from '../../model';
// import { OutlinedTimetable, getDirection } from '../../outlinedTimetableData';
// import { MapInfo, TimeInputComponent } from './common-component';
// // import { getDefaultPlatform } from './timetable-util';

// // 入出区等の作業設定
// // 複雑な回送設定などができない。それをやるにはやはりそれ自体を列車として設定する必要がある。 => それのためには、回送に設定する機能だけ追加すれば良さそう。
// // 簡易な設定として残すのはありかも。実際にも車両基地に隣接した駅から始発したりとか、駅に耐泊した列車がそのまま出発とかある。
// // やはり分岐駅設定は欲しい。oudiaを参考に作りたい。
// export function StationOperationSettingComponent({
//   timetable,
//   firstOrLast,
//   stations,
//   train,
//   mapInfo,
//   stationOperation,
//   setStationOperation,
// }: DeepReadonly<{
//   timetable: OutlinedTimetable;
//   firstOrLast: 'First' | 'Last';
//   stations: Map<string, StationLike>;
//   train: Train;
//   mapInfo: MapInfo;
//   stationOperation: StationOperation | undefined;
//   setStationOperation: (stationOperation: StationOperation) => void;
// }>) {
//   useEffect(() => {
//     if (stationOperation === undefined) {
//       setStationOperation({ stationOperationType: 'Connection' });
//     }
//   }, [stationOperation !== undefined]);

//   function getPlatformData(platformId: string) {
//     const platform = mapInfo.getTrackOfPlatform(platformId);
//     assert(platform !== undefined);
//     return {
//       platformId: platformId,
//       trackId: platform.trackId,
//     };
//   }

//   const stationOperation_ = stationOperation ?? { stationOperationType: 'Connection' };
//   const textInOut = firstOrLast === 'First' ? '出区' : '入区';

//   return (
//     <>
//       <div>
//         作業種別:
//         <>
//           <select
//             value={stationOperation_.stationOperationType}
//             onChange={(e) => {
//               const stationOperationType = (e.target as HTMLSelectElement).value;
//               if (stationOperationType === 'Connection') {
//                 setStationOperation({
//                   ...stationOperation_,
//                   stationOperationType: 'Connection',
//                 });
//               } else if (stationOperationType === 'InOut') {
//                 assert(train.diaTimes.length > 0);
//                 const direction = getDirection(timetable, train.trainId);

//                 const firstStationDepartureTime =
//                   train.diaTimes[0].departureTime === null ? 10 * 60 * 60 : train.diaTimes[0].departureTime;
//                 const platformId =
//                   train.diaTimes[0].platformId ??
//                   nn(stations.get(train.diaTimes[0].stationId))?.platforms[0].platformId;
//                 // getDefaultPlatform(train.diaTimes[0].station, direction).platformId;

//                 const diaTime = firstOrLast === 'First' ? train.diaTimes[0] : train.diaTimes[train.diaTimes.length - 1];
//                 setStationOperation({
//                   stationOperationType: 'InOut',
//                   operationTime: firstStationDepartureTime,
//                   stationId: diaTime.stationId,
//                   ...getPlatformData(platformId),
//                 });
//               }
//             }}
//           >
//             <option value='Connection'>接続</option>
//             <option value='InOut'>{textInOut}</option>
//           </select>
//         </>
//       </div>
//       {stationOperation_.stationOperationType === 'InOut' ? (
//         <>
//           <div>
//             駅/車両基地:
//             <>
//               <select
//                 value={stationOperation_.stationId}
//                 onChange={(e) => {
//                   const stationId = (e.target as HTMLSelectElement).value;
//                   const station = stations.find((station) => station.stationId === stationId);
//                   assert(station !== undefined);
//                   assert(station.platforms.length > 0);
//                   const platformId = station.platforms[0].platformId;

//                   setStationOperation({
//                     ...stationOperation_,
//                     ...getPlatformData(platformId),
//                     stationId: stationId,
//                   });
//                 }}
//               >
//                 {stations.map((station) => (
//                   <option value={station.stationId}>{station.stationName}</option>
//                 ))}
//               </select>
//             </>
//           </div>
//           <div>
//             番線:
//             <>
//               <select
//                 value={stationOperation_.platformId}
//                 onChange={(e) => {
//                   const platformId = (e.target as HTMLSelectElement).value;
//                   setStationOperation({
//                     ...stationOperation_,
//                     ...getPlatformData(platformId),
//                   });
//                 }}
//               >
//                 {stations
//                   .find((station) => station.stationId === stationOperation_.stationId)
//                   ?.platforms.map((platform) => (
//                     <option value={platform.platformId}>{platform.platformName}</option>
//                   ))}
//               </select>
//             </>
//           </div>
//           <div>
//             時刻:
//             <>
//               <TimeInputComponent
//                 time={stationOperation_.operationTime}
//                 setTime={(operationTime) => {
//                   if (operationTime != null) {
//                     setStationOperation({
//                       ...stationOperation_,
//                       operationTime: operationTime,
//                     });
//                   }
//                 }}
//               />
//             </>
//           </div>
//         </>
//       ) : (
//         <></>
//       )}
//     </>
//   );
// }
