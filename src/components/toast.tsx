import './toast.css';

export function ToastComponent({ message }: { message: string | null }) {
  return (
    <div className='toast'>
      <div className='toast__message'>{message ?? ''}</div>
    </div>
  );
}
