"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, LogOut, Tags } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, LinkButton, PageHeader, Stamp } from "@/lib/ui";
import { LangToggle, useT } from "@/lib/i18n";

const REPO = "https://github.com/Yashgurav002/pf-desk";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-x-8 gap-y-3 border-t border-line py-6 first:border-t-0 first:pt-0 md:grid-cols-[13rem_minmax(0,1fr)]">
      <h2 className="text-[1.05rem] font-semibold">{title}</h2>
      <div className="min-w-0 space-y-3">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { t } = useT();
  const [demo, setDemo] = useState<boolean | null>(null);
  useEffect(() => { api<{ demo?: boolean }>("/health", { noRedirect: true }).then((h) => setDemo(!!h.demo)).catch(() => {}); }, []);

  const logout = async () => { await api("/auth/logout", { method: "POST", noRedirect: true }).catch(() => {}); location.href = "/"; };

  return (
    <div>
      <PageHeader title={t("settings")} description={t("seDesc")} />
      <Card className="p-5 md:p-6">
        <Section title={t("seLang")}>
          <LangToggle />
          <p className="text-sm text-ink-3">{t("seLangDesc")}</p>
        </Section>

        <Section title={t("seLabel")}>
          <p className="text-ink-2">{t("seLabelDesc")}</p>
          <LinkButton href="/label" variant="secondary" icon={<Tags className="size-4" />}>{t("seLabelOpen")}</LinkButton>
        </Section>

        <Section title={t("seData")}>
          {demo != null && (
            <p className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm text-ink-3">{t("seMode")}</span>
              <Stamp tone={demo ? "warn" : "ok"}>{demo ? t("seStDemo") : t("seStLocal")}</Stamp>
              <span className="text-sm text-ink-2">{demo ? t("seModeDemo") : t("seModeLocal")}</span>
            </p>
          )}
          <ul className="list-disc space-y-1.5 pl-5 text-ink-2 marker:text-ink-3">
            <li>{t("seData1")}</li><li>{t("seData2")}</li><li>{t("seData3")}</li>
          </ul>
        </Section>

        <Section title={t("seAbout")}>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-2">{t("seModels")}</p>
            <ul className="space-y-1 text-ink-2">
              <li>{t("seModelLang")}</li><li>{t("seModelRisk")}</li><li>{t("seModelDec")}</li>
            </ul>
          </div>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">{t("seGithub")}<ExternalLink className="size-3.5" aria-hidden /></a>
            <a href={`${REPO}/tree/main/evaluation`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">{t("seEval")}<ExternalLink className="size-3.5" aria-hidden /></a>
          </p>
        </Section>

        <Section title={t("logout")}>
          <p className="text-sm text-ink-3">{t("seLogoutDesc")}</p>
          <Button variant="danger" icon={<LogOut className="size-4" />} onClick={logout}>{t("logout")}</Button>
        </Section>
      </Card>
    </div>
  );
}
