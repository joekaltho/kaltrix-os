-- The app only ever reads logos via getPublicUrl(), which is served through
-- the public-bucket URL path and doesn't need a storage.objects SELECT
-- policy at all. This policy was only enabling directory-listing of every
-- uploaded filename via .list(), which nothing in the app uses — remove it.
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;