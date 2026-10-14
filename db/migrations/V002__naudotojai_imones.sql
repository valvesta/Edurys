/* ==========================================================================
   V002 — Naudotojai, rolės, įmonės, prisijungimo užklausos, kvietimai.

   Rolių medis (lygis — kuo didesnis, tuo daugiau teisių):
     GLOBAL_ADMIN (40) — visa sistema, gali kurti kitus administratorius
     ADMIN        (30) — tvirtina įmones, valdo užsakymus, katalogus
     COMPANY_REP  (20) — įmonės atstovas: valdo savo įmonės naudotojus
     USER         (10) — įmonės naudotojas: kuria užsakymus

   Taisyklė: vidiniai (GLOBAL_ADMIN, ADMIN) neturi įmonės, įmonių
   (COMPANY_REP, USER) — privalo turėti. Tai užtikrina CHECK apribojimas.

   Prisijungimas mišrus: vienas naudotojas gali turėti kelis prisijungimo
   būdus (iam.UserLogin), kiekvienas identifikuojamas pora (Issuer, Subject):
     - darbuotojai per jūsų Microsoft 365 (Entra ID) nuomininką;
     - klientai per Entra External ID (Microsoft paskyra, el. paštas + kodas ir kt.).
   Slaptažodžių sistema NESAUGO — juos valdo Microsoft.

   Įmonės ir naudotojai — „temporal" lentelės: SQL Server automatiškai saugo
   kiekvieną ankstesnę eilutės versiją (*History lentelėse).
   ========================================================================== */

CREATE TABLE iam.Role (
    RoleCode    varchar(20)   NOT NULL CONSTRAINT PK_Role PRIMARY KEY,
    Name        nvarchar(100) NOT NULL,
    RoleLevel   tinyint       NOT NULL CONSTRAINT UQ_Role_Level UNIQUE,
    IsInternal  bit           NOT NULL
);
GO

INSERT INTO iam.Role (RoleCode, Name, RoleLevel, IsInternal) VALUES
    ('GLOBAL_ADMIN', N'Globalus administratorius', 40, 1),
    ('ADMIN',        N'Administratorius',          30, 1),
    ('COMPANY_REP',  N'Įmonės atstovas',           20, 0),
    ('USER',         N'Naudotojas',                10, 0);
GO

CREATE TABLE org.Company (
    CompanyId        int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_Company PRIMARY KEY,
    Name             nvarchar(200)  NOT NULL,
    CompanyCode      nvarchar(50)   NOT NULL,          -- įmonės kodas (JAR)
    VatCode          nvarchar(50)   NULL,              -- PVM mokėtojo kodas
    Address          nvarchar(400)  NULL,
    Phone            nvarchar(50)   NULL,
    Email            nvarchar(320)  NULL,
    Status           varchar(20)    NOT NULL CONSTRAINT DF_Company_Status DEFAULT ('ACTIVE'),
    CreatedAt        datetime2(3)   NOT NULL CONSTRAINT DF_Company_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedByUserId  int            NULL,
    Revision         int            NOT NULL CONSTRAINT DF_Company_Revision DEFAULT (1),
    ValidFrom        datetime2(3)   GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    ValidTo          datetime2(3)   GENERATED ALWAYS AS ROW END   HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo),
    CONSTRAINT CK_Company_Status CHECK (Status IN ('ACTIVE', 'SUSPENDED')),
    CONSTRAINT CK_Company_Name   CHECK (LEN(LTRIM(RTRIM(Name))) > 0),
    CONSTRAINT CK_Company_Code   CHECK (LEN(LTRIM(RTRIM(CompanyCode))) > 0)
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = org.CompanyHistory));
GO
CREATE UNIQUE INDEX UX_Company_CompanyCode ON org.Company (CompanyCode);
GO

CREATE TABLE iam.[User] (
    UserId           int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_User PRIMARY KEY,
    Email            nvarchar(320)  NOT NULL,
    DisplayName      nvarchar(200)  NULL,
    RoleCode         varchar(20)    NOT NULL CONSTRAINT FK_User_Role REFERENCES iam.Role (RoleCode),
    CompanyId        int            NULL     CONSTRAINT FK_User_Company REFERENCES org.Company (CompanyId),
    Status           varchar(20)    NOT NULL,
    CreatedAt        datetime2(3)   NOT NULL CONSTRAINT DF_User_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedByUserId  int            NULL     CONSTRAINT FK_User_CreatedBy REFERENCES iam.[User] (UserId),
    Revision         int            NOT NULL CONSTRAINT DF_User_Revision DEFAULT (1),
    ValidFrom        datetime2(3)   GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    ValidTo          datetime2(3)   GENERATED ALWAYS AS ROW END   HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo),
    CONSTRAINT CK_User_Status CHECK (Status IN ('INVITED', 'ACTIVE', 'DISABLED')),
    CONSTRAINT CK_User_Email  CHECK (Email LIKE N'_%@_%._%' AND Email NOT LIKE N'% %'),
    CONSTRAINT CK_User_RoleCompany CHECK (
        (RoleCode IN ('GLOBAL_ADMIN', 'ADMIN') AND CompanyId IS NULL) OR
        (RoleCode IN ('COMPANY_REP', 'USER') AND CompanyId IS NOT NULL))
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = iam.UserHistory));
GO
/* Vienas aktyvus/pakviestas naudotojas vienam el. paštui. Išjungtas
   (DISABLED) naudotojas netrukdo pakviesti to paties žmogaus iš naujo. */
