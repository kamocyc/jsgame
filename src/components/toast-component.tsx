import './toast.css';

export function ToastComponent({
  message,
  setMessage,
}: {
  message: string | null;
  setMessage: (message: string | null) => void;
}) {
  return (
    <div className='toast' style={{ display: 'flex', justifyContent: 'space-between' }}>
      {message === null ? (
        <></>
      ) : (
        <>
          <div className='toast__message' style={{ display: 'inline-block' }}>
            {message ?? ''}
          </div>
          <div
            className='toast__close-button'
            style={{
              display: 'inline-block',
              backgroundColor: 'red',
              color: 'white',
              padding: '0 5px',
              cursor: 'pointer',
            }}
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
