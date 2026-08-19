/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Public base URL of the Cloudflare R2 media bucket. See MEDIA.md. */
  readonly VITE_R2_PUBLIC_URL?: string
  /** Fallback CDN base, read only when VITE_R2_PUBLIC_URL is empty. */
  readonly VITE_MEDIA_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
