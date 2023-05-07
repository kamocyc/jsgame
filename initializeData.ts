
function initializeData() {
  stations.push(...[
    {
      stationId: generateId(),
      stationName: 'A',
      shouldDepart: (train: Train, globalTime: number) => {
        return true;//globalTime % 50 === 0;
      }
    },
  ]);
  
  tracks.push(...[
    ...createBothTrack({
      _begin: { x: 0, y: 0 },
      _nextSwitch: undefined,
      _end: { x: 100, y: 100 },
      _prevSwitch: undefined,
      track: {
        station: null,
      }
    }),
    ...createBothTrack({
      _begin: { x: 100, y: 100 },
      _end: { x: 200, y: 100 },
      _nextSwitch: undefined,
      _prevSwitch: undefined,
      track: {
        station: stations[0]
      }
    })
  ]);
  
  // switches.push(...[
  //   {
  //     switchId: generateId(),
  //     beginTracks: [tracks[0]],
  //     endTracks: [tracks[1]],
  //     _branchedTrackFrom: tracks[1],
  //     _branchedTrackTo: tracks[0],
  //   },
  //   {
  //     switchId: generateId(),
  //     toTracks: [tracks[1], tracks[2]],
  //     fromTracks: [tracks[0], tracks[3]],
  //     _branchedTrackFrom: tracks[0],
  //     _branchedTrackTo: tracks[2],
  //   },
  //   {
  //     switchId: generateId(),
  //     toTracks: [tracks[3]],
  //     fromTracks: [tracks[2]],
  //     _branchedTrackFrom: tracks[2],
  //     _branchedTrackTo: tracks[3],
  //   },
  // ]);
  
  tracks[0]._nextSwitch = switches[1];
  tracks[0]._prevSwitch = switches[0];
  tracks[2]._nextSwitch = switches[2];
  tracks[2]._prevSwitch = switches[1];
  
  // syncBothTrack(tracks[0]);
  // syncBothTrack(tracks[2]);
  
  trains.push(...[
    {
      trainId: generateId(),
      currentTimetableIndex: 0,
      speed: 10,
      track: tracks[0],
      position: { x: 0, y: 0 },
      stationWaitTime: 0,
      wasDeparted: false,
    },
    {
      trainId: generateId(),
      currentTimetableIndex: 0,
      speed: 10,
      track: tracks[1],
      position: { x: 110, y: 100 },
      stationWaitTime: 0,
      wasDeparted: false,
    }
  ]);

  operatingTrains.push(...[
    {
      train: trains[0]
    }
  ]);
  
  // timetable.push(...[{
  //   stationId: stations[0].stationId,
  //   operatingTrain: operatingTrains[0],
  //   departTime: 50,
  // }]);
  
  // stations[0].shouldDepart = (train, globalTime) => {
  //   const ttItems = timetable.filter(tt => tt.station === stations[0] && tt.operatingTrain.train === train);
  //   if (ttItems.length === 0) {
  //     return true;
  //   }
    
  //   const ttItem = ttItems[0];
  
  //   return globalTime % ttItem.departTime === 0;
  // }
}
