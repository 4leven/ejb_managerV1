BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[eventos] DROP CONSTRAINT [eventos_icono_df];
ALTER TABLE [dbo].[eventos] ADD CONSTRAINT [eventos_icono_df] DEFAULT '📅' FOR [icono];

-- CreateIndex
ALTER TABLE [dbo].[clientes] ADD CONSTRAINT [clientes_ruc_key] UNIQUE NONCLUSTERED ([ruc]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [idx_iniciativas_cliente] ON [dbo].[iniciativas]([cliente_id]);

-- CreateIndex
ALTER TABLE [dbo].[tickets] ADD CONSTRAINT [tickets_origen_ref_key] UNIQUE NONCLUSTERED ([origen_ref]);

-- AddForeignKey
ALTER TABLE [dbo].[iniciativas] ADD CONSTRAINT [iniciativas_cliente_id_fkey] FOREIGN KEY ([cliente_id]) REFERENCES [dbo].[clientes]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

