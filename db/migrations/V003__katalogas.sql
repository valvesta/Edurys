/* ==========================================================================
   V003 — Katalogas: gamintojai, katalogų versijos ir jų turinys.

   Principai:
   1. Kiekvienas gamintojas turi katalogų VERSIJAS (pvz. ERKADO „2026-I").
      Visas turinys (šeimos, modeliai, dekorai, kainos) priklauso versijai.
   2. Versijos būsenos: DRAFT -> PUBLISHED -> RETIRED.
      Paskelbtos (PUBLISHED) ir išimtos (RETIRED) versijos turinio pakeisti
      NEĮMANOMA — tai užtikrina trigeriai žemiau. Kainos keičiamos tik
      importuojant naują versiją. Todėl užsakymai visada rodo į tikslią
      kainų versiją, pagal kurią buvo sudaryti.
   3. Vienam gamintojui vienu metu galioja tik viena PUBLISHED versija.
   4. Kainos — decimal(12,2), niekada float.
   5. Gamintojo specifinės taisyklės (staktų lentelės, priedai, spynos ir
      pan.) saugomos catalog.RuleDataset kaip tikslios JSON kopijos su
      SHA-256 kontroline suma. Jas naudoja kainų skaičiavimo variklis.
      Kai prisidės kiti gamintojai ir paaiškės bendri dėsningumai, šie
      rinkiniai bus palaipsniui normalizuojami į atskiras lenteles.
   ========================================================================== */

CREATE TABLE catalog.Manufacturer (
    ManufacturerId  int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_Manufacturer PRIMARY KEY,
    Code            varchar(50)    NOT NULL CONSTRAINT UQ_Manufacturer_Code UNIQUE,
    Name            nvarchar(200)  NOT NULL,
    OrderEmail      nvarchar(320)  NULL,   -- kur siunčiami užsakymai (statusas SENT_TO_MANUFACTURER)
    IsActive        bit            NOT NULL CONSTRAINT DF_Manufacturer_IsActive DEFAULT (1),
    CreatedAt       datetime2(3)   NOT NULL CONSTRAINT DF_Manufacturer_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Manufacturer_Code CHECK (Code NOT LIKE '%[^A-Z0-9_]%' AND LEN(Code) > 0),
    CONSTRAINT CK_Manufacturer_OrderEmail CHECK (OrderEmail IS NULL OR (OrderEmail LIKE N'_%@_%._%' AND OrderEmail NOT LIKE N'% %'))
);
GO

CREATE TABLE catalog.CatalogVersion (
    CatalogVersionId   int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_CatalogVersion PRIMARY KEY,
    ManufacturerId     int            NOT NULL CONSTRAINT FK_CatalogVersion_Manufacturer REFERENCES catalog.Manufacturer (ManufacturerId),
    Code               varchar(50)    NOT NULL,
    Name               nvarchar(200)  NOT NULL,
    CurrencyCode       char(3)        NOT NULL,
    VatRate            decimal(5,4)   NOT NULL,
    Status             varchar(20)    NOT NULL CONSTRAINT DF_CatalogVersion_Status DEFAULT ('DRAFT'),
    SourceDescription  nvarchar(500)  NULL,
    SourceHashesJson   nvarchar(2000) NULL,
    BundleSha256       char(64)       NOT NULL,
    ImportedAt         datetime2(3)   NOT NULL CONSTRAINT DF_CatalogVersion_ImportedAt DEFAULT (SYSUTCDATETIME()),
    ImportedBy         nvarchar(200)  NOT NULL,
    PublishedAt        datetime2(3)   NULL,
    PublishedBy        nvarchar(200)  NULL,
    RetiredAt          datetime2(3)   NULL,
    CONSTRAINT UQ_CatalogVersion_Code UNIQUE (ManufacturerId, Code),
    CONSTRAINT CK_CatalogVersion_Status CHECK (Status IN ('DRAFT', 'PUBLISHED', 'RETIRED')),
    CONSTRAINT CK_CatalogVersion_Vat CHECK (VatRate >= 0 AND VatRate < 1),
    CONSTRAINT CK_CatalogVersion_Currency CHECK (CurrencyCode NOT LIKE '%[^A-Z]%'),
    CONSTRAINT CK_CatalogVersion_SourceHashes CHECK (SourceHashesJson IS NULL OR ISJSON(SourceHashesJson) = 1),
    CONSTRAINT CK_CatalogVersion_Published CHECK (
        (Status = 'DRAFT'     AND PublishedAt IS NULL) OR
        (Status = 'PUBLISHED' AND PublishedAt IS NOT NULL AND RetiredAt IS NULL) OR
        (Status = 'RETIRED'   AND PublishedAt IS NOT NULL AND RetiredAt IS NOT NULL))
);
GO
CREATE UNIQUE INDEX UX_CatalogVersion_OnePublished ON catalog.CatalogVersion (ManufacturerId) WHERE Status = 'PUBLISHED';
GO

