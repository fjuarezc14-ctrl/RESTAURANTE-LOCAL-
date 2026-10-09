-- El correo de los usuarios no se usaba para nada: los equipos se activan con usuario + contraseña del administrador

-- DropIndex
DROP INDEX "Usuario_correo_key";

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "correo";

