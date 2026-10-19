/** Board helpers shared by the tool pages. */
export function toggleFullscreen(el?: HTMLElement | null) {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void (el ?? document.documentElement).requestFullscreen();
  } catch {
    // Not available (iOS Safari): the page still works at normal size.
  }
}
