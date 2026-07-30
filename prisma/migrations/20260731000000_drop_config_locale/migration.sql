-- El idioma deja de ser un ajuste global de MarketConfig y pasa a ser una
-- preferencia por usuario en cookie (NEXT_LOCALE, ver src/i18n/request.ts).
ALTER TABLE "MarketConfig" DROP COLUMN "locale";
