import { RailwayLine } from '../../mapEditorModel';

export function LineInfoPanel({
  railwayLines,
  selectedRailwayLineId,
  setSelectedRailwayLineId,
}: {
  railwayLines: RailwayLine[];
  selectedRailwayLineId: string | null;
  setSelectedRailwayLineId: (id: string) => void;
}) {
  return (
    <>
      <div>
        <h2>路線情報</h2>
        <button
          onClick={() => {
            setSelectedRailwayLineId('__ALL__');
          }}
        >
          全て選択
        </button>
        <ul>
          {railwayLines.map((railwayLine) => {
            return (
              <li
                style={{
                  color:
                    selectedRailwayLineId === railwayLine.railwayLineId || selectedRailwayLineId === '__ALL__'
                      ? 'red'
                      : 'black',
                }}
              >
                <button
                  onClick={() => {
                    setSelectedRailwayLineId(railwayLine.railwayLineId);
                  }}
                >
                  {railwayLine.railwayLineName}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
