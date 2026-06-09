import { openDesktopQuickCapture } from "./quickCapture";

// tray 메뉴에서 들어오는 Quick Capture 동작과 같은 desktop 진입점을 공유한다.
export async function openQuickCaptureFromDesktopTray() {
  return await openDesktopQuickCapture();
}
