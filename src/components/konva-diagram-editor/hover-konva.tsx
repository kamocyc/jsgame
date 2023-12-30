import { useState } from 'react';
import { Label, Tag, Text } from 'react-konva';
import { DeepReadonly } from 'ts-essentials';

export type HoverKonvaProps = DeepReadonly<{
  x: number;
  y: number;
  message: string;
  isHoverDisplayed: boolean;
  scale: number;
}>;

export function HoverKonva(props: HoverKonvaProps) {
  const { x, y, message, isHoverDisplayed, scale } = props;

  return (
    <>
      {isHoverDisplayed ? (
        <Label x={x} y={y}>
          <Tag
            fill='white'
            listening={false}
            stroke='black'
            strokeWidth={0.5}
            padding={5 / scale}
            shadowColor='black'
            shadowBlur={5 / scale}
            shadowOffset={{ x: 5 / scale, y: 5 / scale }}
            shadowOpacity={0.5}
            width={100}
            height={100}
          />
          <Text text={message} padding={2} fontSize={16 / scale} listening={false} fill='black' />
        </Label>
      ) : (
        <></>
      )}
    </>
  );
}

export type WarningKonvaProps = DeepReadonly<{
  x: number;
  y: number;
  message: string;
  scale: number;
}>;

export function WarningKonva(props: WarningKonvaProps) {
  const { x, y, message, scale } = props;
  const [isHoverDisplayed, setIsHoverDisplayed] = useState(false);

  return (
    <>
      <Text
        text='⚠'
        x={x}
        y={y}
        fontSize={18 / scale}
        fill='red'
        onMouseEnter={() => {
          setIsHoverDisplayed(true);
        }}
        onMouseLeave={() => {
          setIsHoverDisplayed(false);
        }}
      />
      <HoverKonva x={x} y={y} message={message} isHoverDisplayed={isHoverDisplayed} scale={scale} />
    </>
  );
}
