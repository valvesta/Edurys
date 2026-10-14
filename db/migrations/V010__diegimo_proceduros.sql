/* ==========================================================================
   V010 — Pagalbinės procedūros diegimui (admin schema).
   ========================================================================== */

/* Ar gamintojo katalogo versija jau importuota (ir kokios būsenos). */
CREATE PROCEDURE admin.Catalog_FindVersion
    @ManufacturerCode varchar(50),
    @VersionCode      varchar(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT cv.CatalogVersionId, cv.Code AS VersionCode, cv.Status, cv.BundleSha256, cv.PublishedAt
    FROM catalog.CatalogVersion cv
    JOIN catalog.Manufacturer m ON m.ManufacturerId = cv.ManufacturerId
    WHERE m.Code = @ManufacturerCode
      AND (@VersionCode IS NULL OR cv.Code = @VersionCode)
    ORDER BY cv.ImportedAt DESC;
END;
GO