CREATE UNIQUE INDEX UX_User_Email_Active ON iam.[User] (Email) WHERE Status <> 'DISABLED';
GO
CREATE INDEX IX_User_Company ON iam.[User] (CompanyId) WHERE CompanyId IS NOT NULL;
GO

ALTER TABLE org.Company ADD CONSTRAINT FK_Company_CreatedBy
    FOREIGN KEY (CreatedByUserId) REFERENCES iam.[User] (UserId);
GO

/* Prisijungimo būdai. Issuer — tokeno „iss" (kuris Microsoft nuomininkas
   išdavė), Subject — nekintamas naudotojo ID tame nuomininke („oid").
   El. paštas identifikavimui NENAUDOJAMAS, nes jis gali keistis. */
CREATE TABLE iam.UserLogin (
    UserLoginId  int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserLogin PRIMARY KEY,
    UserId       int            NOT NULL CONSTRAINT FK_UserLogin_User REFERENCES iam.[User] (UserId),
    Issuer       nvarchar(400)  NOT NULL,
    Subject      nvarchar(200)  NOT NULL,
    CreatedAt    datetime2(3)   NOT NULL CONSTRAINT DF_UserLogin_CreatedAt DEFAULT (SYSUTCDATETIME()),
    LastUsedAt   datetime2(3)   NULL,
    CONSTRAINT UQ_UserLogin_IssuerSubject UNIQUE (Issuer, Subject)
);
GO
CREATE INDEX IX_UserLogin_User ON iam.UserLogin (UserId);
GO

/* Kvietimai. DB saugo TIK žetono SHA-256 maišą — pats žetonas yra tik
   laiške. Net nutekėjus duomenų bazei, kvietimo panaudoti neįmanoma. */
CREATE TABLE iam.Invitation (
    InvitationId     int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_Invitation PRIMARY KEY,
    UserId           int            NOT NULL CONSTRAINT FK_Invitation_User REFERENCES iam.[User] (UserId),
    Email            nvarchar(320)  NOT NULL,
    TokenHash        binary(32)     NOT NULL CONSTRAINT UQ_Invitation_Token UNIQUE,
    Status           varchar(20)    NOT NULL CONSTRAINT DF_Invitation_Status DEFAULT ('PENDING'),
    ExpiresAt        datetime2(3)   NOT NULL,
    CreatedAt        datetime2(3)   NOT NULL CONSTRAINT DF_Invitation_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedByUserId  int            NULL     CONSTRAINT FK_Invitation_CreatedBy REFERENCES iam.[User] (UserId),
    AcceptedAt       datetime2(3)   NULL,
    RevokedAt        datetime2(3)   NULL,
    RevokedByUserId  int            NULL     CONSTRAINT FK_Invitation_RevokedBy REFERENCES iam.[User] (UserId),
    CONSTRAINT CK_Invitation_Status CHECK (Status IN ('PENDING', 'ACCEPTED', 'REVOKED')),
    CONSTRAINT CK_Invitation_Expiry CHECK (ExpiresAt > CreatedAt)
);
GO
CREATE INDEX IX_Invitation_User ON iam.Invitation (UserId, Status);
GO

/* Įmonių prisijungimo užklausos (vieša forma). Kol užklausa nepatvirtinta,
   jokia paskyra nesukuriama. */
CREATE TABLE org.AccessRequest (
    AccessRequestId   int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_AccessRequest PRIMARY KEY,
    CompanyName       nvarchar(200)  NOT NULL,
    CompanyCode       nvarchar(50)   NOT NULL,
    VatCode           nvarchar(50)   NULL,
    Address           nvarchar(400)  NULL,
    ContactName       nvarchar(200)  NOT NULL,
    ContactEmail      nvarchar(320)  NOT NULL,
    ContactPhone      nvarchar(50)   NULL,
    Message           nvarchar(2000) NULL,
    Status            varchar(20)    NOT NULL CONSTRAINT DF_AccessRequest_Status DEFAULT ('PENDING'),
    SubmittedAt       datetime2(3)   NOT NULL CONSTRAINT DF_AccessRequest_SubmittedAt DEFAULT (SYSUTCDATETIME()),
    SubmittedFromIp   varchar(45)    NULL,
    ReviewedByUserId  int            NULL CONSTRAINT FK_AccessRequest_ReviewedBy REFERENCES iam.[User] (UserId),
    ReviewedAt        datetime2(3)   NULL,
    ReviewNote        nvarchar(1000) NULL,
    CompanyId         int            NULL CONSTRAINT FK_AccessRequest_Company REFERENCES org.Company (CompanyId),
    CONSTRAINT CK_AccessRequest_Status CHECK (Status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT CK_AccessRequest_Email  CHECK (ContactEmail LIKE N'_%@_%._%' AND ContactEmail NOT LIKE N'% %'),
    CONSTRAINT CK_AccessRequest_Review CHECK (
        (Status = 'PENDING'  AND ReviewedAt IS NULL AND CompanyId IS NULL) OR
        (Status = 'APPROVED' AND ReviewedAt IS NOT NULL AND CompanyId IS NOT NULL) OR
        (Status = 'REJECTED' AND ReviewedAt IS NOT NULL AND CompanyId IS NULL))
);
GO
/* Ta pati įmonė negali turėti dviejų laukiančių užklausų vienu metu. */
CREATE UNIQUE INDEX UX_AccessRequest_PendingCompany ON org.AccessRequest (CompanyCode) WHERE Status = 'PENDING';
GO
CREATE INDEX IX_AccessRequest_Status ON org.AccessRequest (Status, SubmittedAt);
GO
