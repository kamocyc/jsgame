import { useState } from 'preact/hooks';
import './tooltip-component.css';

export function TooltipComponent({ children, content }: { children: any /* Child components */; content: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className='container'>
      <div style={{ cursor: 'default' }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
        {children}
      </div>
      {show ? <div className='tooltip'>{content}</div> : <></>}
    </div>
  );
}