/* ---- turinys (visos lentelės su CatalogVersionId pirmuoju rakto stulpeliu) ---- */

CREATE TABLE catalog.ProductLine (
    CatalogVersionId      int            NOT NULL CONSTRAINT FK_ProductLine_Version REFERENCES catalog.CatalogVersion (CatalogVersionId),
    LineCode              varchar(30)    NOT NULL,
    Name                  nvarchar(100)  NOT NULL,
    ShortName             nvarchar(50)   NULL,
    Eyebrow               nvarchar(100)  NULL,
    CatalogPages          nvarchar(50)   NULL,
    ReversibleBlocks2112  bit            NOT NULL,
    SortOrder             int            NOT NULL,
    CONSTRAINT PK_ProductLine PRIMARY KEY (CatalogVersionId, LineCode)
);
GO

CREATE TABLE catalog.DoorType (
    CatalogVersionId  int           NOT NULL CONSTRAINT FK_DoorType_Version REFERENCES catalog.CatalogVersion (CatalogVersionId),
    DoorTypeCode      varchar(20)   NOT NULL,
    Name              nvarchar(100) NOT NULL,
    SortOrder         int           NOT NULL,
    CONSTRAINT PK_DoorType PRIMARY KEY (CatalogVersionId, DoorTypeCode)
);
GO

CREATE TABLE catalog.DecorGroup (
    CatalogVersionId  int           NOT NULL CONSTRAINT FK_DecorGroup_Version REFERENCES catalog.CatalogVersion (CatalogVersionId),
    DecorGroupCode    varchar(20)   NOT NULL,
    Name              nvarchar(100) NOT NULL,
    SortOrder         int           NOT NULL,
    CONSTRAINT PK_DecorGroup PRIMARY KEY (CatalogVersionId, DecorGroupCode)
);
GO

CREATE TABLE catalog.Decor (
    CatalogVersionId  int           NOT NULL,
    DecorCode         varchar(40)   NOT NULL,
    Name              nvarchar(150) NOT NULL,
    DecorGroupCode    varchar(20)   NOT NULL,
    SortOrder         int           NOT NULL,
    CONSTRAINT PK_Decor PRIMARY KEY (CatalogVersionId, DecorCode),
    CONSTRAINT FK_Decor_Group FOREIGN KEY (CatalogVersionId, DecorGroupCode) REFERENCES catalog.DecorGroup (CatalogVersionId, DecorGroupCode)
);
GO

CREATE TABLE catalog.Width (
    CatalogVersionId  int          NOT NULL CONSTRAINT FK_Width_Version REFERENCES catalog.CatalogVersion (CatalogVersionId),
    WidthCode         varchar(10)  NOT NULL,
    NominalCm         smallint     NOT NULL,
    IsNarrow          bit          NOT NULL,
    SortOrder         int          NOT NULL,
    CONSTRAINT PK_Width PRIMARY KEY (CatalogVersionId, WidthCode),
    CONSTRAINT CK_Width_Nominal CHECK (NominalCm BETWEEN 30 AND 300)
);
GO

