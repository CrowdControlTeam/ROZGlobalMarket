"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X, Loader2 } from "lucide-react";
import {
  setMarketConfigField,
  type getMarketConfig,
  type ConfigFieldUpdate,
} from "@/lib/admin-config";
import { inputBaseClass, selectClass } from "@/lib/ui";
import { FloatingField, floatingControlClass } from "@/components/FloatingField";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { RoleMultiSelect } from "@/components/RoleMultiSelect";
import { ImageUploadField } from "@/components/ImageUploadField";
import { MAX_LOGO_BYTES, MAX_HOME_IMAGE_BYTES } from "@/lib/branding-constants";
import { getErrorMessage } from "@/lib/errors";

type Config = Awaited<ReturnType<typeof getMarketConfig>>;
type FieldState = "saving" | "saved";

// Config de admin con AUTOGUARDADO por campo (sin botón "Guardar"). Los cambios
// discretos (toggles, selects, imágenes, roles) guardan al instante; los campos
// de texto/número muestran ✓/X para confirmar o descartar la edición. Cada
// campo lleva su propio indicador de estado (guardando / guardado) y su error.
export function AdminConfigForm({ config }: { config: Config }) {
  const t = useTranslations("admin");
  const [state, setState] = useState<Record<string, FieldState | undefined>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(update: ConfigFieldUpdate): Promise<boolean> {
    const key = update.field;
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
    setState((s) => ({ ...s, [key]: "saving" }));
    try {
      await setMarketConfigField(update);
      setState((s) => ({ ...s, [key]: "saved" }));
      window.setTimeout(() => {
        setState((s) => (s[key] === "saved" ? { ...s, [key]: undefined } : s));
      }, 1600);
      return true;
    } catch (err) {
      setState((s) => ({ ...s, [key]: undefined }));
      setErrors((e) => ({ ...e, [key]: getErrorMessage(err) }));
      return false;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 md:gap-0">
        {/* Grupo IZQUIERDO — configuración general. */}
        <div className="flex flex-col gap-6 md:pr-8">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ro-text">{t("general.legend")}</legend>
            <EditableField
              label={t("general.siteNameLabel")}
              initial={config.siteName}
              placeholder={config.siteNamePlaceholder}
              state={state.siteName}
              error={errors.siteName}
              onSave={(v) => save({ field: "siteName", value: v })}
              hint={t("general.siteNameHint", { placeholder: config.siteNamePlaceholder })}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-sm font-semibold text-ro-text">{t("appearance.legend")}</legend>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <ImageUploadField
                  label={t("appearance.logoLabel")}
                  hint={t("appearance.logoHint")}
                  maxBytes={MAX_LOGO_BYTES}
                  defaultValue={config.logoUrl}
                  onChange={(v) => save({ field: "logoUrl", value: v })}
                />
              </div>
              <FieldStatus state={state.logoUrl} className="mt-6" />
            </div>
            <FieldError error={errors.logoUrl} />
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <ImageUploadField
                  label={t("appearance.homeImageLabel")}
                  hint={t("appearance.homeImageHint")}
                  maxBytes={MAX_HOME_IMAGE_BYTES}
                  defaultValue={config.homeImageUrl}
                  onChange={(v) => save({ field: "homeImageUrl", value: v })}
                />
              </div>
              <FieldStatus state={state.homeImageUrl} className="mt-6" />
            </div>
            <FieldError error={errors.homeImageUrl} />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ro-text">{t("access.legend")}</legend>
            <p className="text-xs text-ro-text-muted">{t("access.hint")}</p>
            {config.guildRolesResult.status === "ok" ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <RoleMultiSelect
                    roles={config.guildRolesResult.roles}
                    defaultSelected={config.adminRoleIds}
                    onChange={(ids) => save({ field: "adminRoleIds", value: ids })}
                  />
                </div>
                <FieldStatus state={state.adminRoleIds} />
              </div>
            ) : (
              <div>
                {config.guildRolesResult.status === "error" && (
                  <p className="mb-1 text-xs text-red-700">
                    {t("access.rolesFetchError", { message: config.guildRolesResult.message })}
                  </p>
                )}
                <EditableTextarea
                  initial={config.adminRoleIds.join("\n")}
                  placeholder={t("access.roleIdsPlaceholder")}
                  state={state.adminRoleIds}
                  error={errors.adminRoleIds}
                  onSave={(v) => save({ field: "adminRoleIds", value: v.split(/[\n,]/) })}
                />
                <p className="mt-1 text-xs text-ro-text-muted">{t("access.roleIdsHint")}</p>
              </div>
            )}
          </fieldset>

          <RoleSelectField
            legend={t("appAccess.legend")}
            hint={t("appAccess.hint")}
            noneLabel={t("appAccess.none")}
            placeholder={t("appAccess.roleIdPlaceholder")}
            value={config.accessRoleId}
            roles={config.guildRolesResult.status === "ok" ? config.guildRolesResult.roles : null}
            state={state.accessRoleId}
            error={errors.accessRoleId}
            onSave={(v) => save({ field: "accessRoleId", value: v })}
          />

          <RoleSelectField
            legend={t("bisEditor.legend")}
            hint={t("bisEditor.hint")}
            noneLabel={t("bisEditor.none")}
            placeholder={t("bisEditor.roleIdPlaceholder")}
            value={config.bisEditorRoleId}
            roles={config.guildRolesResult.status === "ok" ? config.guildRolesResult.roles : null}
            state={state.bisEditorRoleId}
            error={errors.bisEditorRoleId}
            onSave={(v) => save({ field: "bisEditorRoleId", value: v })}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ro-text">{t("market.maxRefineLabel")}</legend>
            <EditableField
              label={t("market.maxRefineLabel")}
              initial={String(config.maxRefineLevel)}
              type="number"
              min={0}
              state={state.maxRefineLevel}
              error={errors.maxRefineLevel}
              onSave={(v) => save({ field: "maxRefineLevel", value: Number(v) })}
            />
          </fieldset>
        </div>

        {/* Grupo DERECHO — funcionalidades. */}
        <div className="flex flex-col gap-6 md:border-l md:border-ro-panel-border md:pl-8">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ro-text">{t("webhook.legend")}</legend>
            <ToggleRow
              label={t("webhook.toggleLabel")}
              checked={config.webhookEnabled}
              state={state.webhookEnabled}
              onChange={(v) => save({ field: "webhookEnabled", value: v })}
            />
            <div>
              <EditableField
                label={t("webhook.urlLabel")}
                initial=""
                type="url"
                placeholder={config.webhookUrlMasked ?? t("webhook.urlPlaceholder")}
                state={state.webhookUrl}
                error={errors.webhookUrl}
                resetOnSave
                onSave={(v) => save({ field: "webhookUrl", value: v })}
              />
              <p className="mt-1 text-xs text-ro-text-muted">
                {config.webhookUrlMasked ? t("webhook.urlHintBlank") : t("webhook.urlHintUnset")}
              </p>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ro-text">{t("dm.legend")}</legend>
            <ToggleRow
              label={t("dm.toggleLabel")}
              checked={config.dmNotificationsEnabled}
              state={state.dmNotificationsEnabled}
              onChange={(v) => save({ field: "dmNotificationsEnabled", value: v })}
            />
            <p className="text-xs text-ro-text-muted">
              {t("dm.botLabel")}{" "}
              {config.botStatus === "ok" ? (
                <span className="text-green-700">{t("dm.botInServer")}</span>
              ) : config.botStatus === "not_in_guild" ? (
                <span className="text-red-700">{t("dm.botNotInServer")}</span>
              ) : config.botStatus === "no_token" ? (
                <span className="text-red-700">{t("dm.botNotConfigured")}</span>
              ) : (
                <span className="text-red-700">{t("dm.botCheckError")}</span>
              )}
              . {t("dm.requirement")}
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ro-text">{t("recognition.legend")}</legend>
            <ToggleRow
              label={t("recognition.toggleLabel")}
              checked={config.imageRecognitionEnabled}
              state={state.imageRecognitionEnabled}
              onChange={(v) => save({ field: "imageRecognitionEnabled", value: v })}
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
              <FloatingField label={t("recognition.modelLabel")}>
                <div className="flex items-center gap-2">
                  <select
                    defaultValue={config.geminiModel}
                    onChange={(e) => save({ field: "geminiModel", value: e.target.value })}
                    className={`min-w-0 flex-1 ${floatingControlClass}`}
                  >
                    {config.geminiModelOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <FieldStatus state={state.geminiModel} />
                </div>
              </FloatingField>
              <ul className="mt-1 flex flex-col gap-0.5 text-xs text-ro-text-muted">
                {config.geminiModelOptions.map((m) => (
                  <li key={m.value}>
                    <span className="font-semibold">{m.label}:</span> {m.description}
                  </li>
                ))}
              </ul>
              <FieldError error={errors.geminiModel} />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-ro-text">{t("options.legend")}</legend>
            <ToggleRow
              label={t("options.toggleLabel")}
              checked={config.optionsEnabled}
              state={state.optionsEnabled}
              onChange={(v) => save({ field: "optionsEnabled", value: v })}
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
            <ToggleRow
              label={t("market.maintenanceToggleLabel")}
              checked={config.maintenanceModeEnabled}
              state={state.maintenanceModeEnabled}
              onChange={(v) => save({ field: "maintenanceModeEnabled", value: v })}
            />
          </fieldset>
        </div>
      </div>
    </div>
  );
}

// Indicador de estado por campo: spinner mientras guarda, check verde al guardar.
function FieldStatus({ state, className }: { state?: FieldState; className?: string }) {
  if (state === "saving")
    return <Loader2 size={15} className={`shrink-0 animate-spin text-ro-text-muted ${className ?? ""}`} aria-hidden />;
  if (state === "saved")
    return <Check size={15} className={`shrink-0 text-green-600 ${className ?? ""}`} aria-hidden />;
  return null;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-xs text-red-600">{error}</p>;
}

// Toggle + su indicador de estado en una fila.
function ToggleRow({
  label,
  checked,
  state,
  onChange,
}: {
  label: string;
  checked: boolean;
  state?: FieldState;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <ToggleSwitch defaultChecked={checked} label={label} onChange={onChange} />
      </div>
      <FieldStatus state={state} />
    </div>
  );
}

// Campo de texto/número con confirmación ✓/X: mientras el valor difiere del
// guardado, aparecen los botones para guardar o descartar; si no, el indicador
// de estado. Enter guarda, Escape descarta. `resetOnSave` (webhook secreto) deja
// el campo vacío tras guardar en vez de conservar lo escrito.
function EditableField({
  label,
  initial,
  type = "text",
  min,
  placeholder,
  hint,
  state,
  error,
  resetOnSave,
  onSave,
}: {
  label: string;
  initial: string;
  type?: "text" | "number" | "url";
  min?: number;
  placeholder?: string;
  hint?: string;
  state?: FieldState;
  error?: string;
  resetOnSave?: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const tCommon = useTranslations("common");
  const tButton = useTranslations("market.button");
  const [savedValue, setSavedValue] = useState(initial);
  const [value, setValue] = useState(initial);
  const dirty = value !== savedValue;

  async function commit() {
    if (!dirty) return;
    const ok = await onSave(value);
    if (ok) {
      const next = resetOnSave ? "" : value;
      setSavedValue(next);
      setValue(next);
    }
  }
  function cancel() {
    setValue(savedValue);
  }

  return (
    <div>
      <FloatingField label={label}>
        <div className="flex items-center gap-1">
          <input
            type={type}
            min={min}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") cancel();
            }}
            className={`min-w-0 flex-1 ${floatingControlClass}`}
          />
          {dirty ? (
            <>
              <button type="button" onClick={commit} title={tButton("save")} aria-label={tButton("save")} className="text-ro-accent">
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={cancel}
                title={tCommon("cancel")}
                aria-label={tCommon("cancel")}
                className="text-ro-text-muted transition-colors hover:text-ro-text"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <FieldStatus state={state} />
          )}
        </div>
      </FloatingField>
      {hint && <p className="mt-1 text-xs text-ro-text-muted">{hint}</p>}
      <FieldError error={error} />
    </div>
  );
}

