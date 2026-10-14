/* ==========================================================================
   V008 — Užsakymų procedūros.

   Kas ką mato:
     ADMIN / GLOBAL_ADMIN — visus užsakymus;
     COMPANY_REP          — visus savo įmonės užsakymus;
     USER                 — tik savo sukurtus užsakymus.

   Kainos: eilutės suma be PVM APSKAIČIUOJAMA ČIA iš kainos išskaidymo
   eilučių (PriceBreakdownJson[].sum), o ne priimama kaip atskiras skaičius.
   PVM — kiekvienai eilutei, apvalinant iki centų (ROUND, decimal tikslumu),
   užsakymo sumos — eilučių sumos. Kainas (išskaidymą) API turi apskaičiuoti
   SERVERYJE tuo pačiu varikliu (engine.js) iš katalogo duomenų bazėje —
   niekada nepriimti kainų iš naršyklės.
   ========================================================================== */

/* Prieigos prie užsakymo teisės. Tuščias rezultatas = nėra prieigos. */
CREATE FUNCTION sales.tvf_OrderAccess (@ActorUserId int, @OrderId int)
RETURNS TABLE
AS
RETURN
    SELECT o.OrderId,
           CAST(CASE WHEN o.CreatedByUserId = a.UserId THEN 1 ELSE 0 END AS bit)                   AS IsOwner,
           CAST(CASE WHEN a.RoleLevel = 20 AND o.CompanyId = a.CompanyId THEN 1 ELSE 0 END AS bit)  AS IsCompanyRep,
           CAST(CASE WHEN a.RoleLevel >= 30 THEN 1 ELSE 0 END AS bit)                               AS IsAdmin
    FROM sales.[Order] o
    CROSS JOIN iam.tvf_Actor(@ActorUserId) a
    WHERE o.OrderId = @OrderId
      AND (    a.RoleLevel >= 30
           OR (a.RoleLevel = 20 AND o.CompanyId = a.CompanyId)
           OR (o.CreatedByUserId = a.UserId AND o.CompanyId = a.CompanyId));
GO

/* Kokius statusus veikėjas gali nustatyti šiam užsakymui dabar. */
CREATE FUNCTION sales.tvf_AllowedTransitions (@ActorUserId int, @OrderId int)
RETURNS TABLE
AS
RETURN
    SELECT t.ToStatus, s.Name AS ToStatusName, t.RequiresComment
    FROM sales.[Order] o
    JOIN sales.tvf_OrderAccess(@ActorUserId, @OrderId) acc ON acc.OrderId = o.OrderId
    JOIN sales.OrderStatusTransition t ON t.FromStatus = o.StatusCode
    JOIN sales.OrderStatus s ON s.StatusCode = t.ToStatus
    WHERE o.OrderId = @OrderId
      AND (   (t.AllowOwner = 1 AND acc.IsOwner = 1)
           OR (t.AllowCompanyRep = 1 AND acc.IsCompanyRep = 1)
           OR (t.AllowAdmin = 1 AND acc.IsAdmin = 1));
GO

/* Ar galima keisti užsakymo turinį (eilutes, antraštę). */
CREATE FUNCTION sales.tvf_CanEditOrder (@ActorUserId int, @OrderId int)
RETURNS TABLE
AS
RETURN
    SELECT acc.OrderId
    FROM sales.tvf_OrderAccess(@ActorUserId, @OrderId) acc
    WHERE acc.IsOwner = 1 OR acc.IsCompanyRep = 1 OR acc.IsAdmin = 1;
GO

/* --------------------------------------------------------------------------
   Užsakymo sukūrimas (juodraštis)
   -------------------------------------------------------------------------- */
