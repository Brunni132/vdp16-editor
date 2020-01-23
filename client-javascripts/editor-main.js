import {CodeController} from "./controllers/code-controller";
import {PalettesController} from "./controllers/palettes-controller";
import {SpritesController} from "./controllers/sprites-controller";
import {MapsController} from "./controllers/maps-controller";
import {element, elements, isMac, setClass, unsetClass} from "./page-utils";
import {registerTooltip} from "./components/tooltip";
import {
  saveGameResources,
  updateGameCode,
  updateGameResourceData,
  updateMapBitmap,
  updatePaletteBitmap,
  updateSpriteBitmap
} from "./api";
import {setStatusText} from "./controller";

let currentController;
const controllers = {
  code: new CodeController(),
  palettes: new PalettesController(),
  sprites: new SpritesController(),
  maps: new MapsController()
};

function onSelectController(name, el) {
  const item = el.getBoundingClientRect();
  const rect = element('.top-menu .selection-rectangle');
  rect.style.left = `${item.left}px`;
  rect.style.top = `${item.top}px`;
  rect.style.width = `${item.width}px`;
  rect.style.height = `${item.height}px`;
  setClass(el, 'active');
  el.blur();

  if (currentController) {
    unsetClass(`#${currentController.itemClassName}-button`, 'active');
    currentController.onBlur();
    currentController.didBecomeInactive();
  }

  function controllerInitialized() {
    currentController = controllers[name];
    currentController.onFocus();
  }

  currentController = null;
  const promise = controllers[name].willBecomeActive(controllers[name].firstShown);
  if (promise) promise.then(controllerInitialized);
  else controllerInitialized();
}

async function runGame() {
  await saveGame();
  window.open('http://localhost:3000/', 'game');
}

async function saveGame() {
  try {
    setStatusText(`Saving game…`);
    for (let c of Object.values(controllers)) await c.willSaveTheGame();
    await saveGameResources();
    setStatusText(`Game saved (${new Date()})`);
  } catch (e) {
    setStatusText(`Failed to save: ${e}`);
  }
}

export function restoreFunction(state) {
  currentController && currentController.onChangeState(state);
}

window.addEventListener('focus', () => currentController && currentController.onFocus());
window.addEventListener('blur', () => currentController && currentController.onBlur());
window.addEventListener('keydown', e => {
  // Ctrl+R (run)
  if ((isMac() ? e.ctrlKey : e.altKey) && e.key === 'r') {
    runGame();
    e.preventDefault();
  } else if ((isMac() ? e.metaKey : e.ctrlKey) && e.key === 's') {
    saveGame();
    e.preventDefault();
  } else {
    currentController && currentController.onKeyDown(e);
  }
});
window.addEventListener('resize', () => currentController && currentController.onResize());
window.addEventListener('keydown', e => {
  if (isMac()) {
    if (e.metaKey && e.shiftKey && e.key === 'z') {
      currentController && currentController.onRedo();
    } else if (e.metaKey && e.key === 'z') {
      currentController && currentController.onUndo();
    }
  } else if (e.ctrlKey) {
    if (e.ctrlKey && e.key === 'z') {
      currentController && currentController.onUndo();
    } else if (e.ctrlKey && e.key === 'y') {
      currentController && currentController.onRedo();
    }
  }
});
document.addEventListener('cut', () => currentController && currentController.onCut());
document.addEventListener('copy', () => currentController && currentController.onCopy());
document.addEventListener('paste', () => currentController && currentController.onPaste());
registerTooltip();

// Selection effects
elements('.top-menu .item').forEach(el => {
  const name = el.id.replace('-button', '');
  if (controllers[name]) {
    el.addEventListener('click', () => onSelectController(name, el));
  }
  el.addEventListener('mouseover', () => {
    const item = el.getBoundingClientRect();
    const rect = element('.top-menu .active-selection-rectangle');
    rect.style.left = `${item.left}px`;
    rect.style.top = `${item.top}px`;
    rect.style.width = `${item.width}px`;
    rect.style.height = `${item.height}px`;
  });
});

element('.top-menu').addEventListener('mouseout', () => {
  const rect = element('.top-menu .active-selection-rectangle');
  rect.style.left = rect.style.width = rect.style.top = rect.style.height = '0';
});

element('#game-button').addEventListener('click', runGame);

// Load data and save initial undo steps
updateGameResourceData()
  .then(() => updatePaletteBitmap())
  .then(() => updateSpriteBitmap())
  .then(() => updateMapBitmap())
  .then(() => updateGameCode())
  .then(() => {
    onSelectController('code', element('#code-button'));
  });
