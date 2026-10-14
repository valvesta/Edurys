/* ==========================================================================
   V006 — Procedūros: prisijungimas, kvietimai, naudotojai, įmonės,
   prisijungimo užklausos.

   Klaidų kodai (THROW), kuriuos API paverčia HTTP atsakymais:
     51001 — neturite teisės (403)
     51002 — nerasta (404)
     51003 — netinkama būsena (409)
     51004 — neteisingi duomenys (400)
     51005 — duomenis jau pakeitė kitas naudotojas (409, reikia atnaujinti)
     51006 — toks įrašas jau yra (409)
     51007 — per daug užklausų (429)

   Kiekviena procedūra, kuri kviečiama naudotojo vardu, gauna @ActorUserId.
   Jį API nustato TIK iš patikrinto Microsoft prisijungimo žetono (per
   api.User_ResolveLogin) — niekada iš naršyklės atsiųstų duomenų.
   Teisės tikrinamos ČIA, duomenų bazėje, net jei API jas jau patikrino.
   ========================================================================== */

/* Aktyvus veikėjas: grąžina eilutę tik jei naudotojas aktyvus ir (jei
   priklauso įmonei) įmonė aktyvi. Tuščias rezultatas = jokių teisių. */
CREATE FUNCTION iam.tvf_Actor (@UserId int)
RETURNS TABLE
AS
RETURN
    SELECT u.UserId, u.Email, u.RoleCode, r.RoleLevel, u.CompanyId
    FROM iam.[User] u
    JOIN iam.Role r ON r.RoleCode = u.RoleCode
    LEFT JOIN org.Company c ON c.CompanyId = u.CompanyId
    WHERE u.UserId = @UserId
      AND u.Status = 'ACTIVE'
      AND (u.CompanyId IS NULL OR c.Status = 'ACTIVE');
GO

/* Ar veikėjas gali valdyti kitą naudotoją (išjungti, pakviesti iš naujo):
     GLOBAL_ADMIN — bet ką, išskyrus save;
     ADMIN        — tik žemesnio lygio (įmonių naudotojus);
     COMPANY_REP  — tik savo įmonės USER. */
CREATE FUNCTION iam.tvf_CanManageUser (@ActorUserId int, @TargetUserId int)
RETURNS TABLE
AS
RETURN
    SELECT t.UserId
    FROM iam.tvf_Actor(@ActorUserId) a
    JOIN iam.[User] t ON t.UserId = @TargetUserId
    JOIN iam.Role tr ON tr.RoleCode = t.RoleCode
    WHERE t.UserId <> a.UserId
      AND (   a.RoleLevel = 40
           OR (a.RoleLevel = 30 AND tr.RoleLevel < 30)
           OR (a.RoleLevel = 20 AND tr.RoleLevel < 20 AND t.CompanyId = a.CompanyId));
GO

/* --------------------------------------------------------------------------
   Prisijungimas
   -------------------------------------------------------------------------- */

/* Kviečiama po kiekvieno sėkmingo Microsoft prisijungimo.
   LoginResult: OK | NOT_LINKED (dar nėra paskyros — reikia kvietimo) |
                DISABLED (paskyra arba įmonė išjungta). */
CREATE PROCEDURE api.User_ResolveLogin
    @Issuer  nvarchar(400),
    @Subject nvarchar(200)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId int, @UserLoginId int;
    SELECT @UserId = l.UserId, @UserLoginId = l.UserLoginId
    FROM iam.UserLogin l
    WHERE l.Issuer = @Issuer AND l.Subject = @Subject;

    IF @UserId IS NULL
    BEGIN
        SELECT CAST('NOT_LINKED' AS varchar(20)) AS LoginResult;
        RETURN;
    END;

    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@UserId))
    BEGIN
        SELECT CAST('DISABLED' AS varchar(20)) AS LoginResult;
        RETURN;
    END;

    UPDATE iam.UserLogin SET LastUsedAt = SYSUTCDATETIME() WHERE UserLoginId = @UserLoginId;

    SELECT CAST('OK' AS varchar(20)) AS LoginResult,
           u.UserId, u.Email, u.DisplayName, u.RoleCode, r.Name AS RoleName, r.RoleLevel,
           u.CompanyId, c.Name AS CompanyName
    FROM iam.[User] u
    JOIN iam.Role r ON r.RoleCode = u.RoleCode
    LEFT JOIN org.Company c ON c.CompanyId = u.CompanyId
    WHERE u.UserId = @UserId;
