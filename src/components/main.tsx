import { setAutoFreeze } from 'immer';
import { render } from 'preact';
import { App } from './AppComponent';

setAutoFreeze(true);

render(<App />, document.getElementById('app') as HTMLElement);
