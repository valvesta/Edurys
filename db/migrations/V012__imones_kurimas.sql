/* ==========================================================================
   V012 — Administratorius gali įmonę sukurti tiesiogiai (be prisijungimo
   užklausos). Naudotojai į ją kviečiami įprastai (Naudotojai -> Pakviesti).
   Tos pačios taisyklės kaip tvirtinant užklausą: privalomas pavadinimas ir
   kodas, kodas unikalus, el. paštas — teisingo formato.
   ========================================================================== */
CREATE PROCEDURE api.Company_Create
    @ActorUserId  int,
    @Name         nvarchar(200),
    @CompanyCode  nvarchar(50),
    @VatCode      nvarchar(50)  = NULL,
    @Address      nvarchar(400) = NULL,
    @Phone        nvarchar(50)  = NULL,
    @Email        nvarchar(320) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM iam.tvf_Actor(@ActorUserId) WHERE RoleLevel >= 30)
        THROW 51001, N'Neturite teisės.', 1;

    SET @Name        = NULLIF(LTRIM(RTRIM(@Name)), N'');
    SET @CompanyCode = NULLIF(REPLACE(LTRIM(RTRIM(@CompanyCode)), N' ', N''), N'');
    SET @VatCode     = NULLIF(UPPER(REPLACE(LTRIM(RTRIM(@VatCode)), N' ', N'')), N'');
    SET @Address     = NULLIF(LTRIM(RTRIM(@Address)), N'');
    SET @Phone       = NULLIF(LTRIM(RTRIM(@Phone)), N'');
    SET @Email       = LOWER(NULLIF(LTRIM(RTRIM(@Email)), N''));

    IF @Name IS NULL OR @CompanyCode IS NULL
        THROW 51004, N'Užpildykite privalomus laukus: įmonės pavadinimas ir įmonės kodas.', 1;
    IF @CompanyCode LIKE N'%[^0-9A-Za-z-]%'
        THROW 51004, N'Įmonės kodas gali turėti tik skaitmenis, raides ir brūkšnelį.', 1;
    IF @VatCode IS NOT NULL AND @VatCode LIKE N'%[^0-9A-Z]%'
        THROW 51004, N'PVM kodas gali turėti tik raides ir skaitmenis.', 1;
    IF @Email IS NOT NULL AND (@Email NOT LIKE N'_%@_%._%' OR @Email LIKE N'% %')
        THROW 51004, N'Neteisingas el. pašto adresas.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS (SELECT 1 FROM org.Company WITH (UPDLOCK, HOLDLOCK) WHERE CompanyCode = @CompanyCode)
            THROW 51006, N'Įmonė su tokiu kodu jau yra.', 1;

        INSERT INTO org.Company (Name, CompanyCode, VatCode, Address, Phone, Email, CreatedByUserId)
        VALUES (@Name, @CompanyCode, @VatCode, @Address, @Phone, @Email, @ActorUserId);
        DECLARE @CompanyId int = SCOPE_IDENTITY();

        DECLARE @Det nvarchar(max) = (SELECT @Name AS name, @CompanyCode AS companyCode FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        EXEC audit.usp_Write @ActorUserId, 'COMPANY_CREATED', 'Company', @CompanyId, @Det;

        COMMIT TRANSACTION;
        SELECT @CompanyId AS CompanyId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