END;
GO

/* Kvietimo priėmimas: susieja Microsoft prisijungimą su pakviestu naudotoju.
   El. paštas iš Microsoft žetono PRIVALO sutapti su kvietimo el. paštu. */
CREATE PROCEDURE api.Invitation_Accept
    @TokenHash   binary(32),
    @Issuer      nvarchar(400),
    @Subject     nvarchar(200),
    @Email       nvarchar(320),
    @DisplayName nvarchar(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TokenHash IS NULL OR DATALENGTH(@TokenHash) <> 32 OR @Issuer IS NULL OR @Subject IS NULL OR @Email IS NULL
        THROW 51004, N'Trūksta prisijungimo duomenų.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @InvitationId int, @UserId int, @InviteEmail nvarchar(320), @ExpiresAt datetime2(3), @InvStatus varchar(20);
        SELECT @InvitationId = i.InvitationId, @UserId = i.UserId, @InviteEmail = i.Email,
               @ExpiresAt = i.ExpiresAt, @InvStatus = i.Status
        FROM iam.Invitation i WITH (UPDLOCK, HOLDLOCK)
        WHERE i.TokenHash = @TokenHash;

        -- Sąmoningai vienoda žinutė visais atvejais: neatskleidžiame, ar žetonas egzistuoja.
        IF @InvitationId IS NULL OR @InvStatus <> 'PENDING' OR @ExpiresAt <= SYSUTCDATETIME()
            THROW 51004, N'Kvietimas negalioja arba jau panaudotas. Paprašykite naujo kvietimo.', 1;

        IF LOWER(LTRIM(RTRIM(@Email))) <> LOWER(@InviteEmail)
            THROW 51001, N'Prisijungėte kitu el. paštu nei buvote pakviesti. Prisijunkite tuo el. paštu, kuriuo gavote kvietimą.', 1;

        IF NOT EXISTS (SELECT 1 FROM iam.[User] u
                       LEFT JOIN org.Company c ON c.CompanyId = u.CompanyId
                       WHERE u.UserId = @UserId AND u.Status = 'INVITED'
                         AND (u.CompanyId IS NULL OR c.Status = 'ACTIVE'))
            THROW 51003, N'Paskyra nebegalioja. Kreipkitės į administratorių.', 1;

        IF EXISTS (SELECT 1 FROM iam.UserLogin WHERE Issuer = @Issuer AND Subject = @Subject)
            THROW 51006, N'Šis Microsoft prisijungimas jau susietas su kita paskyra.', 1;

        INSERT INTO iam.UserLogin (UserId, Issuer, Subject, LastUsedAt)
        VALUES (@UserId, @Issuer, @Subject, SYSUTCDATETIME());

        UPDATE iam.[User]
        SET Status = 'ACTIVE',
            DisplayName = COALESCE(DisplayName, NULLIF(LTRIM(RTRIM(@DisplayName)), N'')),
            Revision = Revision + 1
        WHERE UserId = @UserId;

        UPDATE iam.Invitation SET Status = 'ACCEPTED', AcceptedAt = SYSUTCDATETIME()
        WHERE InvitationId = @InvitationId;

        DECLARE @Det nvarchar(max) = (SELECT @InvitationId AS invitationId, @Issuer AS issuer FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @UserId, 'INVITATION_ACCEPTED', 'User', @UserId, @Det;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    EXEC api.User_ResolveLogin @Issuer = @Issuer, @Subject = @Subject;
END;
GO

/* --------------------------------------------------------------------------
   Kvietimai
   -------------------------------------------------------------------------- */

/* Vidinė: sukuria kvietimą esamam INVITED naudotojui ir įdeda laišką. */
CREATE PROCEDURE iam.usp_IssueInvitation
    @ActorUserId  int,
    @UserId       int,
    @TokenHash    binary(32),
    @ExpiresAt    datetime2(3),
    @InviteUrl    nvarchar(1000),
    @TemplateCode varchar(50),
    @InvitationId int OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @TokenHash IS NULL OR DATALENGTH(@TokenHash) <> 32
        THROW 51004, N'Neteisingas kvietimo žetonas.', 1;
    IF @ExpiresAt IS NULL OR @ExpiresAt < DATEADD(MINUTE, 10, SYSUTCDATETIME()) OR @ExpiresAt > DATEADD(DAY, 30, SYSUTCDATETIME())
        THROW 51004, N'Kvietimo galiojimas turi būti nuo 10 minučių iki 30 dienų.', 1;
    IF @InviteUrl IS NULL OR @InviteUrl NOT LIKE N'https://%'
        THROW 51004, N'Kvietimo nuoroda turi prasidėti https://', 1;

    -- Ankstesni nepanaudoti kvietimai tam pačiam naudotojui atšaukiami
    UPDATE iam.Invitation
    SET Status = 'REVOKED', RevokedAt = SYSUTCDATETIME(), RevokedByUserId = @ActorUserId
    WHERE UserId = @UserId AND Status = 'PENDING';

    DECLARE @Email nvarchar(320);
    SELECT @Email = Email FROM iam.[User] WHERE UserId = @UserId;

    INSERT INTO iam.Invitation (UserId, Email, TokenHash, ExpiresAt, CreatedByUserId)
    VALUES (@UserId, @Email, @TokenHash, @ExpiresAt, @ActorUserId);
    SET @InvitationId = SCOPE_IDENTITY();

    DECLARE @Payload nvarchar(max) = (
        SELECT @InviteUrl AS inviteUrl,
               u.DisplayName AS displayName,
               r.Name AS roleName,
               c.Name AS companyName,
               a.DisplayName AS invitedBy,
               @ExpiresAt AS expiresAt
        FROM iam.[User] u
        JOIN iam.Role r ON r.RoleCode = u.RoleCode
        LEFT JOIN org.Company c ON c.CompanyId = u.CompanyId
        LEFT JOIN iam.[User] a ON a.UserId = @ActorUserId
        WHERE u.UserId = @UserId
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

    -- IsSensitive = 1: nuoroda su žetonu ištrinama iš eilės iškart po išsiuntimo
    EXEC notify.usp_Enqueue @TemplateCode, @Email, @Payload, 'Invitation', @InvitationId, 1;
END;
GO

/* Naujo naudotojo pakvietimas. */
CREATE PROCEDURE api.Invitation_Create
    @ActorUserId  int,
    @Email        nvarchar(320),
    @DisplayName  nvarchar(200),
    @RoleCode     varchar(20),
    @CompanyId    int = NULL,
    @TokenHash    binary(32),
    @ExpiresAt    datetime2(3),
    @InviteUrl    nvarchar(1000)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ALevel tinyint, @ACompanyId int, @TLevel tinyint, @TInternal bit;
    SELECT @ALevel = RoleLevel, @ACompanyId = CompanyId FROM iam.tvf_Actor(@ActorUserId);
    IF @ALevel IS NULL THROW 51001, N'Neturite teisės.', 1;

    SELECT @TLevel = RoleLevel, @TInternal = IsInternal FROM iam.Role WHERE RoleCode = @RoleCode;
    IF @TLevel IS NULL THROW 51004, N'Nežinoma rolė.', 1;

    -- Kas ką gali kviesti
    IF NOT (   (@ALevel = 40)
            OR (@ALevel = 30 AND @TLevel < 30)
            OR (@ALevel = 20 AND @TLevel = 10))
        THROW 51001, N'Neturite teisės kviesti naudotojo su šia role.', 1;

    -- Įmonės atstovas kviečia tik į savo įmonę
    IF @ALevel = 20 SET @CompanyId = @ACompanyId;

    IF @TInternal = 1 AND @CompanyId IS NOT NULL
        THROW 51004, N'Administratorius negali priklausyti įmonei.', 1;
    IF @TInternal = 0 AND @CompanyId IS NULL
        THROW 51004, N'Įmonės naudotojui būtina nurodyti įmonę.', 1;
    IF @CompanyId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM org.Company WHERE CompanyId = @CompanyId AND Status = 'ACTIVE')
        THROW 51002, N'Įmonė nerasta arba neaktyvi.', 1;

    SET @Email = LOWER(LTRIM(RTRIM(@Email)));
    IF @Email IS NULL OR @Email NOT LIKE N'_%@_%._%' OR @Email LIKE N'% %' OR LEN(@Email) > 320
        THROW 51004, N'Neteisingas el. pašto adresas.', 1;
    SET @DisplayName = NULLIF(LTRIM(RTRIM(@DisplayName)), N'');

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (SELECT 1 FROM iam.[User] WITH (UPDLOCK, HOLDLOCK) WHERE Email = @Email AND Status <> 'DISABLED')
            THROW 51006, N'Naudotojas su šiuo el. paštu jau yra.', 1;

        INSERT INTO iam.[User] (Email, DisplayName, RoleCode, CompanyId, Status, CreatedByUserId)
        VALUES (@Email, @DisplayName, @RoleCode, @CompanyId, 'INVITED', @ActorUserId);
        DECLARE @UserId int = SCOPE_IDENTITY();

        DECLARE @InvitationId int;
        EXEC iam.usp_IssueInvitation @ActorUserId, @UserId, @TokenHash, @ExpiresAt, @InviteUrl, 'USER_INVITATION', @InvitationId OUTPUT;

        DECLARE @Det nvarchar(max) = (SELECT @Email AS email, @RoleCode AS roleCode, @CompanyId AS companyId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @ActorUserId, 'USER_INVITED', 'User', @UserId, @Det;

        COMMIT TRANSACTION;
        SELECT @UserId AS UserId, @InvitationId AS InvitationId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* Pakartotinis kvietimas (pvz. senasis nebegalioja). */
CREATE PROCEDURE api.Invitation_Resend
    @ActorUserId  int,
    @UserId       int,
    @TokenHash    binary(32),
    @ExpiresAt    datetime2(3),
    @InviteUrl    nvarchar(1000)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM iam.tvf_CanManageUser(@ActorUserId, @UserId))
        THROW 51001, N'Neturite teisės.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM iam.[User] WITH (UPDLOCK) WHERE UserId = @UserId AND Status = 'INVITED')
            THROW 51003, N'Kvietimą galima siųsti tik dar neprisijungusiam naudotojui.', 1;

        DECLARE @InvitationId int;
        EXEC iam.usp_IssueInvitation @ActorUserId, @UserId, @TokenHash, @ExpiresAt, @InviteUrl, 'USER_INVITATION', @InvitationId OUTPUT;
        EXEC audit.usp_Write @ActorUserId, 'INVITATION_RESENT', 'User', @UserId, NULL;
        COMMIT TRANSACTION;
        SELECT @UserId AS UserId, @InvitationId AS InvitationId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Naudotojai
   -------------------------------------------------------------------------- */

CREATE PROCEDURE api.User_List
    @ActorUserId int,
    @CompanyId   int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ALevel tinyint, @ACompanyId int;
    SELECT @ALevel = RoleLevel, @ACompanyId = CompanyId FROM iam.tvf_Actor(@ActorUserId);
    IF @ALevel IS NULL OR @ALevel < 20 THROW 51001, N'Neturite teisės.', 1;
    IF @ALevel = 20 SET @CompanyId = @ACompanyId;   -- atstovas mato tik savo įmonę

    SELECT u.UserId, u.Email, u.DisplayName, u.RoleCode, r.Name AS RoleName, u.CompanyId, c.Name AS CompanyName,
           u.Status, u.CreatedAt, u.Revision,
           (SELECT MAX(l.LastUsedAt) FROM iam.UserLogin l WHERE l.UserId = u.UserId) AS LastLoginAt
    FROM iam.[User] u
    JOIN iam.Role r ON r.RoleCode = u.RoleCode
    LEFT JOIN org.Company c ON c.CompanyId = u.CompanyId
    WHERE (@CompanyId IS NULL OR u.CompanyId = @CompanyId)
      AND (@ALevel >= 30 OR u.CompanyId = @ACompanyId)
    ORDER BY c.Name, r.RoleLevel DESC, u.Email;
END;
GO

/* Naudotojo įjungimas/išjungimas. */
CREATE PROCEDURE api.User_SetStatus
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

            UPDATE iam.[User] SET Status = @Status, Revision = Revision + 1 WHERE UserId = @UserId;

            IF @Status = 'DISABLED'
                UPDATE iam.Invitation SET Status = 'REVOKED', RevokedAt = SYSUTCDATETIME(), RevokedByUserId = @ActorUserId
                WHERE UserId = @UserId AND Status = 'PENDING';

            DECLARE @Det nvarchar(max) = (SELECT @Current AS fromStatus, @Status AS toStatus FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            EXEC audit.usp_Write @ActorUserId, 'USER_STATUS_CHANGED', 'User', @UserId, @Det;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Įmonių prisijungimo užklausos
   -------------------------------------------------------------------------- */

/* Vieša forma (be prisijungimo). Apsauga nuo piktnaudžiavimo: ne daugiau
   kaip 5 užklausos iš to paties IP per valandą (API turi ir savo ribojimą). */
CREATE PROCEDURE api.AccessRequest_Submit
    @CompanyName      nvarchar(200),
    @CompanyCode      nvarchar(50),
    @VatCode          nvarchar(50) = NULL,
    @Address          nvarchar(400) = NULL,
    @ContactName      nvarchar(200),
    @ContactEmail     nvarchar(320),
    @ContactPhone     nvarchar(50) = NULL,
    @Message          nvarchar(2000) = NULL,
    @SubmittedFromIp  varchar(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @CompanyName  = NULLIF(LTRIM(RTRIM(@CompanyName)), N'');
    SET @CompanyCode  = NULLIF(REPLACE(LTRIM(RTRIM(@CompanyCode)), N' ', N''), N'');
    SET @VatCode      = NULLIF(UPPER(REPLACE(LTRIM(RTRIM(@VatCode)), N' ', N'')), N'');
    SET @Address      = NULLIF(LTRIM(RTRIM(@Address)), N'');
    SET @ContactName  = NULLIF(LTRIM(RTRIM(@ContactName)), N'');
    SET @ContactEmail = LOWER(NULLIF(LTRIM(RTRIM(@ContactEmail)), N''));
    SET @ContactPhone = NULLIF(LTRIM(RTRIM(@ContactPhone)), N'');
    SET @Message      = NULLIF(LTRIM(RTRIM(@Message)), N'');

    IF @CompanyName IS NULL OR @CompanyCode IS NULL OR @ContactName IS NULL OR @ContactEmail IS NULL
        THROW 51004, N'Užpildykite visus privalomus laukus: įmonės pavadinimas, įmonės kodas, kontaktinis asmuo, el. paštas.', 1;
    IF @ContactEmail NOT LIKE N'_%@_%._%' OR @ContactEmail LIKE N'% %'
        THROW 51004, N'Neteisingas el. pašto adresas.', 1;
    IF @CompanyCode LIKE N'%[^0-9A-Za-z-]%'
        THROW 51004, N'Įmonės kodas gali turėti tik skaitmenis, raides ir brūkšnelį.', 1;

    IF @SubmittedFromIp IS NOT NULL AND
       (SELECT COUNT(*) FROM org.AccessRequest
        WHERE SubmittedFromIp = @SubmittedFromIp AND SubmittedAt > DATEADD(HOUR, -1, SYSUTCDATETIME())) >= 5
        THROW 51007, N'Per daug užklausų. Pabandykite vėliau.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (SELECT 1 FROM org.Company WHERE CompanyCode = @CompanyCode)
            THROW 51006, N'Ši įmonė jau užregistruota. Kreipkitės į savo įmonės atstovą, kad jus pakviestų.', 1;
        IF EXISTS (SELECT 1 FROM org.AccessRequest WITH (UPDLOCK, HOLDLOCK) WHERE CompanyCode = @CompanyCode AND Status = 'PENDING')
            THROW 51006, N'Šios įmonės užklausa jau gauta ir laukia patvirtinimo.', 1;

        INSERT INTO org.AccessRequest (CompanyName, CompanyCode, VatCode, Address, ContactName, ContactEmail,
                                       ContactPhone, Message, SubmittedFromIp)
        VALUES (@CompanyName, @CompanyCode, @VatCode, @Address, @ContactName, @ContactEmail,
                @ContactPhone, @Message, @SubmittedFromIp);
        DECLARE @Id int = SCOPE_IDENTITY();

        DECLARE @Payload nvarchar(max) = (
            SELECT @Id AS accessRequestId, @CompanyName AS companyName, @CompanyCode AS companyCode,
                   @ContactName AS contactName, @ContactEmail AS contactEmail
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);

        EXEC notify.usp_Enqueue 'ACCESS_REQUEST_RECEIVED', @ContactEmail, @Payload, 'AccessRequest', @Id, 0;
        DECLARE @AdminEmail nvarchar(1000) = (SELECT SettingValue FROM notify.Setting WHERE SettingKey = 'ADMIN_NOTIFY_EMAIL');
        EXEC notify.usp_Enqueue 'ACCESS_REQUEST_NEW', @AdminEmail, @Payload, 'AccessRequest', @Id, 0;

        EXEC audit.usp_Write NULL, 'ACCESS_REQUEST_SUBMITTED', 'AccessRequest', @Id, @Payload;

        COMMIT TRANSACTION;
        SELECT @Id AS AccessRequestId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE PROCEDURE api.AccessRequest_List
    @ActorUserId int,
    @Status      varchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30)
        THROW 51001, N'Neturite teisės.', 1;

    SELECT ar.AccessRequestId, ar.CompanyName, ar.CompanyCode, ar.VatCode, ar.Address, ar.ContactName,
           ar.ContactEmail, ar.ContactPhone, ar.Message, ar.Status, ar.SubmittedAt,
           ar.ReviewedAt, ar.ReviewNote, rv.DisplayName AS ReviewedBy, ar.CompanyId
    FROM org.AccessRequest ar
    LEFT JOIN iam.[User] rv ON rv.UserId = ar.ReviewedByUserId
    WHERE @Status IS NULL OR ar.Status = @Status
    ORDER BY CASE WHEN ar.Status = 'PENDING' THEN 0 ELSE 1 END, ar.SubmittedAt DESC;
END;
GO

/* Patvirtinimas: sukuriama įmonė, kontaktinis asmuo tampa įmonės atstovu
   (pakviestas), išsiunčiamas kvietimas. Viskas — viena transakcija. */
CREATE PROCEDURE api.AccessRequest_Approve
    @ActorUserId      int,
    @AccessRequestId  int,
    @ReviewNote       nvarchar(1000) = NULL,
    @TokenHash        binary(32),
    @ExpiresAt        datetime2(3),
    @InviteUrl        nvarchar(1000)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30)
        THROW 51001, N'Neturite teisės.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Status varchar(20), @CompanyName nvarchar(200), @CompanyCode nvarchar(50), @VatCode nvarchar(50),
                @Address nvarchar(400), @ContactName nvarchar(200), @ContactEmail nvarchar(320), @ContactPhone nvarchar(50);
        SELECT @Status = Status, @CompanyName = CompanyName, @CompanyCode = CompanyCode, @VatCode = VatCode,
               @Address = Address, @ContactName = ContactName, @ContactEmail = ContactEmail, @ContactPhone = ContactPhone
        FROM org.AccessRequest WITH (UPDLOCK, HOLDLOCK)
        WHERE AccessRequestId = @AccessRequestId;

        IF @Status IS NULL THROW 51002, N'Užklausa nerasta.', 1;
        IF @Status <> 'PENDING' THROW 51003, N'Užklausa jau išnagrinėta.', 1;
        IF EXISTS (SELECT 1 FROM org.Company WITH (UPDLOCK, HOLDLOCK) WHERE CompanyCode = @CompanyCode)
            THROW 51006, N'Įmonė su tokiu kodu jau yra. Atmeskite užklausą ir pakvieskite naudotoją į esamą įmonę.', 1;
        IF EXISTS (SELECT 1 FROM iam.[User] WITH (UPDLOCK, HOLDLOCK) WHERE Email = @ContactEmail AND Status <> 'DISABLED')
            THROW 51006, N'Kontaktinio asmens el. paštas jau naudojamas kitos paskyros.', 1;

        INSERT INTO org.Company (Name, CompanyCode, VatCode, Address, Phone, Email, CreatedByUserId)
        VALUES (@CompanyName, @CompanyCode, @VatCode, @Address, @ContactPhone, @ContactEmail, @ActorUserId);
        DECLARE @CompanyId int = SCOPE_IDENTITY();

        INSERT INTO iam.[User] (Email, DisplayName, RoleCode, CompanyId, Status, CreatedByUserId)
        VALUES (@ContactEmail, @ContactName, 'COMPANY_REP', @CompanyId, 'INVITED', @ActorUserId);
        DECLARE @UserId int = SCOPE_IDENTITY();

        UPDATE org.AccessRequest
        SET Status = 'APPROVED', ReviewedByUserId = @ActorUserId, ReviewedAt = SYSUTCDATETIME(),
            ReviewNote = NULLIF(LTRIM(RTRIM(@ReviewNote)), N''), CompanyId = @CompanyId
        WHERE AccessRequestId = @AccessRequestId;

        DECLARE @InvitationId int;
        EXEC iam.usp_IssueInvitation @ActorUserId, @UserId, @TokenHash, @ExpiresAt, @InviteUrl, 'ACCESS_APPROVED_INVITATION', @InvitationId OUTPUT;

        DECLARE @Det nvarchar(max) = (SELECT @CompanyId AS companyId, @UserId AS userId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @ActorUserId, 'ACCESS_REQUEST_APPROVED', 'AccessRequest', @AccessRequestId, @Det;

        COMMIT TRANSACTION;
        SELECT @CompanyId AS CompanyId, @UserId AS UserId, @InvitationId AS InvitationId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE PROCEDURE api.AccessRequest_Reject
    @ActorUserId      int,
    @AccessRequestId  int,
    @ReviewNote       nvarchar(1000)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30)
        THROW 51001, N'Neturite teisės.', 1;
    SET @ReviewNote = NULLIF(LTRIM(RTRIM(@ReviewNote)), N'');
    IF @ReviewNote IS NULL THROW 51004, N'Nurodykite atmetimo priežastį.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Status varchar(20), @ContactEmail nvarchar(320), @CompanyName nvarchar(200), @ContactName nvarchar(200);
        SELECT @Status = Status, @ContactEmail = ContactEmail, @CompanyName = CompanyName, @ContactName = ContactName
        FROM org.AccessRequest WITH (UPDLOCK, HOLDLOCK) WHERE AccessRequestId = @AccessRequestId;

        IF @Status IS NULL THROW 51002, N'Užklausa nerasta.', 1;
        IF @Status <> 'PENDING' THROW 51003, N'Užklausa jau išnagrinėta.', 1;

        UPDATE org.AccessRequest
        SET Status = 'REJECTED', ReviewedByUserId = @ActorUserId, ReviewedAt = SYSUTCDATETIME(), ReviewNote = @ReviewNote
        WHERE AccessRequestId = @AccessRequestId;

        DECLARE @Payload nvarchar(max) = (SELECT @CompanyName AS companyName, @ContactName AS contactName,
                                                 @ReviewNote AS reason FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC notify.usp_Enqueue 'ACCESS_REQUEST_REJECTED', @ContactEmail, @Payload, 'AccessRequest', @AccessRequestId, 0;
        EXEC audit.usp_Write @ActorUserId, 'ACCESS_REQUEST_REJECTED', 'AccessRequest', @AccessRequestId, @Payload;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Įmonės
   -------------------------------------------------------------------------- */

CREATE PROCEDURE api.Company_List
    @ActorUserId int
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30)
        THROW 51001, N'Neturite teisės.', 1;

    SELECT c.CompanyId, c.Name, c.CompanyCode, c.VatCode, c.Address, c.Phone, c.Email, c.Status, c.CreatedAt, c.Revision,
           (SELECT COUNT(*) FROM iam.[User] u WHERE u.CompanyId = c.CompanyId AND u.Status = 'ACTIVE') AS ActiveUsers,
           (SELECT COUNT(*) FROM sales.[Order] o WHERE o.CompanyId = c.CompanyId) AS OrderCount
    FROM org.Company c
    ORDER BY c.Name;
END;
GO

CREATE PROCEDURE api.Company_SetStatus
    @ActorUserId      int,
    @CompanyId        int,
    @Status           varchar(20),
    @ExpectedRevision int
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30)
        THROW 51001, N'Neturite teisės.', 1;
    IF @Status NOT IN ('ACTIVE', 'SUSPENDED') THROW 51004, N'Neleistinas statusas.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Current varchar(20), @Rev int;
        SELECT @Current = Status, @Rev = Revision FROM org.Company WITH (UPDLOCK, HOLDLOCK) WHERE CompanyId = @CompanyId;
        IF @Current IS NULL THROW 51002, N'Įmonė nerasta.', 1;
        IF @Rev <> @ExpectedRevision THROW 51005, N'Įmonės duomenys pasikeitė. Atnaujinkite puslapį.', 1;

        IF @Current <> @Status
        BEGIN
            UPDATE org.Company SET Status = @Status, Revision = Revision + 1 WHERE CompanyId = @CompanyId;
            DECLARE @Det nvarchar(max) = (SELECT @Current AS fromStatus, @Status AS toStatus FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            EXEC audit.usp_Write @ActorUserId, 'COMPANY_STATUS_CHANGED', 'Company', @CompanyId, @Det;
        END;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

/* --------------------------------------------------------------------------
   Pirmasis globalus administratorius (TIK diegimo/priežiūros rolei).
   Veikia tik tol, kol nėra nė vieno aktyvaus globalaus administratoriaus —
   vėliau administratoriai kviečiami įprastai.
   -------------------------------------------------------------------------- */
CREATE PROCEDURE admin.Bootstrap_GlobalAdmin
    @Email       nvarchar(320),
    @DisplayName nvarchar(200),
    @Issuer      nvarchar(400),
    @Subject     nvarchar(200)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Email = LOWER(LTRIM(RTRIM(@Email)));
    IF @Email IS NULL OR @Issuer IS NULL OR @Subject IS NULL
        THROW 51004, N'Būtina nurodyti el. paštą, Issuer ir Subject (oid).', 1;

    BEGIN TRY
        BEGIN TRANSACTION;
        IF EXISTS (SELECT 1 FROM iam.[User] WITH (UPDLOCK, HOLDLOCK) WHERE RoleCode = 'GLOBAL_ADMIN' AND Status = 'ACTIVE')
            THROW 51003, N'Globalus administratorius jau yra. Naujus administratorius kvieskite per sistemą.', 1;

        INSERT INTO iam.[User] (Email, DisplayName, RoleCode, CompanyId, Status)
        VALUES (@Email, @DisplayName, 'GLOBAL_ADMIN', NULL, 'ACTIVE');
        DECLARE @UserId int = SCOPE_IDENTITY();

        INSERT INTO iam.UserLogin (UserId, Issuer, Subject) VALUES (@UserId, @Issuer, @Subject);

        DECLARE @Det nvarchar(max) = (SELECT @Email AS email, ORIGINAL_LOGIN() AS executedBy FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write NULL, 'BOOTSTRAP_GLOBAL_ADMIN', 'User', @UserId, @Det;
        COMMIT TRANSACTION;
        SELECT @UserId AS UserId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
