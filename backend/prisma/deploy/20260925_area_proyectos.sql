/*
  EJB MANAGER - Actualizacion SQL Server para nube/servidor
  Version de aplicacion: 0.3.42
  Fecha: 2026-09-25

  Agrega el area "Proyectos" a dbo.areas (color #8B5CF6). Es un area propia de
  la organizacion; no tiene relacion con el modulo/pagina de Proyectos.

  - Es idempotente: si el area ya existe (mismo nombre) no la duplica ni la
    modifica, asi que se puede ejecutar mas de una vez sin riesgo.
  - No cambia ningun otro dato ni la estructura de las tablas.
  - El texto de este script es ASCII puro: no depende de la codificacion del
    archivo ni del cliente (SSMS/sqlcmd) con el que se ejecute.
  - Los cambios en la aplicacion no requieren publicar nada: el catalogo de
    areas se lee de esta tabla, asi que el area aparece sola en Equipo,
    registro, filtros y demas selectores.

  Antes de ejecutar:
  1. Crear una copia de seguridad completa de la base de datos destino.
  2. Seleccionar manualmente la base de datos de EJB MANAGER en SSMS.
  3. Ejecutar primero en un ambiente de pruebas.

  Para deshacerlo (solo mientras nadie tenga asignada el area):
    DELETE FROM dbo.areas WHERE nombre = 'Proyectos';
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ReleaseVersion NVARCHAR(20) = N'0.3.42-area';

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.areas', N'U') IS NULL
        THROW 51000, 'No existe dbo.areas. Verifique que selecciono la base de datos correcta.', 1;

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

    /* La comparacion usa la collation de la columna (no distingue mayusculas/minusculas). */
    IF NOT EXISTS (SELECT 1 FROM dbo.areas WHERE nombre = 'Proyectos')
    BEGIN
        INSERT INTO dbo.areas (id, nombre, color_hex)
        VALUES (NEWID(), 'Proyectos', '#8B5CF6');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ejb_schema_version WHERE version = @ReleaseVersion)
    BEGIN
        INSERT INTO dbo.ejb_schema_version (version, descripcion)
        VALUES (@ReleaseVersion, N'Agrega el area Proyectos (color #8B5CF6) a dbo.areas.');
    END;

    COMMIT TRANSACTION;

    SELECT
        DB_NAME() AS base_datos,
        @ReleaseVersion AS version_aplicada,
        (SELECT COUNT(*) FROM dbo.areas) AS total_areas,
        (SELECT COUNT(*) FROM dbo.areas WHERE nombre = 'Proyectos') AS area_proyectos_presente,
        (SELECT color_hex FROM dbo.areas WHERE nombre = 'Proyectos') AS color_hex,
        SYSUTCDATETIME() AS verificado_en_utc;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;