CREATE TABLE catalog.Family (
    CatalogVersionId  int            NOT NULL,
    FamilyCode        varchar(60)    NOT NULL,
    LineCode          varchar(30)    NOT NULL,
    Label             nvarchar(100)  NOT NULL,
    BaseLabel         nvarchar(100)  NOT NULL,
    CatalogPages      nvarchar(50)   NULL,
    Tier              tinyint        NULL,
    IsPanel           bit            NOT NULL,
    ExtrasKey         varchar(30)    NOT NULL,
    GlassKey          nvarchar(60)   NOT NULL,
    SlidingSingle     bit            NOT NULL,
    SlidingDouble     bit            NOT NULL,
    Allows2112        bit            NOT NULL,
    SortOrder         int            NOT NULL,
    RulesJson         nvarchar(max)  NOT NULL,
    CONSTRAINT PK_Family PRIMARY KEY (CatalogVersionId, FamilyCode),
    CONSTRAINT FK_Family_Line FOREIGN KEY (CatalogVersionId, LineCode) REFERENCES catalog.ProductLine (CatalogVersionId, LineCode),
    CONSTRAINT CK_Family_RulesJson CHECK (ISJSON(RulesJson) = 1)
);
GO

CREATE TABLE catalog.FamilyDoorType (
    CatalogVersionId  int          NOT NULL,
    FamilyCode        varchar(60)  NOT NULL,
    DoorTypeCode      varchar(20)  NOT NULL,
    SortOrder         int          NOT NULL,
    CONSTRAINT PK_FamilyDoorType PRIMARY KEY (CatalogVersionId, FamilyCode, DoorTypeCode),
    CONSTRAINT FK_FamilyDoorType_Family FOREIGN KEY (CatalogVersionId, FamilyCode) REFERENCES catalog.Family (CatalogVersionId, FamilyCode),
    CONSTRAINT FK_FamilyDoorType_DoorType FOREIGN KEY (CatalogVersionId, DoorTypeCode) REFERENCES catalog.DoorType (CatalogVersionId, DoorTypeCode)
);
GO

CREATE TABLE catalog.FamilyWidth (
    CatalogVersionId  int          NOT NULL,
    FamilyCode        varchar(60)  NOT NULL,
    WidthCode         varchar(10)  NOT NULL,
    SortOrder         int          NOT NULL,
    CONSTRAINT PK_FamilyWidth PRIMARY KEY (CatalogVersionId, FamilyCode, WidthCode),
    CONSTRAINT FK_FamilyWidth_Family FOREIGN KEY (CatalogVersionId, FamilyCode) REFERENCES catalog.Family (CatalogVersionId, FamilyCode),
    CONSTRAINT FK_FamilyWidth_Width FOREIGN KEY (CatalogVersionId, WidthCode) REFERENCES catalog.Width (CatalogVersionId, WidthCode)
);
GO

CREATE TABLE catalog.FamilyDecor (
    CatalogVersionId  int          NOT NULL,
    FamilyCode        varchar(60)  NOT NULL,
    DecorCode         varchar(40)  NOT NULL,
    SortOrder         int          NOT NULL,
    CONSTRAINT PK_FamilyDecor PRIMARY KEY (CatalogVersionId, FamilyCode, DecorCode),
    CONSTRAINT FK_FamilyDecor_Family FOREIGN KEY (CatalogVersionId, FamilyCode) REFERENCES catalog.Family (CatalogVersionId, FamilyCode),
    CONSTRAINT FK_FamilyDecor_Decor FOREIGN KEY (CatalogVersionId, DecorCode) REFERENCES catalog.Decor (CatalogVersionId, DecorCode)
);
GO

CREATE TABLE catalog.Model (
    CatalogVersionId  int             NOT NULL,
    FamilyCode        varchar(60)     NOT NULL,
    ModelNo           smallint        NOT NULL,
    Note              nvarchar(1000)  NULL,
    SortOrder         int             NOT NULL,
    CONSTRAINT PK_Model PRIMARY KEY (CatalogVersionId, FamilyCode, ModelNo),
    CONSTRAINT FK_Model_Family FOREIGN KEY (CatalogVersionId, FamilyCode) REFERENCES catalog.Family (CatalogVersionId, FamilyCode),
    CONSTRAINT CK_Model_No CHECK (ModelNo > 0)
);
GO

