/* ==========================================================================
   V013 — Pašto nustatymai sistemoje ir naudotojo įjungimo pataisa.

   1. MAIL_SENDER — dėžutė, iš kurios siunčiami sistemos laiškai. Keičia tik
      globalus administratorius (Nustatymai). Tuščia — laiškai tik kaupiami.
   2. api.Email_GetSender — siuntimo procesui (be naudotojo).
   3. api.Email_SendTest — bandomasis laiškas sau (globalus administratorius).
   4. api.User_SetStatus — kvietimo nepriėmęs naudotojas, išjungtas ir vėl
      įjungtas, grįžta į „Pakviestas“ (anksčiau tapdavo „Aktyvus“, nors
      niekada nebuvo prisijungęs, ir nebebuvo galima persiųsti kvietimo).
   ========================================================================== */
IF NOT EXISTS (SELECT 1 FROM notify.Setting WHERE SettingKey = 'MAIL_SENDER')
    INSERT INTO notify.Setting (SettingKey, SettingValue, Description) VALUES
    ('MAIL_SENDER', NULL, N'Pašto dėžutė, iš kurios siunčiami sistemos laiškai (pvz. uzsakymai@valvesta.lt). Tuščia — laiškai nesiunčiami, tik kaupiami eilėje.');
GO

CREATE OR ALTER PROCEDURE api.Setting_Set
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
    IF @SettingKey = 'MAIL_SENDER' AND @SettingValue IS NOT NULL AND (@SettingValue NOT LIKE N'_%@_%._%' OR @SettingValue LIKE N'% %')
        THROW 51004, N'Neteisingas el. pašto adresas.', 1;
    IF @SettingKey = 'MAIL_SENDER' SET @SettingValue = LOWER(@SettingValue);
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

CREATE PROCEDURE api.Email_GetSender
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SettingValue AS Sender FROM notify.Setting WHERE SettingKey = 'MAIL_SENDER';
END;
GO

CREATE PROCEDURE api.Email_SendTest
    @ActorUserId int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @Email nvarchar(320), @Name nvarchar(200);
    SELECT @Email = u.Email, @Name = u.DisplayName
    FROM iam.tvf_Actor(@ActorUserId) a JOIN iam.[User] u ON u.UserId = a.UserId
    WHERE a.RoleLevel >= 40;
    IF @Email IS NULL THROW 51001, N'Neturite teisės.', 1;

    DECLARE @Sender nvarchar(1000) = (SELECT SettingValue FROM notify.Setting WHERE SettingKey = 'MAIL_SENDER');
    IF @Sender IS NULL THROW 51003, N'Pirmiausia nurodykite siuntėjo dėžutę (MAIL_SENDER).', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Payload nvarchar(max) = (SELECT @Name AS displayName, @Sender AS sender FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC notify.usp_Enqueue 'TEST', @Email, @Payload;
        DECLARE @Id bigint = (SELECT MAX(EmailId) FROM notify.EmailOutbox WHERE TemplateCode = 'TEST' AND ToAddress = @Email);
        DECLARE @IdTxt nvarchar(60) = CAST(@Id AS nvarchar(60));
        EXEC audit.usp_Write @ActorUserId, 'EMAIL_TEST', 'Email', @IdTxt, NULL;
        COMMIT TRANSACTION;
        SELECT @Id AS EmailId, @Email AS ToAddress;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE api.User_SetStatus
    @ActorUserId      int,
    @UserId           int,
    @Status           varchar(20),
    @ExpectedRevision int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Status NOT IN ('ACTIVE', 'DISABLED') THROW 51004, N'Neleistinas statusas.', 1;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_CanManageUser(@ActorUserId, @UserId))
        THROW 51001, N'Neturite teisės.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Current varchar(20), @RoleCode varchar(20), @Rev int;
        SELECT @Current = Status, @RoleCode = RoleCode, @Rev = Revision
        FROM iam.[User] WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @UserId;

        IF @Rev <> @ExpectedRevision THROW 51005, N'Naudotojo duomenys pasikeitė. Atnaujinkite puslapį.', 1;
        IF @Current = 'INVITED' AND @Status = 'ACTIVE'
            THROW 51003, N'Pakviestas naudotojas tampa aktyvus tik priėmęs kvietimą.', 1;

        IF @Current <> @Status
        BEGIN
            -- Negalima išjungti paskutinio globalaus administratoriaus
            IF @Status = 'DISABLED' AND @RoleCode = 'GLOBAL_ADMIN'
               AND NOT EXISTS (SELECT 1 FROM iam.[User] WHERE RoleCode = 'GLOBAL_ADMIN' AND Status = 'ACTIVE' AND UserId <> @UserId)
                THROW 51003, N'Negalima išjungti paskutinio globalaus administratoriaus.', 1;

            -- Iš naujo įjungiant: el. paštas neturi būti užimtas kito aktyvaus naudotojo
            IF @Status = 'ACTIVE' AND EXISTS (SELECT 1 FROM iam.[User] a JOIN iam.[User] b ON a.Email = b.Email
                                              WHERE a.UserId = @UserId AND b.UserId <> @UserId AND b.Status <> 'DISABLED')
                THROW 51006, N'Šis el. paštas jau naudojamas kitos paskyros.', 1;

            -- Dar nė karto neprisijungęs (kvietimo nepriėmęs) naudotojas įjungiamas
            -- atgal į „Pakviestas“ — aktyviu jis tampa tik priėmęs kvietimą.
            DECLARE @NewStatus varchar(20) = @Status;
            IF @Status = 'ACTIVE' AND NOT EXISTS (SELECT 1 FROM iam.UserLogin WHERE UserId = @UserId)
                SET @NewStatus = 'INVITED';

            UPDATE iam.[User] SET Status = @NewStatus, Revision = Revision + 1 WHERE UserId = @UserId;

            IF @Status = 'DISABLED'
                UPDATE iam.Invitation SET Status = 'REVOKED', RevokedAt = SYSUTCDATETIME(), RevokedByUserId = @ActorUserId
                WHERE UserId = @UserId AND Status = 'PENDING';

            DECLARE @Det nvarchar(max) = (SELECT @Current AS fromStatus, @NewStatus AS toStatus FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            EXEC audit.usp_Write @ActorUserId, 'USER_STATUS_CHANGED', 'User', @UserId, @Det;
        END;

        COMMIT TRANSACTION;
        SELECT Status FROM iam.[User] WHERE UserId = @UserId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
