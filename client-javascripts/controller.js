import {element, setClass, unsetClass} from "./page-utils";
import {Component} from "./component";
import {g_undoBuffer} from "./api";

let statusTextTimer;

export function setStatusText(text, timeout = 5000) {
  if (statusTextTimer) clearTimeout(statusTextTimer);
  element('#status-text').innerHTML = text;
  statusTextTimer = timeout
    ? setTimeout(() => element('#status-text').innerHTML = '', timeout)
    : null;
};

export class Controller extends Component {
  constructor(itemClassName) {
    super(`#${itemClassName}-body`);
    this.itemClassName = itemClassName;
    this.firstShown = true;
  }

  // Can return a promise (will only be considered active once resolved)
  async willBecomeActive() {
    unsetClass(`#${this.itemClassName}-body`, 'hidden');
    if (this.firstShown) await this.onLoad();
    this.firstShown = false;
  }
  didBecomeInactive() {
    setClass(`#${this.itemClassName}-body`, 'hidden');
  }
  async willSaveTheGame() {}

  async onLoad() {}
  // Focus/blur indicate that the view is active/inactive while shown on the screen
  // willBecomeActive/inactive indicate that the controller is shown or not
  onBlur() {}
  onFocus() {}
  onKeyDown(e) {}
  onResize() {}
  onUndo() {
    g_undoBuffer.undo();
  }
  onRedo() {
    g_undoBuffer.redo();
  }
  onCut() {}
  onCopy() {}
  onPaste() {}
  onChangeState() {}
}
