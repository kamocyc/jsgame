import './toast.css';

export function ToastComponent({
  message,
  setMessage,
}: {
  message: string | null;
  setMessage: (message: string | null) => void;
}) {
  return (
    <div className='toast'>
      {message === null ? (
        <></>
      ) : (
        <>
          <div className='toast__message' style={{ display: 'inline-block' }}>
            {message ?? ''}
          </div>
          <div
            className='toast__close-button'
            style={{ display: 'inline-block' }}
            onClick={() => {
              setMessage(null);
            }}
          >
            ×
          </div>
        </>
      )}
    </div>
  );
}
