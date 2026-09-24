/*
  EJB MANAGER - Actualizacion SQL Server para nube/servidor
  Version de aplicacion: 0.3.36
  Fecha: 2026-09-23

  Antes de ejecutar:
  1. Crear una copia de seguridad completa de la base de datos destino.
  2. Seleccionar manualmente la base de datos de EJB MANAGER en SSMS.
  3. Ejecutar primero en un ambiente de pruebas.

  Este script no publica el frontend ni el backend. Los cambios visuales se
  despliegan compilando y publicando la aplicacion, no mediante SQL.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ReleaseVersion NVARCHAR(20) = N'0.3.36';

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.tickets', N'U') IS NULL
        THROW 51000, 'No existe dbo.tickets. Verifique que selecciono la base de datos correcta.', 1;

    /* Registro idempotente de despliegues de base de datos. */
    IF OBJECT_ID(N'dbo.ejb_schema_version', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ejb_schema_version
        (
            version       NVARCHAR(20)  NOT NULL,
            descripcion   NVARCHAR(300) NOT NULL,
            aplicado_en   DATETIME2(3)  NOT NULL
                CONSTRAINT DF_ejb_schema_version_aplicado_en DEFAULT SYSUTCDATETIME(),
            aplicado_por  NVARCHAR(128) NOT NULL
                CONSTRAINT DF_ejb_schema_version_aplicado_por DEFAULT SUSER_SNAME(),
            CONSTRAINT PK_ejb_schema_version PRIMARY KEY (version)
        );
    END;

    /*
      Area de destino de Ticketera.
      Se crea nullable, se normalizan los datos y finalmente se exige NOT NULL
      para que el despliegue sea seguro incluso cuando dbo.tickets tiene filas.
    */
    IF COL_LENGTH(N'dbo.tickets', N'area_destino') IS NULL
    BEGIN
        ALTER TABLE dbo.tickets
            ADD area_destino NVARCHAR(40) NULL;
    END;

    /* SQL dinamico: permite crear y usar la columna dentro de la misma ejecucion. */
    EXEC sys.sp_executesql N'
        UPDATE dbo.tickets
           SET area_destino = N''Consultoría''
         WHERE area_destino IS NULL
            OR LTRIM(RTRIM(area_destino)) = N'''';

        UPDATE dbo.tickets
           SET area_destino = CASE
                WHEN LTRIM(RTRIM(area_destino)) COLLATE Latin1_General_100_CI_AI = N''ventas''
                    THEN N''Ventas''
                WHEN LTRIM(RTRIM(area_destino)) COLLATE Latin1_General_100_CI_AI = N''instalacion''
                    THEN N''Instalación''
                WHEN LTRIM(RTRIM(area_destino)) COLLATE Latin1_General_100_CI_AI = N''consultoria''
                    THEN N''Consultoría''
                ELSE area_destino
           END;

        IF EXISTS
        (
            SELECT 1
              FROM dbo.tickets
             WHERE area_destino NOT IN (N''Ventas'', N''Instalación'', N''Consultoría'')
        )
            THROW 51001, ''Existen tickets con un area_destino no admitida. Corrija esos registros antes de continuar.'', 1;

        ALTER TABLE dbo.tickets
            ALTER COLUMN area_destino NVARCHAR(40) NOT NULL;
    ';

    IF NOT EXISTS
    (
        SELECT 1
          FROM sys.default_constraints dc
          JOIN sys.columns c
            ON c.object_id = dc.parent_object_id
           AND c.column_id = dc.parent_column_id
         WHERE dc.parent_object_id = OBJECT_ID(N'dbo.tickets')
           AND c.name = N'area_destino'
    )
    BEGIN
        ALTER TABLE dbo.tickets
            ADD CONSTRAINT DF_tickets_area_destino
            DEFAULT N'Consultoría' FOR area_destino;
    END;

    IF OBJECT_ID(N'dbo.CK_tickets_area_destino', N'C') IS NULL
    BEGIN
        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.tickets WITH CHECK
                ADD CONSTRAINT CK_tickets_area_destino
                CHECK (area_destino IN (N''Ventas'', N''Instalación'', N''Consultoría''));
        ';

        ALTER TABLE dbo.tickets
            CHECK CONSTRAINT CK_tickets_area_destino;
    END;

    /* Optimiza listados, resumen y stream filtrados por el area del responsable. */
    IF NOT EXISTS
    (
        SELECT 1
          FROM sys.indexes
         WHERE object_id = OBJECT_ID(N'dbo.tickets')
           AND name = N'IX_tickets_area_destino_estado_registrado_at'
    )
    BEGIN
        EXEC sys.sp_executesql N'
            CREATE INDEX IX_tickets_area_destino_estado_registrado_at
                ON dbo.tickets(area_destino, registrado_at DESC)
                INCLUDE (estado);
        ';
    END;

    IF NOT EXISTS
    (
        SELECT 1
          FROM dbo.ejb_schema_version
         WHERE version = @ReleaseVersion
    )
    BEGIN
        INSERT INTO dbo.ejb_schema_version(version, descripcion)
        VALUES
        (
            @ReleaseVersion,
            N'Area de destino y alcance por area en Ticketera; actualizaciones funcionales y visuales de la aplicacion.'
        );
    END;

    COMMIT TRANSACTION;

    SELECT
        DB_NAME() AS base_datos,
        @ReleaseVersion AS version_aplicada,
        COL_LENGTH(N'dbo.tickets', N'area_destino') AS columna_area_destino_bytes,
        (SELECT COUNT_BIG(*) FROM dbo.tickets) AS tickets_verificados,
        SYSUTCDATETIME() AS verificado_en_utc;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
