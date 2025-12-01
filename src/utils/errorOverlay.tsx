// errorOverlay removed; restore previous behavior that does not inject a runtime overlay
export default function installErrorOverlay() {
  return { show: () => {}, hide: () => {} };
}
