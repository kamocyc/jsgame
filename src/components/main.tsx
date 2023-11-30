import { enablePatches, setAutoFreeze } from 'immer';
import { render } from 'preact';
import { App } from './AppComponent';

enablePatches();
setAutoFreeze(true);

render(<App />, document.getElementById('app') as HTMLElement);
