export function LoadingScreen({ ready }) {
  return (
    <div className={`loading-screen ${ready ? 'is-ready' : ''}`} role="status" aria-live="polite">
      <div>
        <span>TEST ENVIRONMENT INITIALIZING</span>
        <strong>HARDIK.RAJOTIYA</strong>
      </div>
    </div>
  );
}
