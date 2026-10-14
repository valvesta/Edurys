/* ==========================================================================
   V004 — Užsakymai, jų eilutės, statusai ir statusų istorija.

   Svarbiausi principai:
   1. Užsakymai NIEKADA netrinami. Atšaukimas — tai statusas CANCELLED.
   2. Užsakymas ir eilutės — „temporal" lentelės: kiekviena ankstesnė
      versija automatiškai išsaugoma (sales.OrderHistory, sales.OrderLineHistory).
   3. Užsakymas visada susietas su konkrečia katalogo versija — kainos
      išlieka tokios, kokios buvo užsakymo metu, net kai išeina naujas katalogas.
   4. Eilutėje saugoma pilna konfigūracijos kopija (ConfigurationJson) ir
      kainos išskaidymas (PriceBreakdownJson). Eilutės suma be PVM
      APSKAIČIUOJAMA DB iš išskaidymo eilučių — ne priimama iš programos.
   5. PVM skaičiuojamas kiekvienai eilutei atskirai ir apvalinamas iki centų,
      užsakymo sumos — eilučių sumos (taip pat, kaip dabartinėje sąskaitoje).
   6. Statusų perėjimai aprašyti lentelėje sales.OrderStatusTransition —
      procedūra leidžia tik ten išvardintus perėjimus ir tik leistiniems
      vaidmenims. Kiekvienas perėjimas įrašomas į sales.OrderStatusHistory,
      kurios keisti ar trinti neįmanoma.
   ========================================================================== */

CREATE TABLE sales.OrderStatus (
    StatusCode   varchar(30)    NOT NULL CONSTRAINT PK_OrderStatus PRIMARY KEY,
    Name         nvarchar(100)  NOT NULL,
    SortOrder    int            NOT NULL,
    IsEditable   bit            NOT NULL,   -- ar galima keisti eilutes
    IsFinal      bit            NOT NULL
);
GO

INSERT INTO sales.OrderStatus (StatusCode, Name, SortOrder, IsEditable, IsFinal) VALUES
    ('DRAFT',                N'Juodraštis',             10, 1, 0),
    ('SUBMITTED',            N'Pateiktas',              20, 0, 0),
    ('CONFIRMED',            N'Patvirtintas',           30, 0, 0),
    ('SENT_TO_MANUFACTURER', N'Išsiųstas gamintojui',   40, 0, 0),
    ('IN_PRODUCTION',        N'Gaminamas',              50, 0, 0),
    ('DELIVERED',            N'Pristatytas',            60, 0, 1),
    ('CANCELLED',            N'Atšauktas',              90, 0, 1);
GO

/* Leistini perėjimai.
   AllowOwner      — užsakymo autorius (USER arba COMPANY_REP);
   AllowCompanyRep — tos pačios įmonės atstovas;
   AllowAdmin      — ADMIN ir GLOBAL_ADMIN. */
CREATE TABLE sales.OrderStatusTransition (
    FromStatus       varchar(30)  NOT NULL CONSTRAINT FK_Transition_From REFERENCES sales.OrderStatus (StatusCode),
    ToStatus         varchar(30)  NOT NULL CONSTRAINT FK_Transition_To   REFERENCES sales.OrderStatus (StatusCode),
    AllowOwner       bit          NOT NULL,
    AllowCompanyRep  bit          NOT NULL,
    AllowAdmin       bit          NOT NULL,
    RequiresComment  bit          NOT NULL CONSTRAINT DF_Transition_RequiresComment DEFAULT (0),
    CONSTRAINT PK_OrderStatusTransition PRIMARY KEY (FromStatus, ToStatus),
    CONSTRAINT CK_Transition_NotSame CHECK (FromStatus <> ToStatus)
);
GO

