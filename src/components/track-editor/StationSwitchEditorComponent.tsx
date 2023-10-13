// import { useState } from 'preact/hooks';
// import { DetailedTimetable, Platform, Switch } from '../../model';
// import { TimeInputComponent } from '../timetable-editor/common-component';
// import { StoredTrain } from './trainMoveBase';

// export function TrainSelector({
//   trains,
//   selectedTrain,
//   setSelectedTrain,
// }: // appStates,
// // update,
// {
//   trains: StoredTrain[];
//   selectedTrain: StoredTrain | null;
//   setSelectedTrain: (train: StoredTrain) => void;
//   // appStates: AppStates;
//   // update: () => void;
// }) {
//   return (
//     <>
//       {/* <>
//       <button onClick={() => {
//         const trainPlaceDirection = appStates.trainPlaceDirection;
//         if (trainPlaceDirection === 'Up') {
//           appStates.trainPlaceDirection = 'Down';
//         } else {
//           appStates.trainPlaceDirection = 'Up';
//         }
//         update();
//       }}>向きを反転</button>
//     </> */}
//       <>
//         列車:
//         <select
//           onChange={(e) => {
//             const placedTrainId = (e.target as HTMLSelectElement).value;
//             const train = trains.find((train) => train.placedTrainId === placedTrainId);
//             if (train) {
//               setSelectedTrain(train);
//             }
//           }}
//         >
//           {trains.map((train) => (
//             <option
//               value={train.placedTrainId}
//               selected={train.placedTrainId === selectedTrain?.placedTrainId ? true : false}
//             >
//               {train.placedTrainName}
//             </option>
//           ))}
//         </select>
//       </>
//     </>
//   );
// }

// export function SwitchEditor({
//   timetable,
//   trains,
//   Switch,
// }: {
//   timetable: DetailedTimetable;
//   trains: StoredTrain[];
//   Switch: Switch;
// }) {
//   const [selectedTrain, setSelectedTrain] = useState<StoredTrain | null>(null);
//   const [_, setUpdate] = useState([]);
//   const ttItems = timetable.switchTTItems.filter(
//     (item) => item.switchId === Switch.switchId && item.placedTrainId === selectedTrain?.placedTrainId
//   );

//   // if (ttItems.length === 0) {
//   //   ttItems.push({
//   //     placedTrainId: selectedTrain.placedTrainId,
//   //     train: null,
//   //     Switch: Switch,
//   //     branchDirection: 'Straight',
//   //     changeTime: null,
//   //   });

//   //   timetable.switchTTItems.push(ttItems[0]);

//   //   setUpdate([]);
//   // }

//   return (
//     <div>
//       <div>
//         <TrainSelector trains={trains} selectedTrain={selectedTrain} setSelectedTrain={setSelectedTrain} />
//       </div>

//       <div style={{ display: 'flex', flexDirection: 'column', margin: '5px' }}>
//         {ttItems.map((ttItem) => (
//           <div style={{ display: 'flex', flexDirection: 'row' }}>
//             <div style={{ padding: '3px', margin: '3px' }}>
//               <TimeInputComponent
//                 setTime={(time) => {
//                   ttItem.changeTime = time;
//                   setUpdate([]);
//                 }}
//                 time={ttItem.changeTime}
//               />
//             </div>
//             <div style={{ borderStyle: 'solid', borderWidth: '2px', borderColor: '#ccc', padding: '3px' }}>
//               <label>
//                 直進
//                 <input
//                   type='radio'
//                   name='switchType'
//                   value='normal'
//                   checked={ttItem.branchDirection === 'Straight'}
//                   onChange={(e) => {
//                     ttItem.branchDirection = 'Straight';
//                     setUpdate([]);
//                   }}
//                 />
//               </label>
//               <label>
//                 分岐
//                 <input
//                   type='radio'
//                   name='switchType'
//                   value='branch'
//                   checked={ttItem.branchDirection === 'Branch'}
//                   onChange={(e) => {
//                     ttItem.branchDirection = 'Branch';
//                     setUpdate([]);
//                   }}
//                 />
//               </label>
//             </div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// function PlatformSelector({
//   platforms,
//   platform,
//   setSelectedPlatform,
// }: {
//   platforms: Platform[];
//   platform: Platform;
//   setSelectedPlatform: (platform: Platform) => void;
// }) {
//   return (
//     <>
//       プラットフォーム:
//       <select
//         onChange={(e) => {
//           const platformId = (e.target as HTMLSelectElement).value;
//           const platform = platforms.find((platform) => platform.platformId === platformId);
//           if (platform) {
//             setSelectedPlatform(platform);
//           }
//         }}
//       >
//         {platforms.map((p) => (
//           <option value={p.platformId} selected={p.platformId === platform.platformId ? true : false}>
//             {p.platformName}
//           </option>
//         ))}
//       </select>
//     </>
//   );
// }