/* Bazinė varčios kaina be PVM: šeima × modelis × dekorų grupė. */
CREATE TABLE catalog.ModelBasePrice (
    CatalogVersionId  int            NOT NULL,
    FamilyCode        varchar(60)    NOT NULL,
    ModelNo           smallint       NOT NULL,
    DecorGroupCode    varchar(20)    NOT NULL,
    Price             decimal(12,2)  NOT NULL,
    CONSTRAINT PK_ModelBasePrice PRIMARY KEY (CatalogVersionId, FamilyCode, ModelNo, DecorGroupCode),
    CONSTRAINT FK_ModelBasePrice_Model FOREIGN KEY (CatalogVersionId, FamilyCode, ModelNo) REFERENCES catalog.Model (CatalogVersionId, FamilyCode, ModelNo),
    CONSTRAINT FK_ModelBasePrice_Group FOREIGN KEY (CatalogVersionId, DecorGroupCode) REFERENCES catalog.DecorGroup (CatalogVersionId, DecorGroupCode),
    CONSTRAINT CK_ModelBasePrice_Price CHECK (Price >= 0)
);
GO

/* Stiklo variantai modeliui. Pirmas (IsDefault=1) visada nemokamas. */
CREATE TABLE catalog.GlassOption (
    CatalogVersionId  int            NOT NULL,
    FamilyCode        varchar(60)    NOT NULL,
    ModelNo           smallint       NOT NULL,
    GlassCode         varchar(40)    NOT NULL,
    Name              nvarchar(200)  NOT NULL,
    Price             decimal(12,2)  NOT NULL,
    IsDefault         bit            NOT NULL,
    SortOrder         int            NOT NULL,
    CONSTRAINT PK_GlassOption PRIMARY KEY (CatalogVersionId, FamilyCode, ModelNo, GlassCode),
    CONSTRAINT FK_GlassOption_Model FOREIGN KEY (CatalogVersionId, FamilyCode, ModelNo) REFERENCES catalog.Model (CatalogVersionId, FamilyCode, ModelNo),
    CONSTRAINT CK_GlassOption_Price CHECK (Price >= 0),
    CONSTRAINT CK_GlassOption_DefaultFree CHECK (IsDefault = 0 OR Price = 0)
);
GO
CREATE UNIQUE INDEX UX_GlassOption_OneDefault ON catalog.GlassOption (CatalogVersionId, FamilyCode, ModelNo) WHERE IsDefault = 1;
GO

CREATE TABLE catalog.Handle (
    CatalogVersionId  int            NOT NULL CONSTRAINT FK_Handle_Version REFERENCES catalog.CatalogVersion (CatalogVersionId),
    HandleCode        varchar(60)    NOT NULL,
    Name              nvarchar(150)  NOT NULL,
    HasLeftRight      bit            NOT NULL,
    PlateSystem       varchar(10)    NOT NULL,
    SortOrder         int            NOT NULL,
    CONSTRAINT PK_Handle PRIMARY KEY (CatalogVersionId, HandleCode),
    CONSTRAINT CK_Handle_PlateSystem CHECK (PlateSystem IN ('none', 'triple', 'dual'))
);
GO

CREATE TABLE catalog.HandleFinish (
    CatalogVersionId    int            NOT NULL,
    HandleCode          varchar(60)    NOT NULL,
    FinishCode          varchar(40)    NOT NULL,
    Name                nvarchar(150)  NOT NULL,
    Price               decimal(12,2)  NOT NULL,
    PlateKeyPrice       decimal(12,2)  NULL,
    PlateCylPrice       decimal(12,2)  NULL,
    PlateWcPrice        decimal(12,2)  NULL,
    PlateKeyOrCylPrice  decimal(12,2)  NULL,
    SortOrder           int            NOT NULL,
    CONSTRAINT PK_HandleFinish PRIMARY KEY (CatalogVersionId, HandleCode, FinishCode),
    CONSTRAINT FK_HandleFinish_Handle FOREIGN KEY (CatalogVersionId, HandleCode) REFERENCES catalog.Handle (CatalogVersionId, HandleCode),
    CONSTRAINT CK_HandleFinish_Prices CHECK (Price >= 0 AND ISNULL(PlateKeyPrice, 0) >= 0 AND ISNULL(PlateCylPrice, 0) >= 0
                                             AND ISNULL(PlateWcPrice, 0) >= 0 AND ISNULL(PlateKeyOrCylPrice, 0) >= 0)
);
GO

