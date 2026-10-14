'use client';

import { ImageUp, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useUploadCustomImage } from '@fanste/collection';
import { MAX_IMAGE_URL_LENGTH, validateCustomImageFile } from '@fanste/core';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { compressImage } from '@/lib/compress-image';

interface ImageFieldProps {
  /** `id` of the URL input, for its label. */
  id: string;
  /** The image URL as typed or uploaded; empty for none. */
  value: string;
  /** A new URL: typed (`immediate: false`), or uploaded or removed (`immediate: true`). */
  onChange: (value: string, options: { immediate: boolean }) => void;
  /** Saves a typed URL, e.g. on blur in an autosaving form. */
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * A photo or cover (FC-13): upload an image (scaled down and compressed to WebP in the browser,
 * then stored in the user's `custom-images` folder) or paste an https address.
 */
export function ImageField({ id, value, onChange, onBlur, invalid, disabled }: ImageFieldProps) {
  const upload = useUploadCustomImage();
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    const problem = validateCustomImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(true);
    try {
      const image = await compressImage(file).catch(() => {
        throw new Error('compress');
      });
      onChange(await upload.mutateAsync(image), { immediate: true });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === 'compress'
          ? 'That image could not be read. Try a JPEG, PNG or WebP file.'
          : 'Could not upload the image. Please try again.',
      );
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => fileInput.current?.click()}
        >
          <ImageUp aria-hidden />
          {busy ? 'Uploading…' : value ? 'Replace photo' : 'Upload photo'}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onClick={() => onChange('', { immediate: true })}
          >
            <Trash2 aria-hidden />
            Remove
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        id={fileId}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Photo file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
        }}
      />
      <Input
        id={id}
        type="url"
        inputMode="url"
        placeholder="or paste an https:// image address"
        maxLength={MAX_IMAGE_URL_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value, { immediate: false })}
        onBlur={onBlur}
        aria-invalid={invalid ? true : undefined}
        disabled={disabled || busy}
      />
    </div>
  );
}
