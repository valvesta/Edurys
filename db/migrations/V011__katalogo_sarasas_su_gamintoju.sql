/* ==========================================================================
   V011 — Katalogų sąrašas administravimui papildomas gamintojo ID ir
   užsakymų el. paštu (reikia administravimo puslapiui).
   ========================================================================== */
CREATE OR ALTER PROCEDURE api.Catalog_ListVersions
    @ActorUserId int
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30) THROW 51001, N'Neturite teisės.', 1;

    SELECT cv.CatalogVersionId, m.ManufacturerId, m.Code AS ManufacturerCode, m.Name AS ManufacturerName,
           m.OrderEmail AS ManufacturerOrderEmail,
           cv.Code, cv.Name, cv.Status,
           cv.ImportedAt, cv.ImportedBy, cv.PublishedAt, cv.PublishedBy, cv.RetiredAt, cv.BundleSha256,
           (SELECT COUNT(*) FROM catalog.Family f WHERE f.CatalogVersionId = cv.CatalogVersionId) AS Families,
           (SELECT COUNT(*) FROM catalog.Model x WHERE x.CatalogVersionId = cv.CatalogVersionId) AS Models,
           (SELECT COUNT(*) FROM sales.[Order] o WHERE o.CatalogVersionId = cv.CatalogVersionId) AS Orders
    FROM catalog.CatalogVersion cv
    JOIN catalog.Manufacturer m ON m.ManufacturerId = cv.ManufacturerId
    ORDER BY m.Name, cv.ImportedAt DESC;
END;
GO
