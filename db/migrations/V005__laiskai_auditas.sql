/* ==========================================================================
   V005 — Siunčiamų laiškų eilė (outbox), sistemos nustatymai ir auditas.

   Laiškai siunčiami „outbox" principu: procedūra, kuri keičia užsakymo
   statusą, TOJE PAČIOJE transakcijoje įrašo laišką į notify.EmailOutbox.
   Atskiras foninis procesas (API worker) laiškus paima, sugeneruoja pagal
   šabloną ir išsiunčia per Microsoft Graph. Taip laiškas niekada nebus
   išsiųstas, jei statusas nepasikeitė, ir niekada nepasimes, jei statusas
   pasikeitė (net jei pašto serveris tuo metu nepasiekiamas).
   ========================================================================== */

CREATE TABLE notify.Setting (
    SettingKey    varchar(60)    NOT NULL CONSTRAINT PK_Setting PRIMARY KEY,
    SettingValue  nvarchar(1000) NULL,
    Description   nvarchar(500)  NULL,
    UpdatedAt     datetime2(3)   NOT NULL CONSTRAINT DF_Setting_UpdatedAt DEFAULT (SYSUTCDATETIME())
);
GO
INSERT INTO notify.Setting (SettingKey, SettingValue, Description) VALUES
    ('ADMIN_NOTIFY_EMAIL', NULL, N'Kur siunčiami pranešimai administratoriams (naujos užklausos, pateikti užsakymai). Pvz. bendra dėžutė.'),
    ('APP_BASE_URL',       NULL, N'Sistemos adresas, naudojamas nuorodoms laiškuose, pvz. https://durys.jupoja.lt');
GO

CREATE TABLE notify.EmailOutbox (
    EmailId            bigint         IDENTITY(1,1) NOT NULL CONSTRAINT PK_EmailOutbox PRIMARY KEY,
    TemplateCode       varchar(50)    NOT NULL,
    ToAddress          nvarchar(320)  NOT NULL,
    PayloadJson        nvarchar(max)  NULL,       -- duomenys šablonui
    IsSensitive        bit            NOT NULL CONSTRAINT DF_EmailOutbox_IsSensitive DEFAULT (0),
    RelatedEntity      varchar(30)    NULL,
    RelatedId          int            NULL,
    Status             varchar(20)    NOT NULL CONSTRAINT DF_EmailOutbox_Status DEFAULT ('PENDING'),
    Attempts           int            NOT NULL CONSTRAINT DF_EmailOutbox_Attempts DEFAULT (0),
    NextAttemptAt      datetime2(3)   NOT NULL CONSTRAINT DF_EmailOutbox_NextAttemptAt DEFAULT (SYSUTCDATETIME()),
    LockedBy           nvarchar(100)  NULL,
    LockedUntil        datetime2(3)   NULL,
    LastError          nvarchar(2000) NULL,
    ProviderMessageId  nvarchar(200)  NULL,
    CreatedAt          datetime2(3)   NOT NULL CONSTRAINT DF_EmailOutbox_CreatedAt DEFAULT (SYSUTCDATETIME()),
    SentAt             datetime2(3)   NULL,
    CONSTRAINT CK_EmailOutbox_Status  CHECK (Status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
    CONSTRAINT CK_EmailOutbox_Payload CHECK (PayloadJson IS NULL OR ISJSON(PayloadJson) = 1),
    CONSTRAINT CK_EmailOutbox_To      CHECK (ToAddress LIKE N'_%@_%._%' AND ToAddress NOT LIKE N'% %')
);
GO
CREATE INDEX IX_EmailOutbox_Queue ON notify.EmailOutbox (Status, NextAttemptAt) INCLUDE (LockedUntil);
GO
CREATE INDEX IX_EmailOutbox_Related ON notify.EmailOutbox (RelatedEntity, RelatedId);
GO

CREATE TABLE audit.AuditLog (
    AuditId        bigint            IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditLog PRIMARY KEY,
    OccurredAt     datetime2(3)      NOT NULL CONSTRAINT DF_AuditLog_OccurredAt DEFAULT (SYSUTCDATETIME()),
    ActorUserId    int               NULL,
    Action         varchar(60)       NOT NULL,
    EntityType     varchar(40)       NOT NULL,
    EntityId       nvarchar(60)      NULL,
    DetailsJson    nvarchar(max)     NULL,
    CONSTRAINT CK_AuditLog_Details CHECK (DetailsJson IS NULL OR ISJSON(DetailsJson) = 1)
);
GO
CREATE INDEX IX_AuditLog_Entity ON audit.AuditLog (EntityType, EntityId, OccurredAt);
GO
CREATE INDEX IX_AuditLog_Actor ON audit.AuditLog (ActorUserId, OccurredAt);
GO

CREATE TRIGGER audit.TR_AuditLog_AppendOnly ON audit.AuditLog INSTEAD OF UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    THROW 51003, N'Audito žurnalo keisti ar trinti negalima.', 1;
END;
GO

/* Bendra audito įrašymo procedūra (naudojama kitų procedūrų viduje). */
CREATE PROCEDURE audit.usp_Write
    @ActorUserId int,
    @Action      varchar(60),
    @EntityType  varchar(40),
    @EntityId    nvarchar(60),
    @DetailsJson nvarchar(max) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO audit.AuditLog (ActorUserId, Action, EntityType, EntityId, DetailsJson)
    VALUES (@ActorUserId, @Action, @EntityType, @EntityId, @DetailsJson);
END;
GO

/* Laiško įdėjimas į eilę (naudojama kitų procedūrų viduje). Jei gavėjo nėra
   (pvz. nenustatytas ADMIN_NOTIFY_EMAIL) — tyliai praleidžiama. */
CREATE PROCEDURE notify.usp_Enqueue
    @TemplateCode  varchar(50),
    @ToAddress     nvarchar(320),
    @PayloadJson   nvarchar(max),
    @RelatedEntity varchar(30) = NULL,
    @RelatedId     int = NULL,
    @IsSensitive   bit = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF @ToAddress IS NULL OR LEN(LTRIM(RTRIM(@ToAddress))) = 0 RETURN;
    INSERT INTO notify.EmailOutbox (TemplateCode, ToAddress, PayloadJson, RelatedEntity, RelatedId, IsSensitive)
    VALUES (@TemplateCode, LTRIM(RTRIM(@ToAddress)), @PayloadJson, @RelatedEntity, @RelatedId, @IsSensitive);
END;
GO
