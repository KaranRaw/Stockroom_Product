import { useState } from 'react';
import { ImageOff, Package } from 'lucide-react';

export default function ProductImage({ url, name, large = false }: {
  url?: string | null; name: string; large?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const valid = !!url && url.startsWith('https://');
  const failed = valid && failedUrl === url;
  return <div className={'product-image' + (large ? ' large' : '') + (valid && !failed && loadedUrl !== url ? ' image-loading' : '')}>
    {valid && !failed
      ? <img src={url} alt={name} loading={large ? 'eager' : 'lazy'} referrerPolicy="no-referrer"
          onLoad={() => setLoadedUrl(url)} onError={() => setFailedUrl(url)} />
      : <span className="image-fallback" role="img" aria-label={failed ? 'Image unavailable' : 'No product image'}>
          {failed ? <ImageOff size={large ? 30 : 20} /> : <Package size={large ? 34 : 22} />}
          {large && <small>{failed ? 'Image unavailable' : 'No image added'}</small>}
        </span>}
  </div>;
}