// export function StationEditor({
//   timetable,
//   trains,
//   platform,
//   setPlatform,
//   update,
// }: {
//   timetable: DetailedTimetable;
//   trains: StoredTrain[];
//   platform: Platform;
//   setPlatform: (platform: Platform) => void;
//   update: () => void;
// }) {
//   const [selectedTrain, setSelectedTrain] = useState<StoredTrain | null>(null);
//   const [_, setUpdate_] = useState([]);
//   const setUpdate = () => {
//     setUpdate_([]);
//     update();
//   };

//   const station = platform.station;
//   const ttItems = timetable.platformTTItems.filter(
//     (item) => item.platformId === platform.platformId && item.placedTrainId === selectedTrain?.placedTrainId
//   );

//   return (
//     <div>
//       <div>
//         <div>
//           <input
//             value={station.stationName}
//             onChange={(e) => {
//               station.stationName = (e.target as HTMLInputElement).value;
//               setUpdate();
//             }}
//           />
//         </div>
//         <div>
//           <PlatformSelector platforms={station.platforms} platform={platform} setSelectedPlatform={setPlatform} />
//         </div>
//         <div>
//           <TrainSelector trains={trains} selectedTrain={selectedTrain} setSelectedTrain={setSelectedTrain} />
//         </div>
//       </div>

//       <>
//         {selectedTrain !== null ? (
//           <button
//             onClick={() => {
//               timetable.platformTTItems.push({
//                 placedTrainId: selectedTrain.placedTrainId,
//                 trainId: null,
//                 platformId: platform.platformId,
//                 departureTime: 0,
//                 arrivalTime: 0,
//                 track: null /* TODO: 方向を指定する */,
//               });

//               setUpdate();
//             }}
//           >
//             時刻を追加
//           </button>
//         ) : (
//           <></>
//         )}
//       </>
//       <div style={{ border: '1px', borderStyle: 'solid', padding: '1px', minHeight: '10px' }}>
//         {ttItems.map((item) => (
//           <div>
//             <span style={{ marginRight: '5px' }}>
//               <button
//                 onClick={(e) => {
//                   timetable.platformTTItems = timetable.platformTTItems.filter((item2) => item2 !== item);
//                   setUpdate();
//                 }}
//               >
//                 削除
//               </button>
//             </span>
//             <span>
//               到着時間：
//               <div style={{ display: 'inline-block', paddingRight: '10px' }}>
//                 <TimeInputComponent
//                   time={item.arrivalTime}
//                   setTime={(newTime) => {
//                     item.arrivalTime = newTime;
//                     setUpdate();
//                   }}
//                 />
//               </div>
//             </span>
//             <span>
//               出発時間：
//               <div style={{ display: 'inline-block', paddingRight: '10px' }}>
//                 <TimeInputComponent
//                   time={item.departureTime}
//                   setTime={(newTime) => {
//                     item.departureTime = newTime;
//                     setUpdate();
//                   }}
//                 />
//               </div>
//             </span>
//             {/* <input
//               value={item.departureTime === null ? '' : showGlobalTime(item.departureTime)}
//               onChange={(e) => {
//                 const stringValue = (e.target as HTMLInputElement).value;
//                 const newTime = parseTime(stringValue);
//                 if (newTime) {
//                   item.departureTime = newTime;
//                   setUpdate();
//                 }
//               }}
//             /> */}
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }
