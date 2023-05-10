import { onFileSelectorChange } from "./file.js";
import { loadTime } from "./recordTime.js";

export function initialize() {
  // drawDiagram_();
  // initialize();
  // initialize2();
  loadTime();

  // const button = document.getElementById('button-slow-speed') as HTMLInputElement;
  // button.onclick = function () {
  //   toJSON();
  //   clearInterval(timeoutId);
  //   if (button.value === 'slow') {
  //     button.value = 'fast';
  //     timeoutId = setInterval(main, 100);
  //   } else {
  //     button.value = 'slow';
  //     timeoutId = setInterval(main, 1000);
  //   }
  // }
  
  const fileSelector = document.getElementById('file-selector')!;
  fileSelector.addEventListener('change', (event) => {
    onFileSelectorChange(event);
  });
}
