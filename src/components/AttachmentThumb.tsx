import { useEffect, useState } from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { getAttachmentSignedUrl } from '@/lib/data';

export function AttachmentThumb({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAttachmentSignedUrl(filePath)
      .then((signed) => {
        if (!cancelled) setUrl(signed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const placeholderClass = 'grid h-10 w-10 shrink-0 place-items-center rounded bg-ink-100 text-ink-400';

  if (failed) {
    return (
      <span className={placeholderClass} title="Preview unavailable">
        <ImageIcon className="h-4 w-4" />
      </span>
    );
  }
  if (!url) {
    return (
      <span className={placeholderClass}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={fileName}
      loading="lazy"
      className="h-10 w-10 shrink-0 rounded object-cover ring-1 ring-ink-200"
    />
  );
}
