import { useState } from 'preact/hooks';

export function SeekBarComponent({
  positionPercentage,
  width,
  setPositionPercentage,
}: {
  positionPercentage: number;
  width: number;
  setPositionPercentage: (positionPercentage: number) => void;
}) {
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);

  return (
    <div
      id='seek-bar'
      style={{ width: width + 'px', height: '20px', backgroundColor: 'aquamarine' }}
      onMouseDown={() => {
        setIsMouseDown(true);
      }}
      onMouseUp={() => {
        setIsMouseDown(false);
      }}
      onMouseMove={(e) => {
        if (!isMouseDown) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let percentage = x / width;
        if (percentage < 0) percentage = 0;
        if (percentage > 1) percentage = 1;
        setPositionPercentage(percentage);
      }}
    >
      <div
        id='seek-bar-item'
        style={{
          width: '6px',
          height: '20px',
          backgroundColor: 'black',
          position: 'relative',
          left: positionPercentage * width + 'px',
        }}
      ></div>
    </div>
  );
}
