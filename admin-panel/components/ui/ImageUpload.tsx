'use client';

import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { toast } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api/client';

/**
 * Choosing a picture, for anything that has one.
 *
 * Used by the product form, the variant form and the payment QR. All three
 * talk to the same shape of endpoint - POST a file, DELETE to clear, GET a
 * short-lived preview link - so they share this rather than growing three
 * slightly different file pickers.
 *
 * The checks here are a courtesy, not a defence. The server re-checks the
 * type by its magic number and the size in bytes, because anything a browser
 * says about a file is a claim, not a fact. What this does is stop the owner
 * waiting for an upload that was always going to be refused.
 */

/** The three the server actually stores. SVG is a script container, not a photo. */
const ACCEPT = 'image/png,image/jpeg,image/webp';
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

interface ImageUploadProps {
  /** Where the file goes. POST here, DELETE here, GET here for a preview. */
  endpoint: string;
  /** Whether the row already has a picture, so the control starts honest. */
  hasImage: boolean;
  label?: string;
  hint?: string;
  onChange?: (hasImage: boolean) => void;
}

export function ImageUpload({
  endpoint,
  hasImage,
  label = 'Photo',
  hint,
  onChange,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [present, setPresent] = useState(hasImage);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Fetch the signed link only when there is something to show. A picture
  // that is not there must not look like a broken one.
  useEffect(() => {
    let cancelled = false;
    if (!present) {
      setPreview(null);
      return () => {
        cancelled = true;
      };
    }
    api
      .get<{ url: string | null }>(endpoint)
      .then((data) => {
        if (!cancelled) setPreview(data.url);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, present]);

  async function choose(file: File) {
    if (!ALLOWED.has(file.type)) {
      toast('Only PNG, JPEG and WebP images can be uploaded.', 'error');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast('That image is over 5 MB. Please use a smaller one.', 'error');
      return;
    }

    setBusy('upload');
    try {
      await api.upload(endpoint, file);
      // Only after the server confirmed it. A failed upload leaves the
      // product exactly as it was, and so does this control.
      setPresent(true);
      setPreview(null); // forces the effect to fetch the new signed link
      onChange?.(true);
      toast('Photo uploaded.');
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : 'Could not upload that image.',
        'error'
      );
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy('remove');
    try {
      await api.delete(endpoint);
      setPresent(false);
      setPreview(null);
      onChange?.(false);
      toast('Photo removed.');
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : 'Could not remove that image.',
        'error'
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>

      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy !== null}
              onClick={() => input.current?.click()}
            >
              {busy === 'upload' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              {present ? 'Replace' : 'Upload'}
            </button>

            {present ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={busy !== null}
                onClick={remove}
              >
                {busy === 'remove' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                Remove
              </button>
            ) : null}
          </div>

          <span className="block text-xs text-muted-foreground">
            {hint ?? 'PNG, JPEG or WebP, under 5 MB.'}
          </span>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void choose(file);
        }}
      />
    </div>
  );
}
