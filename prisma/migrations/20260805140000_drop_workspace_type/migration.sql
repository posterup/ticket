-- Workspace.type carried no behaviour.
--
-- Four surfaces rendered it as a caption — «کسب‌وکار» or «شخصی» — and not one
-- branched on it. Creating a workspace asked for it first, above the name, as a
-- permanent choice nothing in the product could later change. Removing the
-- question means removing the column it answered.
ALTER TABLE "Workspace" DROP COLUMN "type";
DROP TYPE "WorkspaceType";
