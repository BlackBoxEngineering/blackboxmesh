export function MobileOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return <div className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden" onClick={onClose} />;
}
