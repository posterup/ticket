-- `Workspace.avatar` held 1–2 initials derived from the name. That produced
-- «سس» for a two-word Persian workspace and read as a bug rather than a logo,
-- so the column now holds an uploaded image URL or nothing at all.
-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "avatar" DROP NOT NULL;

-- Every existing value is initials, not a URL, and rendering one as an <img>
-- src gives a broken image. Anything that is not one of our own stored images
-- is cleared, so those rows fall back to the default icon.
UPDATE "Workspace"
   SET "avatar" = NULL
 WHERE "avatar" IS NOT NULL
   AND "avatar" NOT LIKE 'data:image/%'
   AND "avatar" NOT LIKE 'https://%.public.blob.vercel-storage.com/%';

-- `EventCollaborator.avatar` is a copy of the invitee workspace's, same story.
UPDATE "EventCollaborator"
   SET "avatar" = NULL
 WHERE "avatar" IS NOT NULL
   AND "avatar" NOT LIKE 'data:image/%'
   AND "avatar" NOT LIKE 'https://%.public.blob.vercel-storage.com/%';
