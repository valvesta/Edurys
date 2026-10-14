/* ==========================================================================
   V007 — Katalogo procedūros: importas, paskelbimas, eksportas, skaitymas.

   Importas vyksta vienu JSON paketu (formatas aprašytas docs/KATALOGO_PAKETAS.md)
   per admin.Catalog_ImportVersion — viena transakcija: arba įkeliama
   VISKAS, arba NIEKO. Kiekviena kaina prieš įrašant patikrinama, kad turėtų
   ne daugiau kaip 2 skaitmenis po kablelio ir nebūtų neigiama — SQL Server
   tyliai suapvalintų netikslią reikšmę, todėl tikriname patys.

   Eksportas (admin.Catalog_ExportVersion) grąžina TOKIOS PAT struktūros
   paketą, todėl automatinis testas gali palyginti: įkelta == išeksportuota
   == originalus konfigūratorius.
   ========================================================================== */

CREATE PROCEDURE admin.Catalog_ImportVersion
    @BundleJson  nvarchar(max),
    @ImportedBy  nvarchar(200),
    @BundleSha256 char(64)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF ISJSON(@BundleJson) = 0 THROW 51004, N'Paketas nėra teisingas JSON.', 1;
    IF ISNULL(JSON_VALUE(@BundleJson, '$.formatVersion'), '') <> '1' THROW 51004, N'Nepalaikoma paketo versija (tikimasi formatVersion = 1).', 1;
    IF @BundleSha256 IS NULL OR @BundleSha256 LIKE '%[^0-9a-f]%' OR LEN(@BundleSha256) <> 64
        THROW 51004, N'Neteisinga paketo SHA-256 suma.', 1;

    DECLARE @MCode varchar(50)    = JSON_VALUE(@BundleJson, '$.manufacturer.code'),
            @MName nvarchar(200)  = JSON_VALUE(@BundleJson, '$.manufacturer.name'),
            @VCode varchar(50)    = JSON_VALUE(@BundleJson, '$.catalogVersion.code'),
            @VName nvarchar(200)  = JSON_VALUE(@BundleJson, '$.catalogVersion.name'),
            @Cur   char(3)        = JSON_VALUE(@BundleJson, '$.catalogVersion.currencyCode'),
            @VatTx nvarchar(20)   = JSON_VALUE(@BundleJson, '$.catalogVersion.vatRate'),
            @SrcD  nvarchar(500)  = JSON_VALUE(@BundleJson, '$.catalogVersion.sourceDescription'),
            @SrcH  nvarchar(2000) = JSON_QUERY(@BundleJson, '$.catalogVersion.sourceHashes');
    IF @MCode IS NULL OR @MName IS NULL OR @VCode IS NULL OR @VName IS NULL OR @Cur IS NULL OR @VatTx IS NULL
        THROW 51004, N'Pakete trūksta gamintojo arba versijos duomenų.', 1;
    DECLARE @Vat decimal(5,4) = TRY_CONVERT(decimal(5,4), @VatTx);
    IF @Vat IS NULL OR TRY_CONVERT(decimal(18,8), @VatTx) <> @Vat THROW 51004, N'Neteisingas PVM tarifas.', 1;

    /* ---- kainų tikslumo patikra (prieš bet kokį įrašymą) ----
       Kaina skaitoma kaip tekstas ir tikrinama: skaičius, >= 0, ne daugiau
       kaip 2 skaitmenys po kablelio, be eksponentinės formos. */
    DECLARE @BadPrice nvarchar(400) = (
        SELECT TOP (1) src + N': ' + ISNULL(v, N'NULL')
        FROM (
            SELECT N'basePrices' AS src, price AS v FROM OPENJSON(@BundleJson, '$.basePrices') WITH (price nvarchar(50) '$.price')
            UNION ALL SELECT N'glassOptions', price FROM OPENJSON(@BundleJson, '$.glassOptions') WITH (price nvarchar(50) '$.price')
            UNION ALL SELECT N'handleFinishes', price FROM OPENJSON(@BundleJson, '$.handleFinishes') WITH (price nvarchar(50) '$.price')
            UNION ALL SELECT N'handleFinishes.plateKeyPrice', p FROM OPENJSON(@BundleJson, '$.handleFinishes') WITH (p nvarchar(50) '$.plateKeyPrice') WHERE p IS NOT NULL
            UNION ALL SELECT N'handleFinishes.plateCylPrice', p FROM OPENJSON(@BundleJson, '$.handleFinishes') WITH (p nvarchar(50) '$.plateCylPrice') WHERE p IS NOT NULL
            UNION ALL SELECT N'handleFinishes.plateWcPrice', p FROM OPENJSON(@BundleJson, '$.handleFinishes') WITH (p nvarchar(50) '$.plateWcPrice') WHERE p IS NOT NULL
            UNION ALL SELECT N'handleFinishes.plateKeyOrCylPrice', p FROM OPENJSON(@BundleJson, '$.handleFinishes') WITH (p nvarchar(50) '$.plateKeyOrCylPrice') WHERE p IS NOT NULL
        ) x
        WHERE v IS NULL
           OR v LIKE N'%[^0-9.]%'
           OR v LIKE N'%.%.%'
           OR v LIKE N'%.[0-9][0-9][0-9]%'
           OR TRY_CONVERT(decimal(12,2), v) IS NULL);
    IF @BadPrice IS NOT NULL
    BEGIN
        DECLARE @Msg nvarchar(2048) = N'Netiksli arba neteisinga kaina pakete — ' + @BadPrice;
        THROW 51004, @Msg, 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @ManufacturerId int;
        SELECT @ManufacturerId = ManufacturerId FROM catalog.Manufacturer WITH (UPDLOCK, HOLDLOCK) WHERE Code = @MCode;
        IF @ManufacturerId IS NULL
        BEGIN
            INSERT INTO catalog.Manufacturer (Code, Name) VALUES (@MCode, @MName);
            SET @ManufacturerId = SCOPE_IDENTITY();
        END;

        IF EXISTS (SELECT 1 FROM catalog.CatalogVersion WHERE ManufacturerId = @ManufacturerId AND Code = @VCode)
            THROW 51006, N'Tokia katalogo versija jau importuota. Naujai versijai suteikite naują kodą.', 1;

        INSERT INTO catalog.CatalogVersion (ManufacturerId, Code, Name, CurrencyCode, VatRate, Status,
                                            SourceDescription, SourceHashesJson, BundleSha256, ImportedBy)
        VALUES (@ManufacturerId, @VCode, @VName, @Cur, @Vat, 'DRAFT', @SrcD, @SrcH, @BundleSha256, @ImportedBy);
        DECLARE @V int = SCOPE_IDENTITY();

        INSERT INTO catalog.ProductLine (CatalogVersionId, LineCode, Name, ShortName, Eyebrow, CatalogPages, ReversibleBlocks2112, SortOrder)
        SELECT @V, code, name, shortName, eyebrow, catalogPages, reversibleBlocks2112, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.lines') WITH (
            code varchar(30) 'strict $.code', name nvarchar(100) 'strict $.name', shortName nvarchar(50) '$.shortName',
            eyebrow nvarchar(100) '$.eyebrow', catalogPages nvarchar(50) '$.catalogPages',
            reversibleBlocks2112 bit 'strict $.reversibleBlocks2112', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.DoorType (CatalogVersionId, DoorTypeCode, Name, SortOrder)
        SELECT @V, code, name, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.doorTypes') WITH (
            code varchar(20) 'strict $.code', name nvarchar(100) 'strict $.name', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.DecorGroup (CatalogVersionId, DecorGroupCode, Name, SortOrder)
        SELECT @V, code, name, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.decorGroups') WITH (
            code varchar(20) 'strict $.code', name nvarchar(100) 'strict $.name', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.Decor (CatalogVersionId, DecorCode, Name, DecorGroupCode, SortOrder)
        SELECT @V, code, name, groupCode, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.decors') WITH (
            code varchar(40) 'strict $.code', name nvarchar(150) 'strict $.name',
            groupCode varchar(20) 'strict $.groupCode', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.Width (CatalogVersionId, WidthCode, NominalCm, IsNarrow, SortOrder)
        SELECT @V, code, nominalCm, isNarrow, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.widths') WITH (
            code varchar(10) 'strict $.code', nominalCm smallint 'strict $.nominalCm',
            isNarrow bit 'strict $.isNarrow', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.Family (CatalogVersionId, FamilyCode, LineCode, Label, BaseLabel, CatalogPages, Tier, IsPanel,
                                    ExtrasKey, GlassKey, SlidingSingle, SlidingDouble, Allows2112, SortOrder, RulesJson)
        SELECT @V, code, lineCode, label, baseLabel, catalogPages, tier, isPanel,
               extrasKey, glassKey, slidingSingle, slidingDouble, allows2112, sortOrder, rulesJson
        FROM OPENJSON(@BundleJson, 'strict $.families') WITH (
            code varchar(60) 'strict $.code', lineCode varchar(30) 'strict $.lineCode',
            label nvarchar(100) 'strict $.label', baseLabel nvarchar(100) 'strict $.baseLabel',
            catalogPages nvarchar(50) '$.catalogPages', tier tinyint '$.tier', isPanel bit 'strict $.isPanel',
            extrasKey varchar(30) 'strict $.extrasKey', glassKey nvarchar(60) 'strict $.glassKey',
            slidingSingle bit 'strict $.slidingSingle', slidingDouble bit 'strict $.slidingDouble',
            allows2112 bit 'strict $.allows2112', sortOrder int 'strict $.sortOrder',
            rulesJson nvarchar(max) 'strict $.rulesJson');

        INSERT INTO catalog.FamilyDoorType (CatalogVersionId, FamilyCode, DoorTypeCode, SortOrder)
        SELECT @V, familyCode, doorTypeCode, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.familyDoorTypes') WITH (
            familyCode varchar(60) 'strict $.familyCode', doorTypeCode varchar(20) 'strict $.doorTypeCode', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.FamilyWidth (CatalogVersionId, FamilyCode, WidthCode, SortOrder)
        SELECT @V, familyCode, widthCode, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.familyWidths') WITH (
            familyCode varchar(60) 'strict $.familyCode', widthCode varchar(10) 'strict $.widthCode', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.FamilyDecor (CatalogVersionId, FamilyCode, DecorCode, SortOrder)
        SELECT @V, familyCode, decorCode, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.familyDecors') WITH (
            familyCode varchar(60) 'strict $.familyCode', decorCode varchar(40) 'strict $.decorCode', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.Model (CatalogVersionId, FamilyCode, ModelNo, Note, SortOrder)
        SELECT @V, familyCode, modelNo, note, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.models') WITH (
            familyCode varchar(60) 'strict $.familyCode', modelNo smallint 'strict $.modelNo',
            note nvarchar(1000) '$.note', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.ModelBasePrice (CatalogVersionId, FamilyCode, ModelNo, DecorGroupCode, Price)
        SELECT @V, familyCode, modelNo, decorGroupCode, price
        FROM OPENJSON(@BundleJson, 'strict $.basePrices') WITH (
            familyCode varchar(60) 'strict $.familyCode', modelNo smallint 'strict $.modelNo',
            decorGroupCode varchar(20) 'strict $.decorGroupCode', price decimal(12,2) 'strict $.price');

        INSERT INTO catalog.GlassOption (CatalogVersionId, FamilyCode, ModelNo, GlassCode, Name, Price, IsDefault, SortOrder)
        SELECT @V, familyCode, modelNo, code, name, price, isDefault, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.glassOptions') WITH (
            familyCode varchar(60) 'strict $.familyCode', modelNo smallint 'strict $.modelNo',
            code varchar(40) 'strict $.code', name nvarchar(200) 'strict $.name',
            price decimal(12,2) 'strict $.price', isDefault bit 'strict $.isDefault', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.Handle (CatalogVersionId, HandleCode, Name, HasLeftRight, PlateSystem, SortOrder)
        SELECT @V, code, name, hasLeftRight, plateSystem, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.handles') WITH (
            code varchar(60) 'strict $.code', name nvarchar(150) 'strict $.name', hasLeftRight bit 'strict $.hasLeftRight',
            plateSystem varchar(10) 'strict $.plateSystem', sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.HandleFinish (CatalogVersionId, HandleCode, FinishCode, Name, Price,
                                          PlateKeyPrice, PlateCylPrice, PlateWcPrice, PlateKeyOrCylPrice, SortOrder)
        SELECT @V, handleCode, code, name, price, plateKeyPrice, plateCylPrice, plateWcPrice, plateKeyOrCylPrice, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.handleFinishes') WITH (
            handleCode varchar(60) 'strict $.handleCode', code varchar(40) 'strict $.code', name nvarchar(150) 'strict $.name',
            price decimal(12,2) 'strict $.price',
            plateKeyPrice decimal(12,2) '$.plateKeyPrice', plateCylPrice decimal(12,2) '$.plateCylPrice',
            plateWcPrice decimal(12,2) '$.plateWcPrice', plateKeyOrCylPrice decimal(12,2) '$.plateKeyOrCylPrice',
            sortOrder int 'strict $.sortOrder');

        INSERT INTO catalog.RuleDataset (CatalogVersionId, DatasetCode, ContentJson, ContentSha256, SortOrder)
        SELECT @V, code, [json], sha256, sortOrder
        FROM OPENJSON(@BundleJson, 'strict $.datasets') WITH (
            code varchar(60) 'strict $.code', [json] nvarchar(max) 'strict $.json',
            sha256 char(64) 'strict $.sha256', sortOrder int 'strict $.sortOrder');

        /* Kiekių patikra: kiek eilučių pakete, tiek turi būti lentelėse. */
        DECLARE @Mismatch nvarchar(200) = (
            SELECT TOP (1) t
            FROM (VALUES
                (N'lines',           (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.lines')),           (SELECT COUNT(*) FROM catalog.ProductLine    WHERE CatalogVersionId = @V)),
                (N'doorTypes',       (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.doorTypes')),       (SELECT COUNT(*) FROM catalog.DoorType       WHERE CatalogVersionId = @V)),
                (N'decorGroups',     (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.decorGroups')),     (SELECT COUNT(*) FROM catalog.DecorGroup     WHERE CatalogVersionId = @V)),
                (N'decors',          (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.decors')),          (SELECT COUNT(*) FROM catalog.Decor          WHERE CatalogVersionId = @V)),
                (N'widths',          (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.widths')),          (SELECT COUNT(*) FROM catalog.Width          WHERE CatalogVersionId = @V)),
                (N'families',        (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.families')),        (SELECT COUNT(*) FROM catalog.Family         WHERE CatalogVersionId = @V)),
                (N'familyDoorTypes', (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.familyDoorTypes')), (SELECT COUNT(*) FROM catalog.FamilyDoorType WHERE CatalogVersionId = @V)),
                (N'familyWidths',    (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.familyWidths')),    (SELECT COUNT(*) FROM catalog.FamilyWidth    WHERE CatalogVersionId = @V)),
                (N'familyDecors',    (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.familyDecors')),    (SELECT COUNT(*) FROM catalog.FamilyDecor    WHERE CatalogVersionId = @V)),
                (N'models',          (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.models')),          (SELECT COUNT(*) FROM catalog.Model          WHERE CatalogVersionId = @V)),
                (N'basePrices',      (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.basePrices')),      (SELECT COUNT(*) FROM catalog.ModelBasePrice WHERE CatalogVersionId = @V)),
                (N'glassOptions',    (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.glassOptions')),    (SELECT COUNT(*) FROM catalog.GlassOption    WHERE CatalogVersionId = @V)),
                (N'handles',         (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.handles')),         (SELECT COUNT(*) FROM catalog.Handle         WHERE CatalogVersionId = @V)),
                (N'handleFinishes',  (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.handleFinishes')),  (SELECT COUNT(*) FROM catalog.HandleFinish   WHERE CatalogVersionId = @V)),
                (N'datasets',        (SELECT COUNT(*) FROM OPENJSON(@BundleJson, '$.datasets')),        (SELECT COUNT(*) FROM catalog.RuleDataset    WHERE CatalogVersionId = @V))
            ) c (t, inBundle, inDb)
            WHERE inBundle <> inDb);
        IF @Mismatch IS NOT NULL
        BEGIN
            DECLARE @Msg2 nvarchar(2048) = N'Įkeltų eilučių skaičius nesutampa su paketu: ' + @Mismatch;
            THROW 51004, @Msg2, 1;
        END;

        DECLARE @Det nvarchar(max) = (SELECT @MCode AS manufacturer, @VCode AS version, @BundleSha256 AS bundleSha256,
                                             @ImportedBy AS importedBy FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write NULL, 'CATALOG_IMPORTED', 'CatalogVersion', @V, @Det;

        COMMIT TRANSACTION;
        SELECT @V AS CatalogVersionId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Paskelbimas: DRAFT -> PUBLISHED. Ankstesnė to gamintojo paskelbta versija
   tampa RETIRED (lieka galioti jau sudarytiems užsakymams). */
CREATE PROCEDURE admin.Catalog_Publish
    @CatalogVersionId int,
    @PublishedBy      nvarchar(200)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Status varchar(20), @ManufacturerId int;
        SELECT @Status = Status, @ManufacturerId = ManufacturerId
        FROM catalog.CatalogVersion WITH (UPDLOCK, HOLDLOCK) WHERE CatalogVersionId = @CatalogVersionId;
        IF @Status IS NULL THROW 51002, N'Katalogo versija nerasta.', 1;
        IF @Status <> 'DRAFT' THROW 51003, N'Paskelbti galima tik juodraštinę versiją.', 1;

        -- Minimalus pilnumas: kiekvienas modelis turi bent vieną kainą,
        -- kiekviena šeima — bent vieną varčios tipą, plotį ir dekorą.
        IF EXISTS (SELECT 1 FROM catalog.Model m WHERE m.CatalogVersionId = @CatalogVersionId
                   AND NOT EXISTS (SELECT 1 FROM catalog.ModelBasePrice p WHERE p.CatalogVersionId = m.CatalogVersionId
                                   AND p.FamilyCode = m.FamilyCode AND p.ModelNo = m.ModelNo))
            THROW 51004, N'Yra modelių be bazinės kainos.', 1;
        IF EXISTS (SELECT 1 FROM catalog.Family f WHERE f.CatalogVersionId = @CatalogVersionId AND (
                       NOT EXISTS (SELECT 1 FROM catalog.FamilyDoorType x WHERE x.CatalogVersionId = f.CatalogVersionId AND x.FamilyCode = f.FamilyCode)
                    OR NOT EXISTS (SELECT 1 FROM catalog.FamilyWidth    x WHERE x.CatalogVersionId = f.CatalogVersionId AND x.FamilyCode = f.FamilyCode)
                    OR NOT EXISTS (SELECT 1 FROM catalog.FamilyDecor    x WHERE x.CatalogVersionId = f.CatalogVersionId AND x.FamilyCode = f.FamilyCode)
                    OR NOT EXISTS (SELECT 1 FROM catalog.Model          x WHERE x.CatalogVersionId = f.CatalogVersionId AND x.FamilyCode = f.FamilyCode)))
            THROW 51004, N'Yra šeimų be varčios tipų, pločių, dekorų arba modelių.', 1;

        UPDATE catalog.CatalogVersion SET Status = 'RETIRED', RetiredAt = SYSUTCDATETIME()
        WHERE ManufacturerId = @ManufacturerId AND Status = 'PUBLISHED';

        UPDATE catalog.CatalogVersion SET Status = 'PUBLISHED', PublishedAt = SYSUTCDATETIME(), PublishedBy = @PublishedBy
        WHERE CatalogVersionId = @CatalogVersionId;

        DECLARE @Det nvarchar(max) = (SELECT @PublishedBy AS publishedBy FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write NULL, 'CATALOG_PUBLISHED', 'CatalogVersion', @CatalogVersionId, @Det;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Juodraščio pašalinimas (pvz. importuota su klaida). Paskelbtų — negalima. */
CREATE PROCEDURE admin.Catalog_DeleteDraft
    @CatalogVersionId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Status varchar(20);
        SELECT @Status = Status FROM catalog.CatalogVersion WITH (UPDLOCK, HOLDLOCK) WHERE CatalogVersionId = @CatalogVersionId;
        IF @Status IS NULL THROW 51002, N'Katalogo versija nerasta.', 1;
        IF @Status <> 'DRAFT' THROW 51003, N'Ištrinti galima tik juodraštinę versiją.', 1;

        DELETE FROM catalog.RuleDataset    WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.HandleFinish   WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.Handle         WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.GlassOption    WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.ModelBasePrice WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.Model          WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.FamilyDecor    WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.FamilyWidth    WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.FamilyDoorType WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.Family         WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.Width          WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.Decor          WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.DecorGroup     WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.DoorType       WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.ProductLine    WHERE CatalogVersionId = @CatalogVersionId;
        DELETE FROM catalog.CatalogVersion WHERE CatalogVersionId = @CatalogVersionId;

        EXEC audit.usp_Write NULL, 'CATALOG_DRAFT_DELETED', 'CatalogVersion', @CatalogVersionId, NULL;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Eksportas — ta pati struktūra kaip importo paketas. */
CREATE PROCEDURE admin.Catalog_ExportVersion
    @CatalogVersionId int
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @V int = @CatalogVersionId;
    IF NOT EXISTS (SELECT 1 FROM catalog.CatalogVersion WHERE CatalogVersionId = @V)
        THROW 51002, N'Katalogo versija nerasta.', 1;

    DECLARE @Json nvarchar(max) = (
        SELECT
            1 AS formatVersion,
            -- JSON_QUERY būtinas: be jo WITHOUT_ARRAY_WRAPPER rezultatas būtų įterptas kaip tekstas
            JSON_QUERY((SELECT m.Code AS code, m.Name AS name
             FROM catalog.Manufacturer m WHERE m.ManufacturerId = cv.ManufacturerId
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS manufacturer,
            JSON_QUERY((SELECT cv.Code AS code, cv.Name AS name, cv.CurrencyCode AS currencyCode, cv.VatRate AS vatRate,
                    cv.SourceDescription AS sourceDescription, JSON_QUERY(cv.SourceHashesJson) AS sourceHashes,
                    cv.Status AS status, cv.CatalogVersionId AS catalogVersionId, cv.BundleSha256 AS bundleSha256
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)) AS catalogVersion,
            JSON_QUERY(ISNULL((SELECT LineCode AS code, Name AS name, ShortName AS shortName, Eyebrow AS eyebrow,
                    CatalogPages AS catalogPages, SortOrder AS sortOrder, ReversibleBlocks2112 AS reversibleBlocks2112
                FROM catalog.ProductLine WHERE CatalogVersionId = @V ORDER BY SortOrder FOR JSON PATH), N'[]')) AS lines,
            JSON_QUERY(ISNULL((SELECT DoorTypeCode AS code, Name AS name, SortOrder AS sortOrder
                FROM catalog.DoorType WHERE CatalogVersionId = @V ORDER BY SortOrder FOR JSON PATH), N'[]')) AS doorTypes,
            JSON_QUERY(ISNULL((SELECT DecorGroupCode AS code, Name AS name, SortOrder AS sortOrder
                FROM catalog.DecorGroup WHERE CatalogVersionId = @V ORDER BY SortOrder FOR JSON PATH), N'[]')) AS decorGroups,
            JSON_QUERY(ISNULL((SELECT DecorCode AS code, Name AS name, DecorGroupCode AS groupCode, SortOrder AS sortOrder
                FROM catalog.Decor WHERE CatalogVersionId = @V ORDER BY DecorGroupCode, SortOrder FOR JSON PATH), N'[]')) AS decors,
            JSON_QUERY(ISNULL((SELECT WidthCode AS code, NominalCm AS nominalCm, IsNarrow AS isNarrow, SortOrder AS sortOrder
                FROM catalog.Width WHERE CatalogVersionId = @V ORDER BY SortOrder FOR JSON PATH), N'[]')) AS widths,
            JSON_QUERY(ISNULL((SELECT FamilyCode AS code, LineCode AS lineCode, Label AS label, BaseLabel AS baseLabel,
                    CatalogPages AS catalogPages, Tier AS tier, IsPanel AS isPanel, ExtrasKey AS extrasKey, GlassKey AS glassKey,
                    SlidingSingle AS slidingSingle, SlidingDouble AS slidingDouble, Allows2112 AS allows2112,
                    SortOrder AS sortOrder, RulesJson AS rulesJson
                FROM catalog.Family WHERE CatalogVersionId = @V ORDER BY SortOrder FOR JSON PATH), N'[]')) AS families,
            JSON_QUERY(ISNULL((SELECT FamilyCode AS familyCode, DoorTypeCode AS doorTypeCode, SortOrder AS sortOrder
                FROM catalog.FamilyDoorType WHERE CatalogVersionId = @V ORDER BY FamilyCode, SortOrder FOR JSON PATH), N'[]')) AS familyDoorTypes,
            JSON_QUERY(ISNULL((SELECT FamilyCode AS familyCode, WidthCode AS widthCode, SortOrder AS sortOrder
                FROM catalog.FamilyWidth WHERE CatalogVersionId = @V ORDER BY FamilyCode, SortOrder FOR JSON PATH), N'[]')) AS familyWidths,
            JSON_QUERY(ISNULL((SELECT FamilyCode AS familyCode, DecorCode AS decorCode, SortOrder AS sortOrder
                FROM catalog.FamilyDecor WHERE CatalogVersionId = @V ORDER BY FamilyCode, SortOrder FOR JSON PATH), N'[]')) AS familyDecors,
            JSON_QUERY(ISNULL((SELECT FamilyCode AS familyCode, ModelNo AS modelNo, Note AS note, SortOrder AS sortOrder
                FROM catalog.Model WHERE CatalogVersionId = @V ORDER BY FamilyCode, SortOrder FOR JSON PATH), N'[]')) AS models,
            JSON_QUERY(ISNULL((SELECT FamilyCode AS familyCode, ModelNo AS modelNo, DecorGroupCode AS decorGroupCode, Price AS price
                FROM catalog.ModelBasePrice WHERE CatalogVersionId = @V ORDER BY FamilyCode, ModelNo, DecorGroupCode FOR JSON PATH), N'[]')) AS basePrices,
            JSON_QUERY(ISNULL((SELECT FamilyCode AS familyCode, ModelNo AS modelNo, GlassCode AS code, Name AS name,
                    Price AS price, IsDefault AS isDefault, SortOrder AS sortOrder
                FROM catalog.GlassOption WHERE CatalogVersionId = @V ORDER BY FamilyCode, ModelNo, SortOrder FOR JSON PATH), N'[]')) AS glassOptions,
            JSON_QUERY(ISNULL((SELECT HandleCode AS code, Name AS name, HasLeftRight AS hasLeftRight, PlateSystem AS plateSystem, SortOrder AS sortOrder
                FROM catalog.Handle WHERE CatalogVersionId = @V ORDER BY SortOrder FOR JSON PATH), N'[]')) AS handles,
            JSON_QUERY(ISNULL((SELECT HandleCode AS handleCode, FinishCode AS code, Name AS name, Price AS price,
                    PlateKeyPrice AS plateKeyPrice, PlateCylPrice AS plateCylPrice, PlateWcPrice AS plateWcPrice,
                    PlateKeyOrCylPrice AS plateKeyOrCylPrice, SortOrder AS sortOrder
                FROM catalog.HandleFinish WHERE CatalogVersionId = @V ORDER BY HandleCode, SortOrder FOR JSON PATH), N'[]')) AS handleFinishes,
            JSON_QUERY(ISNULL((SELECT DatasetCode AS code, ContentJson AS [json], ContentSha256 AS sha256, SortOrder AS sortOrder
                FROM catalog.RuleDataset WHERE CatalogVersionId = @V ORDER BY SortOrder FOR JSON PATH), N'[]')) AS datasets
        FROM catalog.CatalogVersion cv
        WHERE cv.CatalogVersionId = @V
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    SELECT @Json AS BundleJson;
END;
GO

/* ---- programai skirtos katalogo procedūros ---- */

CREATE PROCEDURE api.Catalog_ListPublished
    @ActorUserId int
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId)) THROW 51001, N'Neturite teisės.', 1;

    SELECT m.ManufacturerId, m.Code AS ManufacturerCode, m.Name AS ManufacturerName,
           cv.CatalogVersionId, cv.Code AS VersionCode, cv.Name AS VersionName, cv.CurrencyCode, cv.VatRate, cv.PublishedAt
    FROM catalog.CatalogVersion cv
    JOIN catalog.Manufacturer m ON m.ManufacturerId = cv.ManufacturerId
    WHERE cv.Status = 'PUBLISHED' AND m.IsActive = 1
    ORDER BY m.Name;
END;
GO

/* Katalogo turinys konfigūratoriui. Paskelbtas ir išimtas versijas gali
   skaityti bet kuris aktyvus naudotojas (išimtos reikalingos seniems
   užsakymams peržiūrėti), juodraščius — tik administratoriai. */
CREATE PROCEDURE api.Catalog_GetVersion
    @ActorUserId      int,
    @CatalogVersionId int
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Level tinyint;
    SELECT @Level = RoleLevel FROM iam.tvf_Actor(@ActorUserId);
    IF @Level IS NULL THROW 51001, N'Neturite teisės.', 1;

    DECLARE @Status varchar(20);
    SELECT @Status = Status FROM catalog.CatalogVersion WHERE CatalogVersionId = @CatalogVersionId;
    IF @Status IS NULL THROW 51002, N'Katalogo versija nerasta.', 1;
    IF @Status = 'DRAFT' AND @Level < 30 THROW 51001, N'Neturite teisės.', 1;

    EXEC admin.Catalog_ExportVersion @CatalogVersionId = @CatalogVersionId;
END;
GO

CREATE PROCEDURE api.Catalog_ListVersions
    @ActorUserId int
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30) THROW 51001, N'Neturite teisės.', 1;

    SELECT cv.CatalogVersionId, m.Code AS ManufacturerCode, m.Name AS ManufacturerName, cv.Code, cv.Name, cv.Status,
           cv.ImportedAt, cv.ImportedBy, cv.PublishedAt, cv.PublishedBy, cv.RetiredAt, cv.BundleSha256,
           (SELECT COUNT(*) FROM catalog.Family f WHERE f.CatalogVersionId = cv.CatalogVersionId) AS Families,
           (SELECT COUNT(*) FROM catalog.Model x WHERE x.CatalogVersionId = cv.CatalogVersionId) AS Models,
           (SELECT COUNT(*) FROM sales.[Order] o WHERE o.CatalogVersionId = cv.CatalogVersionId) AS Orders
    FROM catalog.CatalogVersion cv
    JOIN catalog.Manufacturer m ON m.ManufacturerId = cv.ManufacturerId
    ORDER BY m.Name, cv.ImportedAt DESC;
END;
GO

/* Gamintojo el. paštas užsakymams (ADMIN+). */
CREATE PROCEDURE api.Manufacturer_SetOrderEmail
    @ActorUserId    int,
    @ManufacturerId int,
    @OrderEmail     nvarchar(320)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30) THROW 51001, N'Neturite teisės.', 1;
    SET @OrderEmail = LOWER(NULLIF(LTRIM(RTRIM(@OrderEmail)), N''));
    IF @OrderEmail IS NOT NULL AND (@OrderEmail NOT LIKE N'_%@_%._%' OR @OrderEmail LIKE N'% %')
        THROW 51004, N'Neteisingas el. pašto adresas.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Old nvarchar(320);
        SELECT @Old = OrderEmail FROM catalog.Manufacturer WITH (UPDLOCK) WHERE ManufacturerId = @ManufacturerId;
        IF @@ROWCOUNT = 0 THROW 51002, N'Gamintojas nerastas.', 1;
        UPDATE catalog.Manufacturer SET OrderEmail = @OrderEmail WHERE ManufacturerId = @ManufacturerId;
        DECLARE @Det nvarchar(max) = (SELECT @Old AS fromEmail, @OrderEmail AS toEmail FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @ActorUserId, 'MANUFACTURER_EMAIL_CHANGED', 'Manufacturer', @ManufacturerId, @Det;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Sistemos nustatymai (tik GLOBAL_ADMIN). */
CREATE PROCEDURE api.Setting_Set
    @ActorUserId  int,
    @SettingKey   varchar(60),
    @SettingValue nvarchar(1000)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 40) THROW 51001, N'Neturite teisės.', 1;
    SET @SettingValue = NULLIF(LTRIM(RTRIM(@SettingValue)), N'');
    IF @SettingKey = 'ADMIN_NOTIFY_EMAIL' AND @SettingValue IS NOT NULL AND (@SettingValue NOT LIKE N'_%@_%._%' OR @SettingValue LIKE N'% %')
        THROW 51004, N'Neteisingas el. pašto adresas.', 1;
    IF @SettingKey = 'APP_BASE_URL' AND @SettingValue IS NOT NULL AND @SettingValue NOT LIKE N'https://%'
        THROW 51004, N'Adresas turi prasidėti https://', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Old nvarchar(1000);
        SELECT @Old = SettingValue FROM notify.Setting WITH (UPDLOCK) WHERE SettingKey = @SettingKey;
        IF @@ROWCOUNT = 0 THROW 51002, N'Nežinomas nustatymas.', 1;
        UPDATE notify.Setting SET SettingValue = @SettingValue, UpdatedAt = SYSUTCDATETIME() WHERE SettingKey = @SettingKey;
        DECLARE @Det nvarchar(max) = (SELECT @Old AS fromValue, @SettingValue AS toValue FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @ActorUserId, 'SETTING_CHANGED', 'Setting', @SettingKey, @Det;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE PROCEDURE api.Setting_List
    @ActorUserId int
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30) THROW 51001, N'Neturite teisės.', 1;
    SELECT SettingKey, SettingValue, Description, UpdatedAt FROM notify.Setting ORDER BY SettingKey;
END;
GO
