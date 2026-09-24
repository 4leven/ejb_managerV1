/*
  EJB MANAGER - Actualizacion SQL Server para nube/servidor
  Version de aplicacion: 0.3.37
  Fecha: 2026-09-24

  Agrega a dbo.iniciativas:
    - software      : texto libre con el software/sistema asociado al proyecto.
    - cliente_id    : referencia opcional a dbo.clientes (selector de cliente).
                       El campo de texto libre "cliente" NO se toca ni se borra:
                       sigue mostrandose como respaldo en las iniciativas que aun
                       no tengan cliente_id asignado. No se intenta emparejar
                       automaticamente el texto existente contra dbo.clientes
                       (el texto libre puede tener variaciones/erratas y un
                       emparejamiento automatico podria vincular una iniciativa
                       al cliente equivocado).

  Antes de ejecutar:
  1. Crear una copia de seguridad completa de la base de datos destino.
  2. Seleccionar manualmente la base de datos de EJB MANAGER en SSMS.
  3. Ejecutar primero en un ambiente de pruebas.

  Este script no publica el frontend ni el backend. Los cambios visuales se
  despliegan compilando y publicando la aplicacion, no mediante SQL.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ReleaseVersion NVARCHAR(20) = N'0.3.37';

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.iniciativas', N'U') IS NULL
        THROW 51000, 'No existe dbo.iniciativas. Verifique que selecciono la base de datos correcta.', 1;

    IF OBJECT_ID(N'dbo.clientes', N'U') IS NULL
        THROW 51000, 'No existe dbo.clientes. Verifique que selecciono la base de datos correcta.', 1;

    /* Registro idempotente de despliegues de base de datos (creado por una version previa). */
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

    IF COL_LENGTH(N'dbo.iniciativas', N'software') IS NULL
    BEGIN
        ALTER TABLE dbo.iniciativas
            ADD software NVARCHAR(120) NULL;
    END;

    IF COL_LENGTH(N'dbo.iniciativas', N'cliente_id') IS NULL
    BEGIN
        ALTER TABLE dbo.iniciativas
            ADD cliente_id UNIQUEIDENTIFIER NULL;
    END;

    IF NOT EXISTS
    (
        SELECT 1
          FROM sys.foreign_keys
         WHERE name = N'FK_iniciativas_cliente_id'
    )
    BEGIN
        ALTER TABLE dbo.iniciativas WITH CHECK
            ADD CONSTRAINT FK_iniciativas_cliente_id
            FOREIGN KEY (cliente_id) REFERENCES dbo.clientes(id);

        ALTER TABLE dbo.iniciativas
            CHECK CONSTRAINT FK_iniciativas_cliente_id;
    END;

    IF NOT EXISTS
    (
        SELECT 1
          FROM sys.indexes
         WHERE object_id = OBJECT_ID(N'dbo.iniciativas')
           AND name = N'idx_iniciativas_cliente'
    )
    BEGIN
        EXEC sys.sp_executesql N'
            CREATE INDEX idx_iniciativas_cliente
                ON dbo.iniciativas(cliente_id);
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
            N'Campo software y referencia a cliente (selector) en iniciativas; correcciones funcionales y visuales del modulo de Iniciativas.'
        );
    END;

    COMMIT TRANSACTION;

    SELECT
        DB_NAME() AS base_datos,
        @ReleaseVersion AS version_aplicada,
        COL_LENGTH(N'dbo.iniciativas', N'software') AS columna_software_bytes,
        COL_LENGTH(N'dbo.iniciativas', N'cliente_id') AS columna_cliente_id_bytes,
        (SELECT COUNT_BIG(*) FROM dbo.iniciativas) AS iniciativas_verificadas,
        SYSUTCDATETIME() AS verificado_en_utc;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