CREATE PROCEDURE api.Order_CreateDraft
    @ActorUserId       int,
    @CatalogVersionId  int,
    @CompanyId         int = NULL,
    @CustomerReference nvarchar(100) = NULL,
    @Notes             nvarchar(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ALevel tinyint, @ACompanyId int;
    SELECT @ALevel = RoleLevel, @ACompanyId = CompanyId FROM iam.tvf_Actor(@ActorUserId);
    IF @ALevel IS NULL THROW 51001, N'Neturite teisės.', 1;

    IF @ALevel >= 30
    BEGIN
        IF @CompanyId IS NULL THROW 51004, N'Nurodykite, kuriai įmonei kuriamas užsakymas.', 1;
    END
    ELSE
    BEGIN
        IF @CompanyId IS NOT NULL AND @CompanyId <> @ACompanyId THROW 51001, N'Galite kurti užsakymus tik savo įmonei.', 1;
        SET @CompanyId = @ACompanyId;
    END;

    IF NOT EXISTS (SELECT 1 FROM org.Company WHERE CompanyId = @CompanyId AND Status = 'ACTIVE')
        THROW 51002, N'Įmonė nerasta arba neaktyvi.', 1;

    DECLARE @Cur char(3), @Vat decimal(5,4);
    SELECT @Cur = CurrencyCode, @Vat = VatRate FROM catalog.CatalogVersion
    WHERE CatalogVersionId = @CatalogVersionId AND Status = 'PUBLISHED';
    IF @Cur IS NULL THROW 51003, N'Katalogo versija nerasta arba nebegalioja.', 1;

    SET @CustomerReference = NULLIF(LTRIM(RTRIM(@CustomerReference)), N'');
    SET @Notes = NULLIF(LTRIM(RTRIM(@Notes)), N'');

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Seq int = NEXT VALUE FOR sales.OrderNumberSeq;
        DECLARE @SeqTxt varchar(10) = CAST(@Seq AS varchar(10));
        IF LEN(@SeqTxt) < 6 SET @SeqTxt = REPLICATE('0', 6 - LEN(@SeqTxt)) + @SeqTxt;
        DECLARE @OrderNumber varchar(20) = CAST(YEAR(SYSUTCDATETIME()) AS varchar(4)) + '-' + @SeqTxt;

        INSERT INTO sales.[Order] (OrderNumber, CompanyId, CreatedByUserId, CatalogVersionId, StatusCode,
                                   CustomerReference, Notes, CurrencyCode, VatRate, UpdatedByUserId)
        VALUES (@OrderNumber, @CompanyId, @ActorUserId, @CatalogVersionId, 'DRAFT',
                @CustomerReference, @Notes, @Cur, @Vat, @ActorUserId);
        DECLARE @OrderId int = SCOPE_IDENTITY();

        INSERT INTO sales.OrderStatusHistory (OrderId, FromStatus, ToStatus, ChangedByUserId)
        VALUES (@OrderId, NULL, 'DRAFT', @ActorUserId);

        DECLARE @Det nvarchar(max) = (SELECT @OrderNumber AS orderNumber, @CompanyId AS companyId,
                                             @CatalogVersionId AS catalogVersionId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @ActorUserId, 'ORDER_CREATED', 'Order', @OrderId, @Det;

        COMMIT TRANSACTION;
        SELECT @OrderId AS OrderId, @OrderNumber AS OrderNumber, 1 AS Revision;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Antraštės keitimas (tik juodraštyje)
   -------------------------------------------------------------------------- */
CREATE PROCEDURE api.Order_UpdateHeader
    @ActorUserId       int,
    @OrderId           int,
    @ExpectedRevision  int,
    @CustomerReference nvarchar(100) = NULL,
    @Notes             nvarchar(2000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NOT EXISTS (SELECT 1 FROM sales.tvf_CanEditOrder(@ActorUserId, @OrderId))
        THROW 51001, N'Neturite teisės arba užsakymas nerastas.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Status varchar(30), @Rev int;
        SELECT @Status = StatusCode, @Rev = Revision FROM sales.[Order] WITH (UPDLOCK, HOLDLOCK) WHERE OrderId = @OrderId;
        IF @Rev <> @ExpectedRevision THROW 51005, N'Užsakymą jau pakeitė kitas naudotojas. Atnaujinkite puslapį.', 1;
        IF NOT EXISTS (SELECT 1 FROM sales.OrderStatus WHERE StatusCode = @Status AND IsEditable = 1)
            THROW 51003, N'Užsakymo keisti nebegalima — jis jau pateiktas.', 1;

        UPDATE sales.[Order]
        SET CustomerReference = NULLIF(LTRIM(RTRIM(@CustomerReference)), N''),
            Notes = NULLIF(LTRIM(RTRIM(@Notes)), N''),
            UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @ActorUserId, Revision = Revision + 1
        WHERE OrderId = @OrderId;

        EXEC audit.usp_Write @ActorUserId, 'ORDER_HEADER_UPDATED', 'Order', @OrderId, NULL;
        COMMIT TRANSACTION;
        SELECT Revision FROM sales.[Order] WHERE OrderId = @OrderId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Eilučių išsaugojimas: pakeičia VISAS užsakymo eilutes vienu kartu
   (atomiškai). Ankstesnės versijos lieka sales.OrderLineHistory.

   @LinesJson — masyvas:
   [{ "familyCode": "WERBENA", "modelNo": 4, "description": "...", "quantity": 2,
      "engineVersion": "engine-2026-09-23",
      "configuration": { ... pilni pasirinkimai ... },
      "priceBreakdown": [ { "no": "1.1", "desc": "...", "qty": 2, "unit": "vnt.",
                            "unitPrice": 415.50, "sum": 831.00 }, ... ] }, ...]
   -------------------------------------------------------------------------- */
CREATE PROCEDURE api.Order_SaveLines
    @ActorUserId      int,
    @OrderId          int,
    @ExpectedRevision int,
    @LinesJson        nvarchar(max)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM sales.tvf_CanEditOrder(@ActorUserId, @OrderId))
        THROW 51001, N'Neturite teisės arba užsakymas nerastas.', 1;
    IF @LinesJson IS NULL OR ISJSON(@LinesJson) = 0 OR LEFT(LTRIM(@LinesJson), 1) <> N'['
        THROW 51004, N'Eilutės turi būti pateiktos JSON masyvu.', 1;

    DECLARE @L TABLE (
        LineNumber          int            NOT NULL PRIMARY KEY,
        FamilyCode          varchar(60)    NULL,
        ModelNo             smallint       NULL,
        Description         nvarchar(500)  NULL,
        QuantityTxt         nvarchar(50)   NULL,
        Quantity            int            NULL,
        ConfigurationJson   nvarchar(max)  NULL,
        PriceBreakdownJson  nvarchar(max)  NULL,
        EngineVersion       varchar(50)    NULL,
        LineNetTotal        decimal(14,2)  NULL
    );

    INSERT INTO @L (LineNumber, FamilyCode, ModelNo, Description, QuantityTxt, ConfigurationJson, PriceBreakdownJson, EngineVersion)
    SELECT CAST(j.[key] AS int) + 1, x.familyCode, x.modelNo, NULLIF(LTRIM(RTRIM(x.description)), N''),
           x.quantity, x.configuration, x.priceBreakdown, x.engineVersion
    FROM OPENJSON(@LinesJson) j
    CROSS APPLY OPENJSON(CASE WHEN j.[type] = 5 THEN j.[value] ELSE N'{}' END) WITH (
        familyCode     varchar(60)    '$.familyCode',
        modelNo        smallint       '$.modelNo',
        description    nvarchar(500)  '$.description',
        quantity       nvarchar(50)   '$.quantity',
        configuration  nvarchar(max)  '$.configuration' AS JSON,
        priceBreakdown nvarchar(max)  '$.priceBreakdown' AS JSON,
        engineVersion  varchar(50)    '$.engineVersion') x
    WHERE j.[type] = 5;   -- tik objektai

    IF (SELECT COUNT(*) FROM OPENJSON(@LinesJson)) <> (SELECT COUNT(*) FROM @L)
        THROW 51004, N'Kiekviena eilutė turi būti JSON objektas.', 1;
    IF (SELECT COUNT(*) FROM @L) > 200
        THROW 51004, N'Užsakyme gali būti ne daugiau kaip 200 eilučių.', 1;

    -- Kiekis: sveikas skaičius 1..1000
    UPDATE @L SET Quantity = TRY_CONVERT(int, QuantityTxt)
    WHERE QuantityTxt NOT LIKE N'%[^0-9]%' AND LEN(QuantityTxt) BETWEEN 1 AND 4;

    DECLARE @Bad int;
    SELECT TOP (1) @Bad = LineNumber FROM @L
    WHERE FamilyCode IS NULL OR ModelNo IS NULL OR Description IS NULL OR EngineVersion IS NULL
       OR Quantity IS NULL OR Quantity NOT BETWEEN 1 AND 1000
       OR ConfigurationJson IS NULL OR LEFT(LTRIM(ConfigurationJson), 1) <> N'{'
       OR PriceBreakdownJson IS NULL OR LEFT(LTRIM(PriceBreakdownJson), 1) <> N'['
    ORDER BY LineNumber;
    IF @Bad IS NOT NULL
    BEGIN
        DECLARE @Msg1 nvarchar(400) = N'Neteisingi eilutės Nr. ' + CAST(@Bad AS nvarchar(10)) +
            N' duomenys (šeima, modelis, aprašymas, kiekis 1–1000, konfigūracija, kainos išskaidymas, variklio versija).';
        THROW 51004, @Msg1, 1;
    END;

    -- Kainos išskaidymo eilutės: kiekviena turi aprašymą ir sumą (>= 0, iki 2 skaitmenų po kablelio)
    SET @Bad = NULL;
    SELECT TOP (1) @Bad = l.LineNumber
    FROM @L l
    CROSS APPLY OPENJSON(l.PriceBreakdownJson) r
    -- ne objektui paduodamas tuščias objektas, kad OPENJSON nemestų techninės klaidos
    OUTER APPLY OPENJSON(CASE WHEN r.[type] = 5 THEN r.[value] ELSE N'{}' END)
                WITH (sumTxt nvarchar(50) '$.sum', descr nvarchar(1000) '$.desc') b
    WHERE r.[type] <> 5
       OR b.descr IS NULL
       OR b.sumTxt IS NULL OR b.sumTxt LIKE N'%[^0-9.]%' OR b.sumTxt LIKE N'%.%.%' OR b.sumTxt LIKE N'%.[0-9][0-9][0-9]%'
       OR TRY_CONVERT(decimal(14,2), b.sumTxt) IS NULL
    ORDER BY l.LineNumber;
    IF @Bad IS NULL
        SELECT TOP (1) @Bad = l.LineNumber FROM @L l
        WHERE NOT EXISTS (SELECT 1 FROM OPENJSON(l.PriceBreakdownJson))
        ORDER BY l.LineNumber;
    IF @Bad IS NOT NULL
    BEGIN
        DECLARE @Msg2 nvarchar(400) = N'Eilutės Nr. ' + CAST(@Bad AS nvarchar(10)) +
            N' kainos išskaidymas neteisingas: kiekviena dalis turi turėti aprašymą (desc) ir sumą (sum) ne daugiau kaip 2 skaitmenų po kablelio.';
        THROW 51004, @Msg2, 1;
    END;

    UPDATE l SET LineNetTotal = s.Total
    FROM @L l
    CROSS APPLY (SELECT SUM(CONVERT(decimal(14,2), b.sumTxt)) AS Total
                 FROM OPENJSON(l.PriceBreakdownJson) WITH (sumTxt nvarchar(50) '$.sum') b) s;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Status varchar(30), @Rev int, @V int, @Vat decimal(5,4);
        SELECT @Status = StatusCode, @Rev = Revision, @V = CatalogVersionId, @Vat = VatRate
        FROM sales.[Order] WITH (UPDLOCK, HOLDLOCK) WHERE OrderId = @OrderId;
        IF @Rev <> @ExpectedRevision THROW 51005, N'Užsakymą jau pakeitė kitas naudotojas. Atnaujinkite puslapį.', 1;
        IF NOT EXISTS (SELECT 1 FROM sales.OrderStatus WHERE StatusCode = @Status AND IsEditable = 1)
            THROW 51003, N'Užsakymo keisti nebegalima — jis jau pateiktas.', 1;

        SET @Bad = NULL;
        SELECT TOP (1) @Bad = l.LineNumber FROM @L l
        WHERE NOT EXISTS (SELECT 1 FROM catalog.Model m
                          WHERE m.CatalogVersionId = @V AND m.FamilyCode = l.FamilyCode AND m.ModelNo = l.ModelNo)
        ORDER BY l.LineNumber;
        IF @Bad IS NOT NULL
        BEGIN
            DECLARE @Msg3 nvarchar(400) = N'Eilutės Nr. ' + CAST(@Bad AS nvarchar(10)) + N': tokio modelio užsakymo kataloge nėra.';
            THROW 51004, @Msg3, 1;
        END;

        DELETE FROM sales.OrderLine WHERE OrderId = @OrderId;

        INSERT INTO sales.OrderLine (OrderId, LineNumber, CatalogVersionId, FamilyCode, ModelNo, Description, Quantity,
                                     LineNetTotal, LineVatTotal, LineGrossTotal, ConfigurationJson, PriceBreakdownJson, EngineVersion)
        SELECT @OrderId, l.LineNumber, @V, l.FamilyCode, l.ModelNo, l.Description, l.Quantity,
               l.LineNetTotal, v.Vat, l.LineNetTotal + v.Vat, l.ConfigurationJson, l.PriceBreakdownJson, l.EngineVersion
        FROM @L l
        CROSS APPLY (SELECT CAST(ROUND(l.LineNetTotal * @Vat, 2) AS decimal(14,2)) AS Vat) v;

        DECLARE @Net decimal(14,2), @VatTotal decimal(14,2);
        SELECT @Net = ISNULL(SUM(LineNetTotal), 0), @VatTotal = ISNULL(SUM(LineVatTotal), 0)
        FROM sales.OrderLine WHERE OrderId = @OrderId;

        UPDATE sales.[Order]
        SET NetTotal = @Net, VatTotal = @VatTotal, GrossTotal = @Net + @VatTotal,
            UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @ActorUserId, Revision = Revision + 1
        WHERE OrderId = @OrderId;

        DECLARE @Det nvarchar(max) = (SELECT (SELECT COUNT(*) FROM @L) AS lines, @Net AS netTotal, @VatTotal AS vatTotal
                                      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @ActorUserId, 'ORDER_LINES_SAVED', 'Order', @OrderId, @Det;

        COMMIT TRANSACTION;
        SELECT OrderId, Revision, NetTotal, VatTotal, GrossTotal FROM sales.[Order] WHERE OrderId = @OrderId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Statuso keitimas
   -------------------------------------------------------------------------- */
CREATE PROCEDURE api.Order_ChangeStatus
    @ActorUserId      int,
    @OrderId          int,
    @ToStatus         varchar(30),
    @ExpectedRevision int,
    @Comment          nvarchar(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM sales.tvf_OrderAccess(@ActorUserId, @OrderId))
        THROW 51002, N'Užsakymas nerastas.', 1;
    SET @Comment = NULLIF(LTRIM(RTRIM(@Comment)), N'');

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @From varchar(30), @Rev int, @V int, @CreatedBy int, @OrderNumber varchar(20);
        SELECT @From = StatusCode, @Rev = Revision, @V = CatalogVersionId, @CreatedBy = CreatedByUserId, @OrderNumber = OrderNumber
        FROM sales.[Order] WITH (UPDLOCK, HOLDLOCK) WHERE OrderId = @OrderId;

        IF @Rev <> @ExpectedRevision THROW 51005, N'Užsakymą jau pakeitė kitas naudotojas. Atnaujinkite puslapį.', 1;

        DECLARE @RequiresComment bit;
        SELECT @RequiresComment = RequiresComment FROM sales.tvf_AllowedTransitions(@ActorUserId, @OrderId) WHERE ToStatus = @ToStatus;
        IF @RequiresComment IS NULL
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM sales.OrderStatusTransition WHERE FromStatus = @From AND ToStatus = @ToStatus)
                THROW 51003, N'Toks statuso pakeitimas negalimas.', 1;
            THROW 51001, N'Neturite teisės atlikti šio statuso pakeitimo.', 1;
        END;
        IF @RequiresComment = 1 AND @Comment IS NULL
            THROW 51004, N'Šiam veiksmui būtina nurodyti priežastį (komentarą).', 1;

        IF @ToStatus = 'SUBMITTED'
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM sales.OrderLine WHERE OrderId = @OrderId)
                THROW 51003, N'Negalima pateikti tuščio užsakymo.', 1;
            IF NOT EXISTS (SELECT 1 FROM catalog.CatalogVersion WHERE CatalogVersionId = @V AND Status = 'PUBLISHED')
                THROW 51003, N'Kol užsakymas buvo ruošiamas, išėjo naujas gamintojo katalogas. Kainas reikia perskaičiuoti pagal naują katalogą.', 1;
        END;

        DECLARE @ManufacturerEmail nvarchar(320);
        IF @ToStatus = 'SENT_TO_MANUFACTURER'
        BEGIN
            SELECT @ManufacturerEmail = m.OrderEmail
            FROM catalog.CatalogVersion cv JOIN catalog.Manufacturer m ON m.ManufacturerId = cv.ManufacturerId
            WHERE cv.CatalogVersionId = @V;
            IF @ManufacturerEmail IS NULL
                THROW 51003, N'Gamintojui nenurodytas užsakymų el. paštas. Nustatykite jį gamintojo nustatymuose.', 1;
        END;

        UPDATE sales.[Order]
        SET StatusCode = @ToStatus,
            SubmittedAt = CASE WHEN @ToStatus = 'SUBMITTED' THEN SYSUTCDATETIME() ELSE SubmittedAt END,
            UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @ActorUserId, Revision = Revision + 1
        WHERE OrderId = @OrderId;

        INSERT INTO sales.OrderStatusHistory (OrderId, FromStatus, ToStatus, ChangedByUserId, Comment)
        VALUES (@OrderId, @From, @ToStatus, @ActorUserId, @Comment);

        /* ---- laiškai (outbox, ta pati transakcija) ---- */
        DECLARE @Payload nvarchar(max) = (
            SELECT o.OrderId AS orderId, o.OrderNumber AS orderNumber, o.CustomerReference AS customerReference,
                   c.Name AS companyName, @From AS fromStatus, @ToStatus AS toStatus,
                   (SELECT Name FROM sales.OrderStatus WHERE StatusCode = @ToStatus) AS toStatusName,
                   @Comment AS comment, a.DisplayName AS changedBy,
                   o.NetTotal AS netTotal, o.VatTotal AS vatTotal, o.GrossTotal AS grossTotal, o.CurrencyCode AS currencyCode
            FROM sales.[Order] o
            JOIN org.Company c ON c.CompanyId = o.CompanyId
            LEFT JOIN iam.[User] a ON a.UserId = @ActorUserId
            WHERE o.OrderId = @OrderId
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

        -- Užsakymo autoriui (jei statusą keitė kitas asmuo ir autorius aktyvus)
        IF @CreatedBy <> @ActorUserId
        BEGIN
            DECLARE @CreatorEmail nvarchar(320) = (SELECT Email FROM iam.[User] WHERE UserId = @CreatedBy AND Status = 'ACTIVE');
            EXEC notify.usp_Enqueue 'ORDER_STATUS_CHANGED', @CreatorEmail, @Payload, 'Order', @OrderId, 0;
        END;

        -- Administratoriams — apie naujai pateiktą užsakymą
        IF @ToStatus = 'SUBMITTED'
        BEGIN
            DECLARE @AdminEmail nvarchar(1000) = (SELECT SettingValue FROM notify.Setting WHERE SettingKey = 'ADMIN_NOTIFY_EMAIL');
            EXEC notify.usp_Enqueue 'ORDER_SUBMITTED', @AdminEmail, @Payload, 'Order', @OrderId, 0;
        END;

        -- Gamintojui — pilna užsakymo kopija tą akimirką
        IF @ToStatus = 'SENT_TO_MANUFACTURER'
        BEGIN
            DECLARE @Full nvarchar(max) = (
                SELECT JSON_QUERY(@Payload) AS [order],
                       JSON_QUERY(ISNULL((SELECT l.LineNumber AS lineNumber, l.FamilyCode AS familyCode, l.ModelNo AS modelNo,
                                l.Description AS description, l.Quantity AS quantity,
                                l.LineNetTotal AS lineNetTotal, l.LineVatTotal AS lineVatTotal, l.LineGrossTotal AS lineGrossTotal,
                                JSON_QUERY(l.ConfigurationJson) AS configuration, JSON_QUERY(l.PriceBreakdownJson) AS priceBreakdown
                         FROM sales.OrderLine l WHERE l.OrderId = @OrderId ORDER BY l.LineNumber FOR JSON PATH), N'[]')) AS lines
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            EXEC notify.usp_Enqueue 'ORDER_TO_MANUFACTURER', @ManufacturerEmail, @Full, 'Order', @OrderId, 0;
        END;

        DECLARE @Det nvarchar(max) = (SELECT @From AS fromStatus, @ToStatus AS toStatus, @Comment AS comment FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @ActorUserId, 'ORDER_STATUS_CHANGED', 'Order', @OrderId, @Det;

        COMMIT TRANSACTION;
        SELECT OrderId, StatusCode, Revision FROM sales.[Order] WHERE OrderId = @OrderId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Skaitymas
   -------------------------------------------------------------------------- */

/* Grąžina 4 rezultatų rinkinius: antraštė, eilutės, statusų istorija,
   galimi kiti statusai šiam naudotojui. */
CREATE PROCEDURE api.Order_Get
    @ActorUserId int,
    @OrderId     int
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM sales.tvf_OrderAccess(@ActorUserId, @OrderId))
        THROW 51002, N'Užsakymas nerastas.', 1;

    SELECT o.OrderId, o.OrderNumber, o.StatusCode, s.Name AS StatusName, s.IsEditable,
           o.CompanyId, c.Name AS CompanyName, c.CompanyCode,
           o.CreatedByUserId, cu.DisplayName AS CreatedByName, cu.Email AS CreatedByEmail,
           o.CatalogVersionId, cv.Code AS CatalogVersionCode, cv.Status AS CatalogVersionStatus,
           m.Code AS ManufacturerCode, m.Name AS ManufacturerName,
           o.CustomerReference, o.Notes, o.CurrencyCode, o.VatRate, o.NetTotal, o.VatTotal, o.GrossTotal,
           o.CreatedAt, o.UpdatedAt, o.SubmittedAt, o.Revision
    FROM sales.[Order] o
    JOIN sales.OrderStatus s ON s.StatusCode = o.StatusCode
    JOIN org.Company c ON c.CompanyId = o.CompanyId
    JOIN iam.[User] cu ON cu.UserId = o.CreatedByUserId
    JOIN catalog.CatalogVersion cv ON cv.CatalogVersionId = o.CatalogVersionId
    JOIN catalog.Manufacturer m ON m.ManufacturerId = cv.ManufacturerId
    WHERE o.OrderId = @OrderId;

    SELECT l.OrderLineId, l.LineNumber, l.FamilyCode, f.Label AS FamilyLabel, l.ModelNo, l.Description, l.Quantity,
           l.LineNetTotal, l.LineVatTotal, l.LineGrossTotal, l.ConfigurationJson, l.PriceBreakdownJson, l.EngineVersion
    FROM sales.OrderLine l
    JOIN catalog.Family f ON f.CatalogVersionId = l.CatalogVersionId AND f.FamilyCode = l.FamilyCode
    WHERE l.OrderId = @OrderId
    ORDER BY l.LineNumber;

    SELECT h.FromStatus, h.ToStatus, s.Name AS ToStatusName, h.ChangedAt, u.DisplayName AS ChangedBy, h.Comment
    FROM sales.OrderStatusHistory h
    JOIN sales.OrderStatus s ON s.StatusCode = h.ToStatus
    JOIN iam.[User] u ON u.UserId = h.ChangedByUserId
    WHERE h.OrderId = @OrderId
    ORDER BY h.ChangedAt, h.OrderStatusHistoryId;

    SELECT ToStatus, ToStatusName, RequiresComment FROM sales.tvf_AllowedTransitions(@ActorUserId, @OrderId);
END;
GO

CREATE PROCEDURE api.Order_List
    @ActorUserId int,
    @StatusCode  varchar(30) = NULL,
    @CompanyId   int = NULL,
    @Search      nvarchar(100) = NULL,
    @Page        int = 1,
    @PageSize    int = 50
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ALevel tinyint, @ACompanyId int;
    SELECT @ALevel = RoleLevel, @ACompanyId = CompanyId FROM iam.tvf_Actor(@ActorUserId);
    IF @ALevel IS NULL THROW 51001, N'Neturite teisės.', 1;

    IF @Page IS NULL OR @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
    IF @PageSize > 200 SET @PageSize = 200;
    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), N'');
    -- LIKE specialieji simboliai paieškoje traktuojami kaip paprasti
    IF @Search IS NOT NULL
        SET @Search = REPLACE(REPLACE(REPLACE(@Search, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]');

    SELECT o.OrderId, o.OrderNumber, o.StatusCode, s.Name AS StatusName, o.CompanyId, c.Name AS CompanyName,
           cu.DisplayName AS CreatedByName, m.Name AS ManufacturerName, o.CustomerReference,
           o.NetTotal, o.VatTotal, o.GrossTotal, o.CurrencyCode, o.CreatedAt, o.UpdatedAt, o.SubmittedAt,
           COUNT(*) OVER () AS TotalCount
    FROM sales.[Order] o
    JOIN sales.OrderStatus s ON s.StatusCode = o.StatusCode
    JOIN org.Company c ON c.CompanyId = o.CompanyId
    JOIN iam.[User] cu ON cu.UserId = o.CreatedByUserId
    JOIN catalog.CatalogVersion cv ON cv.CatalogVersionId = o.CatalogVersionId
    JOIN catalog.Manufacturer m ON m.ManufacturerId = cv.ManufacturerId
    WHERE (@StatusCode IS NULL OR o.StatusCode = @StatusCode)
      AND (@CompanyId IS NULL OR o.CompanyId = @CompanyId)
      AND (    @ALevel >= 30
           OR (@ALevel = 20 AND o.CompanyId = @ACompanyId)
           OR (o.CreatedByUserId = @ActorUserId AND o.CompanyId = @ACompanyId))
      AND (@Search IS NULL OR o.OrderNumber LIKE N'%' + @Search + N'%'
                           OR o.CustomerReference LIKE N'%' + @Search + N'%'
                           OR c.Name LIKE N'%' + @Search + N'%')
    ORDER BY o.CreatedAt DESC, o.OrderId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
