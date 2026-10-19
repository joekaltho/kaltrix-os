-- Shop listing images (listings.image_url): a dedicated public bucket.
--
-- Why a new bucket instead of `logos`: `logos` lets the browser write directly
-- (owner-prefix insert/update policies), allows GIF, and is capped at 5 MB, so
-- nothing there can check what a file REALLY is. Listing images instead go through
-- /api/listing-images, which authenticates the caller, checks ownership, validates
-- the file's real signature/size/type, and writes with the service role.
--
-- Deliberately NO policies are created on storage.objects for this bucket:
--   * with RLS on and no matching policy, anon/authenticated cannot INSERT, UPDATE
--     or DELETE any object here, so the validation in the route cannot be bypassed
--     by uploading straight to Storage;
--   * a public bucket serves files at /storage/v1/object/public/listing-images/...
--     without a SELECT policy, and without one nobody can LIST the bucket
--     (same reasoning as 20260801231214_tighten_logos_bucket_listing.sql).
--
-- The limits below are a second line of defence behind the route's own checks.
-- 4194304 bytes = 4 MB (kept under Vercel's 4.5 MB request-body limit).
-- Object names are  <owner user id>/<business id>/<uuid>.<jpg|png|webp>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
