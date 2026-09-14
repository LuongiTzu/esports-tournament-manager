"use client";

import { useRef, useState, type FormEvent } from "react";
import ImageUploadPicker from "@/components/ImageUploadPicker";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import type {
  TournamentDetail,
  UpdateTournamentRequest,
} from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";

const fields = [
  { key: "name", max: 150 },
  { key: "description", max: 2000, multiline: true },
  { key: "rules", max: 5000, multiline: true },
  { key: "prizePool", max: 1000, multiline: true },
  { key: "contactEmail", type: "email" },
  { key: "contactPhone", type: "tel", pattern: "(0|\\+84)[0-9]{9}" },
  { key: "contactLink", type: "url", max: 500 },
  { key: "location", max: 255 },
] as const;
type Field = (typeof fields)[number]["key"];
function values(tournament: TournamentDetail): Record<Field, string> {
  return Object.fromEntries(
    fields.map(({ key }) => [key, tournament[key] ?? ""]),
  ) as Record<Field, string>;
}

export default function TournamentInfoEditor({
  tournament,
  onRefresh,
}: {
  tournament: TournamentDetail;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => values(tournament));
  const baseline = useRef(values(tournament));
  const saving = useRef(false);
  const [working, setWorking] = useState(false);
  const [banner, setBanner] = useState<File | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(tournament.bannerUrl);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const begin = () => {
    baseline.current = values(tournament);
    setForm(baseline.current);
    setBannerUrl(tournament.bannerUrl);
    setBanner(null);
    setRemoveBanner(false);
    setError("");
    setNotice("");
    setFieldErrors({});
    setOpen(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = t("infoEditor.required");
    if (tournament.mode !== "ONLINE" && !form.location.trim())
      errors.location = t("tournament.create.locationRequired");
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const patch: UpdateTournamentRequest = {};
    for (const { key } of fields) {
      const value = form[key].trim();
      if (value !== baseline.current[key]) {
        if (key === "name") patch.name = value;
        else if (key === "description" || key === "rules") patch[key] = value;
        else patch[key] = value || null;
      }
    }
    if (removeBanner) patch.bannerUrl = null;
    const hasPatch = Object.keys(patch).length > 0;
    if (!hasPatch && !banner) {
      setNotice(t("infoEditor.unchanged"));
      return;
    }
    saving.current = true;
    setWorking(true);
    setError("");
    setNotice("");
    let saved = false;
    try {
      if (hasPatch) {
        await tournamentsApi.update(tournament.id, patch);
        baseline.current = Object.fromEntries(
          fields.map(({ key }) => [key, form[key].trim()]),
        ) as Record<Field, string>;
        if (removeBanner) {
          setBannerUrl(null);
          setRemoveBanner(false);
        }
        saved = true;
        setNotice(t("infoEditor.contentSaved"));
      }
      if (banner) {
        try {
          const uploaded = await tournamentsApi.uploadBanner(
            tournament.id,
            banner,
          );
          setBannerUrl(uploaded.url);
          setBanner(null);
          saved = true;
        } catch (reason) {
          setError(
            `${t("infoEditor.bannerFailed")} ${reason instanceof Error ? reason.message : ""}`,
          );
          return;
        }
      }
      setNotice(t("infoEditor.saved"));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("infoEditor.failed"),
      );
      if (reason instanceof ApiError)
        setFieldErrors(
          Object.fromEntries(
            (reason.errors ?? []).map((item) => [item.field, item.message]),
          ),
        );
    } finally {
      if (saved) {
        try {
          await onRefresh();
        } catch {
          setError((current) =>
            `${current} ${t("infoEditor.refreshFailed")}`.trim(),
          );
        }
      }
      saving.current = false;
      setWorking(false);
    }
  };

  return (
    <section
      aria-labelledby="tournament-info-heading"
      className="rounded-2xl border border-line bg-surface-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tournament-info-heading" className="text-lg font-bold">
          {t("infoEditor.title")}
        </h2>
        {!open && (
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={begin}
          >
            {t("common.edit")}
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-5">
          <fieldset disabled={working} className="grid gap-4 sm:grid-cols-2">
            {fields
              .filter(
                (field) =>
                  field.key !== "location" ||
                  tournament.mode !== "ONLINE" ||
                  Boolean(tournament.location),
              )
              .map((field) => {
                const id = `tournament-info-${field.key}`;
                const props = {
                  id,
                  value: form[field.key],
                  maxLength: "max" in field ? field.max : undefined,
                  required:
                    field.key === "name" ||
                    (field.key === "location" && tournament.mode !== "ONLINE"),
                  "aria-invalid": Boolean(fieldErrors[field.key]),
                  "aria-describedby": fieldErrors[field.key]
                    ? `${id}-error`
                    : undefined,
                  onChange: (
                    event: React.ChangeEvent<
                      HTMLInputElement | HTMLTextAreaElement
                    >,
                  ) => {
                    setForm((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }));
                    setFieldErrors((current) => ({
                      ...current,
                      [field.key]: "",
                    }));
                    setNotice("");
                  },
                  className: `${inputClass} mt-1`,
                };
                return (
                  <div
                    key={field.key}
                    className={"multiline" in field ? "sm:col-span-2" : ""}
                  >
                    <label htmlFor={id} className={labelClass}>
                      {t(`tournament.create.${field.key}` as TranslationKey)}
                    </label>
                    {"multiline" in field ? (
                      <textarea {...props} rows={4} />
                    ) : (
                      <input
                        {...props}
                        type={"type" in field ? field.type : "text"}
                        pattern={"pattern" in field ? field.pattern : undefined}
                      />
                    )}
                    {fieldErrors[field.key] && (
                      <p
                        id={`${id}-error`}
                        className="mt-1 text-sm text-rejected"
                      >
                        {fieldErrors[field.key]}
                      </p>
                    )}
                  </div>
                );
              })}
            <div className="sm:col-span-2">
              <ImageUploadPicker
                label={t("infoEditor.banner")}
                file={banner}
                onFileChange={(file) => {
                  setBanner(file);
                  if (file) setRemoveBanner(false);
                }}
                existingUrl={removeBanner ? null : bannerUrl}
                variant="banner"
                disabled={working}
                uploading={working && Boolean(banner)}
                crop={{ aspect: 16 / 6, maxWidth: 1600, maxHeight: 600 }}
              />
              {bannerUrl && !banner && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={removeBanner}
                    onChange={(e) => setRemoveBanner(e.target.checked)}
                  />
                  {t("infoEditor.removeBanner")}
                </label>
              )}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className={`${alertErrorClass} mt-4`}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 text-sm text-approved">
              {notice}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={working}
              className={primaryButtonClass}
            >
              {t(working ? "common.saving" : "infoEditor.save")}
            </button>
            <button
              type="button"
              disabled={working}
              className={secondaryButtonClass}
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