INSERT INTO sales.OrderStatusTransition (FromStatus, ToStatus, AllowOwner, AllowCompanyRep, AllowAdmin, RequiresComment) VALUES
    ('DRAFT',                'SUBMITTED',            1, 1, 1, 0),
    ('DRAFT',                'CANCELLED',            1, 1, 1, 0),
    ('SUBMITTED',            'DRAFT',                0, 0, 1, 1),  -- grąžinta taisyti (būtina nurodyti priežastį)
    ('SUBMITTED',            'CONFIRMED',            0, 0, 1, 0),
    ('SUBMITTED',            'CANCELLED',            0, 0, 1, 1),
    ('CONFIRMED',            'SENT_TO_MANUFACTURER', 0, 0, 1, 0),
    ('CONFIRMED',            'CANCELLED',            0, 0, 1, 1),
    ('SENT_TO_MANUFACTURER', 'IN_PRODUCTION',        0, 0, 1, 0),
    ('SENT_TO_MANUFACTURER', 'CANCELLED',            0, 0, 1, 1),
    ('IN_PRODUCTION',        'DELIVERED',            0, 0, 1, 0);
GO

CREATE SEQUENCE sales.OrderNumberSeq AS int START WITH 1 INCREMENT BY 1 NO CYCLE;
GO

CREATE TABLE sales.[Order] (
    OrderId            int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_Order PRIMARY KEY,
    OrderNumber        varchar(20)    NOT NULL,
    CompanyId          int            NOT NULL CONSTRAINT FK_Order_Company REFERENCES org.Company (CompanyId),
    CreatedByUserId    int            NOT NULL CONSTRAINT FK_Order_CreatedBy REFERENCES iam.[User] (UserId),
    CatalogVersionId   int            NOT NULL CONSTRAINT FK_Order_CatalogVersion REFERENCES catalog.CatalogVersion (CatalogVersionId),
    StatusCode         varchar(30)    NOT NULL CONSTRAINT FK_Order_Status REFERENCES sales.OrderStatus (StatusCode),
    CustomerReference  nvarchar(100)  NULL,
    Notes              nvarchar(2000) NULL,
    CurrencyCode       char(3)        NOT NULL,
    VatRate            decimal(5,4)   NOT NULL,
    NetTotal           decimal(14,2)  NOT NULL CONSTRAINT DF_Order_NetTotal   DEFAULT (0),
    VatTotal           decimal(14,2)  NOT NULL CONSTRAINT DF_Order_VatTotal   DEFAULT (0),
    GrossTotal         decimal(14,2)  NOT NULL CONSTRAINT DF_Order_GrossTotal DEFAULT (0),
    CreatedAt          datetime2(3)   NOT NULL CONSTRAINT DF_Order_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt          datetime2(3)   NOT NULL CONSTRAINT DF_Order_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedByUserId    int            NOT NULL CONSTRAINT FK_Order_UpdatedBy REFERENCES iam.[User] (UserId),
    SubmittedAt        datetime2(3)   NULL,
    Revision           int            NOT NULL CONSTRAINT DF_Order_Revision DEFAULT (1),
    ValidFrom          datetime2(3)   GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    ValidTo            datetime2(3)   GENERATED ALWAYS AS ROW END   HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo),
    CONSTRAINT UQ_Order_Number UNIQUE (OrderNumber),
    CONSTRAINT CK_Order_Totals CHECK (NetTotal >= 0 AND VatTotal >= 0 AND GrossTotal = NetTotal + VatTotal)
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = sales.OrderHistory));
GO
CREATE INDEX IX_Order_Company_Status ON sales.[Order] (CompanyId, StatusCode, CreatedAt DESC);
GO
CREATE INDEX IX_Order_Status ON sales.[Order] (StatusCode, CreatedAt DESC);
GO
CREATE INDEX IX_Order_CreatedBy ON sales.[Order] (CreatedByUserId, CreatedAt DESC);
GO

