/*
  EJB MANAGER - Actualizacion SQL Server para nube/servidor
  Version de aplicacion: 0.3.38
  Fecha: 2026-09-24

  Causa raiz confirmada: dbo.iniciativas.icono, dbo.eventos.icono y
  dbo.mensaje_reacciones.emoji estaban declaradas como VARCHAR (de un byte,
  collation Modern_Spanish_CI_AS), que no puede representar la mayoria de
  emojis modernos (fuera del plano basico de Unicode, necesitan par
  subrogado / 4 bytes UTF-8). SQL Server sustituye en silencio cada caracter
  no representable por "?" al guardar. Se confirmo leyendo los bytes crudos
  ya guardados: son literalmente 0x3F ("?"), no una codificacion incorrecta
  reversible.

  Este script SOLO cambia el tipo de columna a NVARCHAR (Unicode, 2 bytes
  por caracter, soporta pares subrogados) para que los EMOJIS NUEVOS se
  guarden bien. NO puede recuperar los emojis ya corrompidos en filas
  existentes: una vez guardado como "?" no queda ningun rastro del caracter
  original en la base de datos. Esas filas van a seguir mostrando "?" hasta
  que alguien vuelva a elegir el icono/reaccion manualmente; no se
  autocorrigen solas.

  Antes de ejecutar:
  1. Crear una copia de seguridad completa de la base de datos destino.
  2. Seleccionar manualmente la base de datos de EJB MANAGER en SSMS.
  3. Ejecutar primero en un ambiente de pruebas.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ReleaseVersion NVARCHAR(20) = N'0.3.38';

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.iniciativas', N'U') IS NULL
        THROW 51000, 'No existe dbo.iniciativas. Verifique que selecciono la base de datos correcta.', 1;

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

    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME = N'iniciativas' AND COLUMN_NAME = N'icono' AND DATA_TYPE = N'varchar')
    BEGIN
        ALTER TABLE dbo.iniciativas ALTER COLUMN icono NVARCHAR(12) NULL;
    END;

    IF OBJECT_ID(N'dbo.eventos', N'U') IS NOT NULL
       AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = N'eventos' AND COLUMN_NAME = N'icono' AND DATA_TYPE = N'varchar')
    BEGIN
        -- La columna tiene un default constraint (nombre autogenerado); hay que
        -- soltarlo antes de poder cambiar el tipo, y volverlo a crear despues
        -- con un emoji valido en vez del que estaba corrupto.
        DECLARE @DefaultName SYSNAME;
        DECLARE @DropSql NVARCHAR(MAX);
        SELECT @DefaultName = dc.name
          FROM sys.default_constraints dc
          JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
         WHERE dc.parent_object_id = OBJECT_ID(N'dbo.eventos') AND c.name = N'icono';

        IF @DefaultName IS NOT NULL
        BEGIN
            SET @DropSql = N'ALTER TABLE dbo.eventos DROP CONSTRAINT ' + QUOTENAME(@DefaultName) + N';';
            EXEC sys.sp_executesql @DropSql;
        END;

        ALTER TABLE dbo.eventos ALTER COLUMN icono NVARCHAR(12) NOT NULL;

        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.eventos
                ADD CONSTRAINT DF_eventos_icono DEFAULT N''📅'' FOR icono;
        ';
    END;

    IF OBJECT_ID(N'dbo.mensaje_reacciones', N'U') IS NOT NULL
       AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_NAME = N'mensaje_reacciones' AND COLUMN_NAME = N'emoji' AND DATA_TYPE = N'varchar')
    BEGIN
        -- La columna es parte de una restriccion UNIQUE (mensajeId, usuarioId,
        -- emoji); SQL Server no deja cambiar el tipo de una columna indexada sin
        -- soltar antes el indice/restriccion que la usa.
        DECLARE @UniqueName SYSNAME;
        DECLARE @DropUniqueSql NVARCHAR(MAX);
        SELECT TOP 1 @UniqueName = i.name
          FROM sys.indexes i
          JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
         WHERE i.object_id = OBJECT_ID(N'dbo.mensaje_reacciones')
           AND i.is_unique = 1
           AND c.name = N'emoji';

        IF @UniqueName IS NOT NULL
        BEGIN
            IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = @UniqueName)
                SET @DropUniqueSql = N'ALTER TABLE dbo.mensaje_reacciones DROP CONSTRAINT ' + QUOTENAME(@UniqueName) + N';';
            ELSE
                SET @DropUniqueSql = N'DROP INDEX ' + QUOTENAME(@UniqueName) + N' ON dbo.mensaje_reacciones;';
            EXEC sys.sp_executesql @DropUniqueSql;
        END;

        ALTER TABLE dbo.mensaje_reacciones ALTER COLUMN emoji NVARCHAR(8) NOT NULL;

        IF @UniqueName IS NOT NULL
        BEGIN
            EXEC sys.sp_executesql N'
                ALTER TABLE dbo.mensaje_reacciones
                    ADD CONSTRAINT mensaje_reacciones_mensaje_id_usuario_id_emoji_key
                    UNIQUE (mensaje_id, usuario_id, emoji);
            ';
        END;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ejb_schema_version WHERE version = @ReleaseVersion)
    BEGIN
        INSERT INTO dbo.ejb_schema_version(version, descripcion)
        VALUES (@ReleaseVersion, N'iniciativas.icono, eventos.icono y mensaje_reacciones.emoji pasan de VARCHAR a NVARCHAR para poder guardar emojis correctamente. Los valores ya corrompidos (guardados como "?") no se recuperan automaticamente.');
    END;

    COMMIT TRANSACTION;

    SELECT
        DB_NAME() AS base_datos,
        @ReleaseVersion AS version_aplicada,
        (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='iniciativas' AND COLUMN_NAME='icono') AS iniciativas_icono_tipo,
        (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='eventos' AND COLUMN_NAME='icono') AS eventos_icono_tipo,
        (SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='mensaje_reacciones' AND COLUMN_NAME='emoji') AS reacciones_emoji_tipo,
        SYSUTCDATETIME() AS verificado_en_utc;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
