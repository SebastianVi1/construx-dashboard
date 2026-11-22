/**
 * Whether any `Modal` (dialog, drawer or dock) is open right now: its overlay
 * is in the document. Lets code outside React's tree, such as the end of a
 * spotlight tour, avoid opening a second modal on top of one.
 */
export function isModalOpen(root: Pick<Document, 'querySelector'> = document): boolean {
  return root.querySelector('.modal-overlay') !== null
}
