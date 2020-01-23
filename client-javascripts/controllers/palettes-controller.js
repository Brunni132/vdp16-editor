import {ImageEditorComponent} from "../components/image-editor-component";
import {
  gameResourceData,
  itemsInRect,
  makeClearRectOperation,
  makeImageWriteOperation,
  makePenWriteOperation,
  makePropertyWriteOperation,
  paletteBitmap,
  paletteNamed,
  runOperation,
} from "../api";
import {ColorSelectorComponent} from "../components/color-selector-component";
import {ImageImportComponent} from "../components/image-import-component";
import {copyToClipboard, getClipboardData} from "../clipboard";
import {ImageEditorController} from "./image-editor-controller";
import {makeRectangleWH} from "../math-utils";

export class PalettesController extends ImageEditorController {
  constructor() {
    super('palettes');
    // 'select' for selection/move, 'pen'|'eyedropper' for writing, 'rect' for rectangular selection
    this.tool = null;
    this.focusedMode = false;
    this.selectedItemName = null;
    this.activeColor = new ColorSelectorComponent('.color-selector-component');
  }

  async onLoad() {
    // TODO Florian -- factor in a common controller that handles the imageEditor, g_undoBuffer, etc.
    this.imageEditor = new ImageEditorComponent(this.element('.palette-editor'), this.itemSelector);
    this.imageEditor.panMode = 'scroll';
    this.imageEditor.onselectitem = this.onSelectItem.bind(this);
    this.imageEditor.onedititem = this.onFocusItem.bind(this);
    this.imageEditor.oneyedropper = this.onEyeDropper.bind(this);
    this.imageEditor.onpenwrite = this.onPenWrite.bind(this);
    this.imageEditor.onswitchtosecondarytool = this.onSwitchedToSecondaryTool.bind(this);
    this.imageEditor.ondrawpixel = (cacheBitmap, x, y, pixel) => cacheBitmap.setPixel(x, y, pixel);
    this.imageEditor.onrequestpathcolor = this.onRequestPathColor.bind(this);
    this.imageEditor.onbakepastedimage = this.onBakePastedImage.bind(this);
    this.imageEditor.onResize();

    this.imageImportComp = new ImageImportComponent('#palettes-body .toolbar');
    this.imageImportComp.onfileloaded = this.onImportImage.bind(this);

    ['select', 'rect', 'pen', 'eyedropper', 'eraser'].forEach(tool =>
      this.element(`.${tool}-button`).onclick = () => this.setTool(tool));
    this.element('.zoom-button').onclick = () => this.imageEditor.resetZoom();

    // On change to palette properties, apply immediately
    ['y', 'h'].forEach(prop => {
      this.element(`.palette-${prop}`).oninput = () =>
        runOperation(makePropertyWriteOperation('palette', this.selectedItemName, prop, parseInt(this.element(`.palette-${prop}`).value)));
    });
    this.element('.palette-name').oninput = () => this.updateName('.palette-name', 'palette');
    this.element('.edit-palette-button').onclick = () => this.onFocusItem(this.imageEditor.getSelectedIndicator());

    this.setTool('select');
  }

  onFocus() {
    super.onFocus();
    this.onChangeState();
  }

  onPeriodicRender() {
    this.imageEditor.render();
  }

  onChangeState() {
    if (!paletteNamed(this.selectedItemName)) this.selectedItemName = null;
    this.updateEditor();
    this.imageEditor.notifyBitmapImageChanged();
  }

  onCopy() {
    const {indicator, rect} = this.imageEditor.onCopy();
    const pixels = new Array((rect.x1 - rect.x0) * (rect.y1 - rect.y0));
    let i = 0;
    for (let y = rect.y0; y < rect.y1; y++)
      for (let x = rect.x0; x < rect.x1; x++, i++)
        pixels[i] = paletteBitmap.getPixel(x, y);
    copyToClipboard('palette', null, rect.x1 - rect.x0, rect.y1 - rect.y0, pixels, pixels);
    return {indicator, rect};
  }

  onCut() {
    const { rect } = this.onCopy();
    runOperation(makeClearRectOperation('palette', rect));
  }