// Textarea con ✓/X (caso sin bot: IDs de rol admin, uno por línea).
function EditableTextarea({
  initial,
  placeholder,
  state,
  error,
  onSave,
}: {
  initial: string;
  placeholder?: string;
  state?: FieldState;
  error?: string;
  onSave: (value: string) => Promise<boolean>;
}) {
  const tCommon = useTranslations("common");
  const tButton = useTranslations("market.button");
  const [savedValue, setSavedValue] = useState(initial);
  const [value, setValue] = useState(initial);
  const dirty = value !== savedValue;

  async function commit() {
    if (!dirty) return;
    const ok = await onSave(value);
    if (ok) setSavedValue(value);
  }

  return (
    <div>
      <textarea
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        className={`w-full resize-none ${inputBaseClass}`}
      />
      <div className="mt-1 flex items-center gap-2">
        {dirty ? (
          <>
            <button type="button" onClick={commit} className="inline-flex items-center gap-1 text-xs font-medium text-ro-accent">
              <Check size={14} /> {tButton("save")}
            </button>
            <button
              type="button"
              onClick={() => setValue(savedValue)}
              className="inline-flex items-center gap-1 text-xs font-medium text-ro-text-muted hover:text-ro-text"
            >
              <X size={14} /> {tCommon("cancel")}
            </button>
          </>
        ) : (
          <FieldStatus state={state} />
        )}
      </div>
      <FieldError error={error} />
    </div>
  );
}

// Campo de rol único: <select> si hay roles del bot, o input de texto (con ✓/X)
// si no. En modo select guarda al cambiar; en modo texto, con ✓/X.
function RoleSelectField({
  legend,
  hint,
  noneLabel,
  placeholder,
  value,
  roles,
  state,
  error,
  onSave,
}: {
  legend: string;
  hint: string;
  noneLabel: string;
  placeholder: string;
  value: string | null;
  roles: { id: string; name: string }[] | null;
  state?: FieldState;
  error?: string;
  onSave: (value: string) => Promise<boolean>;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-ro-text">{legend}</legend>
      <p className="text-xs text-ro-text-muted">{hint}</p>
      {roles ? (
        <div className="flex items-center gap-2">
          <select
            defaultValue={value ?? ""}
            onChange={(e) => onSave(e.target.value)}
            className={`min-w-0 flex-1 ${selectClass} w-full`}
          >
            <option value="">{noneLabel}</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <FieldStatus state={state} />
        </div>
      ) : (
        <EditableField
          label={legend}
          initial={value ?? ""}
          placeholder={placeholder}
          state={state}
          error={error}
          onSave={onSave}
        />
      )}
      {roles && <FieldError error={error} />}
    </fieldset>
  );
}
