-- El avance real gobierna el estado operativo del proyecto.
ALTER TYPE "Estado" ADD VALUE IF NOT EXISTS 'Finalizado';