  onKeyDown(e) {
    if (this.imageEditor.onKeyDown(e)) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 'r') this.setTool('rect');
      if (e.key === 'p') this.setTool('pen');
      if (e.key === 'e') this.setTool('eraser');
      if (e.key === 's' || e.key === 'Escape') this.setTool('select');
      if (e.key === 'o') this.setTool('eyedropper');
      if (e.key === 'i') this.imageImportComp.openDialog();
      if (e.key === '1') this.activeColor.add12(-1, 0, 0);
      if (e.key === '2') this.activeColor.add12(1, 0, 0);
      if (e.key === '3') this.activeColor.add12(0, -1, 0);
      if (e.key === '4') this.activeColor.add12(0, 1, 0);
      if (e.key === '5') this.activeColor.add12(0, 0, -1);
      if (e.key === '6') this.activeColor.add12(0, 0, 1);
    }
  }

  onPaste() {
    const item = getClipboardData('palette');
    if (!item) return;
    this.imageEditor.pasteImage({ ...this.imageEditor.getSuggestedPastePosition(), width: item.width, height: item.height, pixels: item.pixels });
  }

  onResize() {
    this.imageEditor.onResize();
    this.onPeriodicRender();
  }

  // ------------------------------ PRIVATE ---------------------------------
  onBakePastedImage(image) {
    const overlaps = itemsInRect(gameResourceData.pals, makeRectangleWH(image.x, image.y, image.width, image.height));
    if (overlaps.length > 0 &&
      !confirm(`The position where you are pasting the palette overlaps with ${overlaps}. Continue?`)) return true;

    runOperation(makeImageWriteOperation('palette', image, this.imageEditor.visibleArea));
  }

  onFocusItem(indicator) {
    this.focusedMode = true;
    this.imageEditor.panMode = 'zoom';
    this.imageEditor.setVisibleArea(0, indicator.y, 16, indicator.h);
    this.setTool('rect');
  }

  onImportImage(png) {
    this.imageEditor.pasteImage({
      ...this.imageEditor.getSuggestedPastePosition(),
      width: png.width,
      height: png.height,
      pixels: pngToPixels32(png.data)
    });
  }

  onEyeDropper(x, y) {
    this.activeColor.setColor32(paletteBitmap.getPixel(x, y));
  }

  onPenWrite(path) {
    runOperation(makePenWriteOperation('palette', this.onRequestPathColor(), path));
  }

  onRequestPathColor() {
    return this.tool === 'pen' ? this.activeColor.getColor32() : 0;
  }

  onSelectItem(indicator) {
    this.selectedItemName = indicator ? indicator.text : null;
    this.updateEditor();
  }

  onSwitchedToSecondaryTool(state) {
    this.setTool(state ? 'eyedropper' : 'pen');
  }

  setTool(tool) {
    // Cannot use hidden tool
    if (this.hasClass(`.${tool}-button`, 'hidden') || this.tool === tool) return;
    // Cancel edit mode
    if (tool === 'select' && this.focusedMode) {
      this.focusedMode = false;
      this.imageEditor.panMode = 'scroll';
      this.imageEditor.resetVisibleArea();
    }
    this.tool = tool;
    this.unsetClass('.toolbar button', 'active');
    this.setClass(`.${this.tool}-button`, 'active');
    this.updateEditor();
  }

  updateEditor() {
    let panel = 'default';
    this.imageEditor.setTool(['eraser'].includes(this.tool) ? 'pen' : this.tool);
    this.imageEditor.setBitmapImage({
      ...paletteBitmap,
      indicators: this.buildIndicatorsArray('pals', { x: 0, w: 16 })
    });

    if (this.tool !== 'select') {
      this.element('.edit-palette-label').innerHTML = this.selectedItemName;
      panel = 'edition';
    }
    else if (this.selectedItemName) {
      const palette = paletteNamed(this.selectedItemName);
      this.element('.palette-name').value = this.selectedItemName;
      ['x', 'y', 'w', 'h'].forEach(prop =>
        this.element(`.palette-${prop}`).value = palette[prop] || 0);
      panel = 'detail';
    }

    this.setClass('.palette-detail-panel', 'hidden', panel !== 'detail');
    this.setClass('.edition-panel', 'hidden', panel !== 'edition');
    this.setClass('.default-panel', 'hidden', panel !== 'default');
  }
}
