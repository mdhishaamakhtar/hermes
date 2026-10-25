/** Hands the browser a file to save under the given name. */
export function saveFile(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: name,
  });
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked a beat later: some browsers read the URL after the click returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