CREATE TABLE sales.OrderLine (
    OrderLineId         int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderLine PRIMARY KEY,
    OrderId             int            NOT NULL CONSTRAINT FK_OrderLine_Order REFERENCES sales.[Order] (OrderId),
    LineNumber              int            NOT NULL,
    CatalogVersionId    int            NOT NULL,
    FamilyCode          varchar(60)    NOT NULL,
    ModelNo             smallint       NOT NULL,
    Description         nvarchar(500)  NOT NULL,
    Quantity            int            NOT NULL,
    LineNetTotal        decimal(14,2)  NOT NULL,
    LineVatTotal        decimal(14,2)  NOT NULL,
    LineGrossTotal      decimal(14,2)  NOT NULL,
    ConfigurationJson   nvarchar(max)  NOT NULL,
    PriceBreakdownJson  nvarchar(max)  NOT NULL,
    EngineVersion       varchar(50)    NOT NULL,
    CreatedAt           datetime2(3)   NOT NULL CONSTRAINT DF_OrderLine_CreatedAt DEFAULT (SYSUTCDATETIME()),
    ValidFrom           datetime2(3)   GENERATED ALWAYS AS ROW START HIDDEN NOT NULL,
    ValidTo             datetime2(3)   GENERATED ALWAYS AS ROW END   HIDDEN NOT NULL,
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo),
    CONSTRAINT UQ_OrderLine_No UNIQUE (OrderId, LineNumber),
    CONSTRAINT FK_OrderLine_Model FOREIGN KEY (CatalogVersionId, FamilyCode, ModelNo)
        REFERENCES catalog.Model (CatalogVersionId, FamilyCode, ModelNo),
    CONSTRAINT CK_OrderLine_Qty CHECK (Quantity BETWEEN 1 AND 1000),
    CONSTRAINT CK_OrderLine_LineNo CHECK (LineNumber > 0),
    CONSTRAINT CK_OrderLine_Totals CHECK (LineNetTotal >= 0 AND LineVatTotal >= 0 AND LineGrossTotal = LineNetTotal + LineVatTotal),
    CONSTRAINT CK_OrderLine_ConfigJson CHECK (ISJSON(ConfigurationJson) = 1),
    CONSTRAINT CK_OrderLine_BreakdownJson CHECK (ISJSON(PriceBreakdownJson) = 1)
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = sales.OrderLineHistory));
GO
CREATE INDEX IX_OrderLine_Order ON sales.OrderLine (OrderId);
GO

CREATE TABLE sales.OrderStatusHistory (
    OrderStatusHistoryId  int            IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderStatusHistory PRIMARY KEY,
    OrderId               int            NOT NULL CONSTRAINT FK_OrderStatusHistory_Order REFERENCES sales.[Order] (OrderId),
    FromStatus            varchar(30)    NULL     CONSTRAINT FK_OrderStatusHistory_From REFERENCES sales.OrderStatus (StatusCode),
    ToStatus              varchar(30)    NOT NULL CONSTRAINT FK_OrderStatusHistory_To   REFERENCES sales.OrderStatus (StatusCode),
    ChangedByUserId       int            NOT NULL CONSTRAINT FK_OrderStatusHistory_User REFERENCES iam.[User] (UserId),
    ChangedAt             datetime2(3)   NOT NULL CONSTRAINT DF_OrderStatusHistory_ChangedAt DEFAULT (SYSUTCDATETIME()),
    Comment               nvarchar(1000) NULL
);
GO
CREATE INDEX IX_OrderStatusHistory_Order ON sales.OrderStatusHistory (OrderId, ChangedAt);
GO

/* Istorijos įrašų pakeisti ar ištrinti negalima. */
CREATE TRIGGER sales.TR_OrderStatusHistory_AppendOnly ON sales.OrderStatusHistory INSTEAD OF UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    THROW 51003, N'Statusų istorijos keisti ar trinti negalima.', 1;
END;
GO

/* Užsakymų trinti negalima (atšaukimas — tik statusu). Temporal lentelėms
   INSTEAD OF trigeriai neleidžiami, todėl naudojamas AFTER DELETE. */
CREATE TRIGGER sales.TR_Order_NoDelete ON sales.[Order] AFTER DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted)
        THROW 51003, N'Užsakymų trinti negalima. Naudokite statusą „Atšauktas".', 1;
END;
GO
