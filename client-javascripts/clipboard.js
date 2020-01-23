import {PNG} from "pngjs/browser";
import {pixels32ToPng} from "./page-utils";

let currentClipboardItem = null;

export function copyToClipboard(type, indicator, width, height, pixels, pixelsForClipboard) {
  currentClipboardItem = { type, indicator, width, height, pixels };
  if (!pixelsForClipboard) return;

  // Write as PNG to the clipboard
  const png = new PNG({width, height});
  pixels32ToPng(png.data, pixelsForClipboard);

  const blob = new Blob([PNG.sync.write(png)], {type : "image/png"});
  const cbItem = new ClipboardItem({ "image/png": blob });
  navigator.clipboard.write([cbItem]);
}

export function copyObjectsToClipboard(objects) {
  // Keep in serialized form in the clipboard to avoid the caller mistakenly modifying them (easier API)
  currentClipboardItem = {type: 'object', objects: JSON.stringify(objects)};
}

export function getClipboardData(type) {
  if (!currentClipboardItem || currentClipboardItem.type !== type) return null;
  if (type === 'object') return {...currentClipboardItem, objects: JSON.parse(currentClipboardItem.objects)};
  return currentClipboardItem;
}