CREATE TABLE catalog.RuleDataset (
    CatalogVersionId  int            NOT NULL CONSTRAINT FK_RuleDataset_Version REFERENCES catalog.CatalogVersion (CatalogVersionId),
    DatasetCode       varchar(60)    NOT NULL,
    ContentJson       nvarchar(max)  NOT NULL,
    ContentSha256     char(64)       NOT NULL,
    SortOrder         int            NOT NULL,
    CONSTRAINT PK_RuleDataset PRIMARY KEY (CatalogVersionId, DatasetCode),
    -- Rinkinys gali būti ir pavienė reikšmė (pvz. 51.6). SQL Server ISJSON tokios
    -- nelaiko JSON dokumentu, todėl tikriname ją įvilkę į objektą.
    CONSTRAINT CK_RuleDataset_Json CHECK (ISJSON(N'{"v":' + ContentJson + N'}') = 1)
);
GO

/* ==========================================================================
   Paskelbtų versijų apsauga. Kiekvienai turinio lentelei — trigeris, kuris
   leidžia keisti/trinti/įterpti eilutes TIK tada, kai versija yra DRAFT.
   Apsaugo ir nuo rankinių DBA pakeitimų, ne tik nuo programos.
   ========================================================================== */
CREATE FUNCTION catalog.fn_VersionIsLocked (@CatalogVersionId int)
RETURNS bit
WITH SCHEMABINDING
AS
BEGIN
    RETURN (SELECT CASE WHEN Status = 'DRAFT' THEN 0 ELSE 1 END
            FROM catalog.CatalogVersion WHERE CatalogVersionId = @CatalogVersionId);
END;
GO

CREATE TRIGGER catalog.TR_ProductLine_Lock ON catalog.ProductLine AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_DoorType_Lock ON catalog.DoorType AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_DecorGroup_Lock ON catalog.DecorGroup AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_Decor_Lock ON catalog.Decor AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_Width_Lock ON catalog.Width AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_Family_Lock ON catalog.Family AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_FamilyDoorType_Lock ON catalog.FamilyDoorType AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_FamilyWidth_Lock ON catalog.FamilyWidth AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_FamilyDecor_Lock ON catalog.FamilyDecor AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_Model_Lock ON catalog.Model AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_ModelBasePrice_Lock ON catalog.ModelBasePrice AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_GlassOption_Lock ON catalog.GlassOption AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_Handle_Lock ON catalog.Handle AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_HandleFinish_Lock ON catalog.HandleFinish AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO
CREATE TRIGGER catalog.TR_RuleDataset_Lock ON catalog.RuleDataset AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM (SELECT CatalogVersionId FROM inserted UNION SELECT CatalogVersionId FROM deleted) v
               WHERE catalog.fn_VersionIsLocked(v.CatalogVersionId) = 1)
        THROW 51003, N'Paskelbtos katalogo versijos keisti negalima. Importuokite naują versiją.', 1;
END;
GO

/* Pačios versijos apsauga: paskelbtos versijos negalima grąžinti į DRAFT,
   pakeisti jos kodo, PVM ar maišos, ir jos negalima ištrinti. */
CREATE TRIGGER catalog.TR_CatalogVersion_Guard ON catalog.CatalogVersion AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.CatalogVersionId = d.CatalogVersionId
               WHERE d.Status <> 'DRAFT' AND i.CatalogVersionId IS NULL)
        THROW 51003, N'Paskelbtos katalogo versijos ištrinti negalima.', 1;
    IF EXISTS (SELECT 1 FROM deleted d JOIN inserted i ON i.CatalogVersionId = d.CatalogVersionId
               WHERE d.Status <> 'DRAFT' AND (
                     i.Status = 'DRAFT'
                  OR (d.Status = 'RETIRED' AND i.Status <> 'RETIRED')
                  OR i.Code <> d.Code OR i.ManufacturerId <> d.ManufacturerId
                  OR i.VatRate <> d.VatRate OR i.CurrencyCode <> d.CurrencyCode
                  OR i.BundleSha256 <> d.BundleSha256 OR i.PublishedAt <> d.PublishedAt))
        THROW 51003, N'Paskelbtos katalogo versijos duomenų keisti negalima.', 1;
END;
GO
