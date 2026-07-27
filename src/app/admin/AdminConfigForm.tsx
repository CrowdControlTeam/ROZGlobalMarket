"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateMarketConfig, type getMarketConfig } from "@/lib/admin-config";
import { buttonClass, inputClass, labelClass, selectClass } from "@/lib/ui";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { getErrorMessage } from "@/lib/errors";

type Config = Awaited<ReturnType<typeof getMarketConfig>>;

export function AdminConfigForm({ config }: { config: Config }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const t = useTranslations("admin");
  const tButton = useTranslations("market.button");
  const tStatus = useTranslations("market.status");

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSaved(false);
        try {
          await updateMarketConfig(formData);
          setSaved(true);
        } catch (err) {
          setError(getErrorMessage(err));
        }
      }}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">{t("general.legend")}</legend>
        <div>
          <label className={labelClass}>{t("general.siteNameLabel")}</label>
          <input
            type="text"
            name="siteName"
            defaultValue={config.siteName}
            placeholder={config.siteNamePlaceholder}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ro-text-muted">
            {t("general.siteNameHint", { placeholder: config.siteNamePlaceholder })}
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">{t("access.legend")}</legend>
        <p className="text-xs text-ro-text-muted">{t("access.hint")}</p>
        {config.guildRolesResult.status === "ok" ? (
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border-2 border-ro-panel-border bg-ro-panel-alt p-2">
            {config.guildRolesResult.roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="adminRoleIds"
                  value={role.id}
                  defaultChecked={config.adminRoleIds.includes(role.id)}
                  className="accent-ro-gold"
                />
                {role.name}
              </label>
            ))}
          </div>
        ) : (
          <div>
            {config.guildRolesResult.status === "error" && (
              <p className="mb-1 text-xs text-red-700">
                {t("access.rolesFetchError", { message: config.guildRolesResult.message })}
              </p>
            )}
            <textarea
              name="adminRoleIdsText"
              rows={3}
              defaultValue={config.adminRoleIds.join("\n")}
              placeholder={t("access.roleIdsPlaceholder")}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ro-text-muted">{t("access.roleIdsHint")}</p>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">{t("language.legend")}</legend>
        <div>
          <label className={labelClass}>{t("language.label")}</label>
          <select name="locale" defaultValue={config.locale} className={selectClass}>
            {config.localeOptions.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">{t("webhook.legend")}</legend>
        <ToggleSwitch
          name="webhookEnabled"
          defaultChecked={config.webhookEnabled}
          label={t("webhook.toggleLabel")}
        />
        <div>
          <label className={labelClass}>{t("webhook.urlLabel")}</label>
          <input
            type="url"
            name="webhookUrl"
            placeholder={config.webhookUrlMasked ?? t("webhook.urlPlaceholder")}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-ro-text-muted">
            {config.webhookUrlMasked ? t("webhook.urlHintBlank") : t("webhook.urlHintUnset")}
          </p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">{t("dm.legend")}</legend>
        <ToggleSwitch
          name="dmNotificationsEnabled"
          defaultChecked={config.dmNotificationsEnabled}
          label={t("dm.toggleLabel")}
        />
        <p className="text-xs text-ro-text-muted">
          {t("dm.botLabel")}{" "}
          {config.hasDiscordBotToken ? (
            <span className="text-green-700">{t("dm.botConfigured")}</span>
          ) : (
            <span className="text-red-700">{t("dm.botNotConfigured")}</span>
          )}
          . {t("dm.requirement")}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">{t("recognition.legend")}</legend>
        <ToggleSwitch
          name="imageRecognitionEnabled"
          defaultChecked={config.imageRecognitionEnabled}
          label={t("recognition.toggleLabel")}
        />
        <p className="text-xs text-ro-text-muted">
          {t("recognition.apiKeyLabel")}{" "}
          {config.hasGeminiApiKey ? (
            <span className="text-green-700">{t("recognition.apiKeyConfigured")}</span>
          ) : (
            <span className="text-red-700">{t("recognition.apiKeyNotConfigured")}</span>
          )}
          . {t("recognition.requirement")}
        </p>
        <div>
          <label className={labelClass}>{t("recognition.modelLabel")}</label>
          <select name="geminiModel" defaultValue={config.geminiModel} className={selectClass}>
            {config.geminiModelOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-ro-text-muted">
            {config.geminiModelOptions.map((m) => (
              <li key={m.value}>
                <span className="font-semibold">{m.label}:</span> {m.description}
              </li>
            ))}
          </ul>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">{t("options.legend")}</legend>
        <ToggleSwitch
          name="optionsEnabled"
          defaultChecked={config.optionsEnabled}
          label={t("options.toggleLabel")}
        />
        <p className="text-xs text-ro-text-muted">
          {t("options.catalogLabel")}{" "}
          {config.optionsCatalogCount > 0 ? (
            <span className="text-green-700">
              {t("options.catalogLoaded", { count: config.optionsCatalogCount })}
            </span>
          ) : (
            <span className="text-red-700">{t("options.catalogEmpty")}</span>
          )}
          . {t("options.requirement")}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ro-text">{t("market.legend")}</legend>
        <ToggleSwitch
          name="maintenanceModeEnabled"
          defaultChecked={config.maintenanceModeEnabled}
          label={t("market.maintenanceToggleLabel")}
        />
        <div>
          <label className={labelClass}>{t("market.maxRefineLabel")}</label>
          <input
            type="number"
            name="maxRefineLevel"
            min={0}
            defaultValue={config.maxRefineLevel}
            className={inputClass}
          />
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700">{tStatus("saved")}</p>}

      <button type="submit" className={buttonClass("primary")}>
        {tButton("save")}
      </button>
    </form>
  );
}
