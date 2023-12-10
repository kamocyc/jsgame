import { Fragment } from 'react';
import { Group, Line, Text } from 'react-konva';
import { useRecoilValue } from 'recoil';
import { whileLoop } from '../../common';
import { gridColor, secondWidthAtom, stageStateAtom } from './konva-util';

function TimeGridMinuteLineKonva(props: { secondWidth: number; layerHeight: number; i: number; offset: number }) {
  const { secondWidth, layerHeight, i, offset } = props;

  return (
    <>
      {[
        ...whileLoop(
          1,
          (j) => j < 5,
          (j) => j + 1
        ),
      ].map((j) => {
        return (
          <Line
            id={`grid-line-time-grid-${offset}-${i}-${j}`}
            key={j}
            points={[
              (offset + i * 60 * 10 + j * 2 * 60) * secondWidth,
              0,
              (offset + i * 60 * 10 + j * 2 * 60) * secondWidth,
              layerHeight,
            ]}
            stroke={gridColor + '88'}
            strokeWidth={1}
            dash={[2, 2]}
            listening={false}
          />
        );
      })}
    </>
  );
}

export type TimeGridKonvaProps = {
  layerHeight: number;
};

export function TimeGridKonva(props: TimeGridKonvaProps) {
  const { layerHeight } = props;
  const stageState = useRecoilValue(stageStateAtom);
  const scale = stageState.scale;
  const secondWidth = useRecoilValue(secondWidthAtom);

  return (
    <Group y={-stageState.y / scale}>
      {[
        ...whileLoop(
          0,
          (offset) => offset <= 24 * 60 * 60,
          (offset) => offset + 60 * 60
        ),
      ].map((offset) => {
        const hour = Math.floor(offset / 60 / 60);

        return (
          <Fragment key={offset}>
            <Text
              id={`grid-line-time-grid-text-${offset}`}
              x={offset * secondWidth + 2}
              y={0}
              text={hour.toString()}
              fontSize={20 / scale}
              fontFamily='Calibri'
              fill={gridColor}
              listening={false}
            />
            <Line
              id={`grid-line-time-grid-${offset}`}
              points={[offset * secondWidth, 0, offset * secondWidth, layerHeight]}
              stroke={gridColor}
              strokeWidth={1}
              listening={false}
            />
            <TimeGridMinuteLineKonva i={0} secondWidth={secondWidth} layerHeight={layerHeight} offset={offset} />
            {offset < 24 * 60 * 60 ? (
              <Fragment key={offset}>
                {[
                  ...whileLoop(
                    1,
                    (i) => i < 6,
                    (i) => i + 1
                  ),
                ].map((i) => {
                  return (
                    <Fragment key={i}>
                      <Line
                        id={`grid-line-time-grid-${offset}-${i}`}
                        points={[
                          (offset + i * 60 * 10) * secondWidth,
                          0,
                          (offset + i * 60 * 10) * secondWidth,
                          layerHeight,
                        ]}
                        stroke={gridColor + '88'}
                        strokeWidth={1}
                        listening={false}
                      />
                      <TimeGridMinuteLineKonva
                        i={i}
                        secondWidth={secondWidth}
                        layerHeight={layerHeight}
                        offset={offset}
                      />
                    </Fragment>
                  );
                })}
              </Fragment>
            ) : (
              <></>
            )}
          </Fragment>
        );
      })}
    </Group>
  );
}
