/* ==========================================================================
   V009 — Laiškų siuntimo procedūros (foniniam API procesui) ir auditas.

   Siuntimo eiga:
     1. api.Email_ClaimBatch — paima iki N laiškų ir „užrakina" juos
        (LockedUntil), kad du procesai nesiųstų to paties laiško.
     2. Procesas sugeneruoja laišką pagal TemplateCode + PayloadJson ir
        siunčia per Microsoft Graph.
     3. api.Email_MarkSent arba api.Email_MarkFailed.
        Nesėkmės atveju bandoma iš naujo su didėjančia pertrauka
        (2, 4, 8, 16 min.), po 5 bandymų — FAILED (matoma administratoriui).
   Jei procesas „nukrito" nepažymėjęs laiško, po užrakto galiojimo laiškas
   vėl paimamas.
   ========================================================================== */

CREATE PROCEDURE api.Email_ClaimBatch
    @WorkerId      nvarchar(100),
    @BatchSize     int = 10,
    @LeaseSeconds  int = 120
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @WorkerId IS NULL OR LEN(@WorkerId) = 0 THROW 51004, N'Nenurodytas procesas.', 1;
    IF @BatchSize IS NULL OR @BatchSize NOT BETWEEN 1 AND 100 SET @BatchSize = 10;
    IF @LeaseSeconds IS NULL OR @LeaseSeconds NOT BETWEEN 30 AND 900 SET @LeaseSeconds = 120;

    DECLARE @Now datetime2(3) = SYSUTCDATETIME();
    DECLARE @Claimed TABLE (EmailId bigint PRIMARY KEY);

    WITH q AS (
        SELECT TOP (@BatchSize) EmailId, Status, LockedBy, LockedUntil, Attempts
        FROM notify.EmailOutbox WITH (UPDLOCK, READPAST, ROWLOCK)
        WHERE (Status = 'PENDING' AND NextAttemptAt <= @Now)
           OR (Status = 'SENDING' AND LockedUntil < @Now)
        ORDER BY NextAttemptAt, EmailId
    )
    UPDATE q
    SET Status = 'SENDING', LockedBy = @WorkerId, LockedUntil = DATEADD(SECOND, @LeaseSeconds, @Now)
    OUTPUT inserted.EmailId INTO @Claimed (EmailId);

    SELECT e.EmailId, e.TemplateCode, e.ToAddress, e.PayloadJson, e.RelatedEntity, e.RelatedId, e.Attempts
    FROM notify.EmailOutbox e
    JOIN @Claimed c ON c.EmailId = e.EmailId
    ORDER BY e.EmailId;
END;
GO

CREATE PROCEDURE api.Email_MarkSent
    @EmailId           bigint,
    @WorkerId          nvarchar(100),
    @ProviderMessageId nvarchar(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE notify.EmailOutbox
    SET Status = 'SENT', SentAt = SYSUTCDATETIME(), Attempts = Attempts + 1,
        LockedBy = NULL, LockedUntil = NULL, LastError = NULL, ProviderMessageId = @ProviderMessageId,
        -- jautrūs duomenys (kvietimo nuoroda su žetonu) ištrinami iškart po išsiuntimo
        PayloadJson = CASE WHEN IsSensitive = 1 THEN NULL ELSE PayloadJson END
    WHERE EmailId = @EmailId AND Status = 'SENDING' AND LockedBy = @WorkerId;
    IF @@ROWCOUNT = 0 THROW 51003, N'Laiškas nebėra užrakintas šio proceso.', 1;
END;
GO

CREATE PROCEDURE api.Email_MarkFailed
    @EmailId  bigint,
    @WorkerId nvarchar(100),
    @Error    nvarchar(2000)
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE notify.EmailOutbox
    SET Attempts = Attempts + 1,
        Status = CASE WHEN Attempts + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END,
        NextAttemptAt = DATEADD(MINUTE, POWER(2, Attempts + 1), SYSUTCDATETIME()),
        LockedBy = NULL, LockedUntil = NULL, LastError = LEFT(@Error, 2000)
    WHERE EmailId = @EmailId AND Status = 'SENDING' AND LockedBy = @WorkerId;
    IF @@ROWCOUNT = 0 THROW 51003, N'Laiškas nebėra užrakintas šio proceso.', 1;
END;
GO

/* Administratoriui: laiškų eilės būklė ir nepavykę laiškai. */
CREATE PROCEDURE api.Email_ListRecent
    @ActorUserId int,
    @Status      varchar(20) = NULL,
    @Top         int = 100
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30) THROW 51001, N'Neturite teisės.', 1;
    IF @Top IS NULL OR @Top NOT BETWEEN 1 AND 1000 SET @Top = 100;
    SELECT TOP (@Top) EmailId, TemplateCode, ToAddress, RelatedEntity, RelatedId, Status, Attempts,
           NextAttemptAt, LastError, CreatedAt, SentAt
    FROM notify.EmailOutbox
    WHERE @Status IS NULL OR Status = @Status
    ORDER BY EmailId DESC;
END;
GO

/* Nepavykusio laiško pakartojimas (ADMIN+). */
CREATE PROCEDURE api.Email_Retry
    @ActorUserId int,
    @EmailId     bigint
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30) THROW 51001, N'Neturite teisės.', 1;
    UPDATE notify.EmailOutbox SET Status = 'PENDING', Attempts = 0, NextAttemptAt = SYSUTCDATETIME()
    WHERE EmailId = @EmailId AND Status = 'FAILED';
    IF @@ROWCOUNT = 0 THROW 51003, N'Pakartoti galima tik nepavykusį laišką.', 1;
    EXEC audit.usp_Write @ActorUserId, 'EMAIL_RETRY', 'Email', @EmailId, NULL;
END;
GO

/* Audito žurnalo peržiūra (tik GLOBAL_ADMIN). */
CREATE PROCEDURE api.Audit_List
    @ActorUserId int,
    @EntityType  varchar(40) = NULL,
    @EntityId    nvarchar(60) = NULL,
    @Top         int = 200
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 40) THROW 51001, N'Neturite teisės.', 1;
    IF @Top IS NULL OR @Top NOT BETWEEN 1 AND 1000 SET @Top = 200;
    SELECT TOP (@Top) a.AuditId, a.OccurredAt, a.ActorUserId, u.Email AS ActorEmail, a.Action, a.EntityType, a.EntityId, a.DetailsJson
    FROM audit.AuditLog a
    LEFT JOIN iam.[User] u ON u.UserId = a.ActorUserId
    WHERE (@EntityType IS NULL OR a.EntityType = @EntityType)
      AND (@EntityId IS NULL OR a.EntityId = @EntityId)
    ORDER BY a.AuditId DESC;
END;
GO
