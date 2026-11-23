"use client";

// PaoTeacherAgent: the dean's page. Two jobs, in plain words: keep the agents'
// files and instructions up to date, and set how the site looks. Backend: onyx/server/pao/api.py.

import React, { useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SettingsLayouts, toast } from "@opal/layouts";
import {
  Button,
  Card,
  InputTextArea,
  InputTypeIn,
  Text,
} from "@opal/components";
import { Section } from "@/layouts/general-layouts";
import { SvgTrash, SvgUploadCloud } from "@opal/icons";
import { ADMIN_ROUTES } from "@/lib/admin-routes";
import { useAdminRouteTitle } from "@/lib/adminNavLabels";
import { errorHandlingFetcher, parseErrorDetail } from "@/lib/fetcher";
import { SWR_KEYS } from "@/lib/swr-keys";

const route = ADMIN_ROUTES.DEAN;
const KNOWLEDGE_URL = "/api/admin/pao/knowledge";
const BRANDING_URL = "/api/admin/pao/branding";
const PROMPTS_URL = "/api/admin/pao/prompts";
const DEFAULT_COLOR = "#5cb531";
const HEX = /^#[0-9a-f]{6}$/i;

interface KnowledgeFile {
  id: string;
  name: string;
  status: string;
  built_in: boolean;
}

interface KnowledgeAgent {
  persona_id: number;
  name: string;
  icon: string;
  description: string;
  files: KnowledgeFile[];
}

interface AgentPrompt {
  persona_id: number;
  name: string;
  icon: string;
  description: string;
  prompt: string;
  is_custom: boolean;
}

interface Branding {
  app_name: string | null;
  primary_color: string | null;
  has_custom_logo: boolean;
  logo_version: number;
}

function isReading(file: KnowledgeFile) {
  return file.status === "PROCESSING" || file.status === "INDEXING";
}

async function failureMessage(response: Response, fallback: string) {
  return parseErrorDetail(response, fallback);
}

function KnowledgeCard({
  agent,
  onChanged,
}: {
  agent: KnowledgeAgent;
  onChanged: () => void;
}) {
  const t = useTranslations("admin.dean");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const body = new FormData();
    list.forEach((f) => body.append("files", f));
    setBusy(true);
    try {
      const response = await fetch(
        `${KNOWLEDGE_URL}/${agent.persona_id}/files`,
        { method: "POST", body }
      );
      if (!response.ok) {
        throw new Error(await failureMessage(response, t("upload.failed")));
      }
      const result: { added: string[]; rejected: string[] } =
        await response.json();
      if (result.added.length > 0) {
        toast.success(t("upload.added", { count: result.added.length }));
      }
      if (result.rejected.length > 0) {
        toast.error(
          t("upload.rejected", { names: result.rejected.join(", ") })
        );
      }
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("upload.failed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(file: KnowledgeFile) {
    if (!window.confirm(t("remove.confirm", { name: file.name }))) return;
    const response = await fetch(
      `${KNOWLEDGE_URL}/${agent.persona_id}/files/${file.id}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      toast.error(await failureMessage(response, t("remove.failed")));
      return;
    }
    toast.success(t("remove.done", { name: file.name }));
    onChanged();
  }

  return (
    <Card border="solid" rounding={4}>
      <Section alignItems="stretch" height="fit" gap={3}>
        <Section
          flexDirection="row"
          alignItems="start"
          justifyContent="between"
          height="fit"
          gap={3}
        >
          <Section alignItems="start" height="fit" gap={0} width="fit">
            <Text font="main-ui-action" color="text-05">
              {`${agent.icon} ${agent.name}`}
            </Text>
            <Text font="secondary-body" color="text-03">
              {agent.description}
            </Text>
          </Section>
          <Button
            icon={SvgUploadCloud}
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {t("upload.button")}
          </Button>
          {/* oxlint-disable-next-line react/forbid-elements -- hidden picker behind the Add files button */}
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(e) => e.target.files && void upload(e.target.files)}
          />
        </Section>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files);
          }}
          className={`rounded-08 border border-dashed p-3 ${
            dragging ? "border-theme-primary-05" : "border-border-02"
          }`}
        >
          {agent.files.length === 0 ? (
            <Text font="secondary-body" color="text-03">
              {t("files.empty")}
            </Text>
          ) : (
            <ul className="flex flex-col divide-y divide-border-01">
              {agent.files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <Section alignItems="start" height="fit" gap={0} width="auto">
                    <span className="truncate" title={file.name}>
                      <Text font="main-ui-body" color="text-05">
                        {file.name}
                      </Text>
                    </span>
                    <Text font="secondary-body" color="text-03">
                      {file.built_in
                        ? t("files.builtIn")
                        : file.status === "FAILED"
                          ? t("files.failed")
                          : isReading(file)
                            ? t("files.processing")
                            : t("files.ready")}
                    </Text>
                  </Section>
                  {!file.built_in && (
                    <Button
                      icon={SvgTrash}
                      prominence="tertiary"
                      tooltip={t("remove.tooltip")}
                      onClick={() => void remove(file)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Text font="secondary-body" color="text-03">
          {t("upload.hint")}
        </Text>
      </Section>
    </Card>
  );
}

function PromptCard({
  agent,
  onChanged,
}: {
  agent: AgentPrompt;
  onChanged: () => void;
}) {
  const t = useTranslations("admin.dean");
  const [text, setText] = useState(agent.prompt);
  const [saving, setSaving] = useState(false);
  const changed = text.trim() !== agent.prompt.trim();

  async function send(method: "PUT" | "DELETE") {
    setSaving(true);
    try {
      const response = await fetch(`${PROMPTS_URL}/${agent.persona_id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ prompt: text }) : undefined,
      });
      if (!response.ok) {
        throw new Error(await failureMessage(response, t("prompts.failed")));
      }
      const saved: AgentPrompt = await response.json();
      setText(saved.prompt);
      onChanged();
      toast.success(
        method === "PUT" ? t("prompts.saved") : t("prompts.resetDone")
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("prompts.failed"));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (!window.confirm(t("prompts.resetConfirm", { name: agent.name }))) return;
    void send("DELETE");
  }

  return (
    <Card border="solid" rounding={4}>
      <Section alignItems="stretch" height="fit" gap={3}>
        <Section alignItems="start" height="fit" gap={0} width="fit">
          <Text font="main-ui-action" color="text-05">
            {`${agent.icon} ${agent.name}`}
          </Text>
          <Text font="secondary-body" color="text-03">
            {agent.is_custom ? t("prompts.custom") : t("prompts.default")}
          </Text>
        </Section>
        <InputTextArea
          value={text}
          rows={14}
          aria-label={t("prompts.label", { name: agent.name })}
          onChange={(e) => setText(e.target.value)}
        />
        <Section
          flexDirection="row"
          justifyContent="start"
          height="fit"
          gap={2}
        >
          <Button
            disabled={saving || !changed || text.trim() === ""}
            onClick={() => void send("PUT")}
          >
            {t("prompts.save")}
          </Button>
          <Button
            prominence="tertiary"
            disabled={saving || !agent.is_custom}
            onClick={reset}
          >
            {t("prompts.reset")}
          </Button>
        </Section>
      </Section>
    </Card>
  );
}

function AppearanceCard({ branding }: { branding: Branding }) {
  const t = useTranslations("admin.dean");
  const router = useRouter();
  const logoInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(branding.app_name ?? "");
  const [color, setColor] = useState(branding.primary_color ?? DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);
  const colorValid = HEX.test(color);

  async function refresh() {
    await mutate(BRANDING_URL);
    await mutate(SWR_KEYS.settings);
    // The brand colour is rendered by the server layout.
    router.refresh();
  }

  async function save(reset = false) {
    setSaving(true);
    try {
      const response = await fetch(BRANDING_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_name: reset ? "" : name.trim(),
          primary_color: reset ? "" : color,
        }),
      });
      if (!response.ok) {
        throw new Error(await failureMessage(response, t("appearance.failed")));
      }
      if (reset) {
        setName("");
        setColor(DEFAULT_COLOR);
      }
      await refresh();
      toast.success(t("appearance.saved"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("appearance.failed")
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/pao/logo", {
      method: "PUT",
      body,
    });
    if (!response.ok) {
      toast.error(await failureMessage(response, t("logo.failed")));
      return;
    }
    await refresh();
    toast.success(t("logo.saved"));
  }

  async function resetLogo() {
    const response = await fetch("/api/admin/pao/logo", { method: "DELETE" });
    if (!response.ok) {
      toast.error(await failureMessage(response, t("logo.failed")));
      return;
    }
    await refresh();
    toast.success(t("logo.saved"));
  }

  return (
    <Card border="solid" rounding={4}>
      <Section alignItems="stretch" height="fit" gap={5}>
        <Section alignItems="stretch" height="fit" gap={1}>
          <Text font="main-ui-action" color="text-05">
            {t("appearance.name.label")}
          </Text>
          <InputTypeIn
            value={name}
            maxLength={40}
            placeholder={t("appearance.name.placeholder")}
            onChange={(e) => setName(e.target.value)}
          />
          <Text font="secondary-body" color="text-03">
            {t("appearance.name.hint")}
          </Text>
        </Section>

        <Section alignItems="stretch" height="fit" gap={1}>
          <Text font="main-ui-action" color="text-05">
            {t("appearance.color.label")}
          </Text>
          <Section
            flexDirection="row"
            justifyContent="start"
            height="fit"
            gap={3}
          >
            {/* oxlint-disable-next-line react/forbid-elements -- Opal has no colour picker */}
            <input
              type="color"
              aria-label={t("appearance.color.label")}
              value={colorValid ? color : DEFAULT_COLOR}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-08 border border-border-02"
            />
            <InputTypeIn
              value={color}
              spellCheck={false}
              variant={colorValid ? undefined : "error"}
              onChange={(e) => setColor(e.target.value)}
            />
          </Section>
          <Text font="secondary-body" color="text-03">
            {t("appearance.color.hint")}
          </Text>
        </Section>

        <Section
          flexDirection="row"
          justifyContent="start"
          height="fit"
          gap={2}
        >
          <Button disabled={saving || !colorValid} onClick={() => void save()}>
            {t("appearance.save")}
          </Button>
          <Button
            prominence="tertiary"
            disabled={saving}
            onClick={() => void save(true)}
          >
            {t("appearance.reset")}
          </Button>
        </Section>

        <Section
          alignItems="stretch"
          height="fit"
          gap={2}
          className="mt-4 border-t border-border-01"
        >
          <Text font="main-ui-action" color="text-05">
            {t("logo.label")}
          </Text>
          <Section
            flexDirection="row"
            justifyContent="start"
            height="fit"
            gap={4}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/pao-logo?v=${branding.logo_version}`}
              alt=""
              className="h-16 w-16 shrink-0 rounded-08 border border-border-02 object-contain"
            />
            <Button
              icon={SvgUploadCloud}
              onClick={() => logoInput.current?.click()}
            >
              {t("logo.upload")}
            </Button>
            {branding.has_custom_logo && (
              <Button prominence="tertiary" onClick={() => void resetLogo()}>
                {t("logo.reset")}
              </Button>
            )}
            {/* oxlint-disable-next-line react/forbid-elements -- hidden picker behind the Upload button */}
            <input
              ref={logoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadLogo(file);
                e.target.value = "";
              }}
            />
          </Section>
          <Text font="secondary-body" color="text-03">
            {t("logo.hint")}
          </Text>
        </Section>
      </Section>
    </Card>
  );
}

export default function DeanPage() {
  const t = useTranslations("admin.dean");
  const adminRouteTitle = useAdminRouteTitle();
  const { data: agents, mutate: refreshKnowledge } = useSWR<KnowledgeAgent[]>(
    KNOWLEDGE_URL,
    errorHandlingFetcher,
    {
      // While a new file is being read, check again every few seconds.
      refreshInterval: (latest) =>
        latest?.some((a) => a.files.some(isReading)) ? 3000 : 0,
    }
  );
  const { data: prompts, mutate: refreshPrompts } = useSWR<AgentPrompt[]>(
    PROMPTS_URL,
    errorHandlingFetcher
  );
  const { data: branding } = useSWR<Branding>(
    BRANDING_URL,
    errorHandlingFetcher
  );

  return (
    <SettingsLayouts.Root>
      <SettingsLayouts.Header
        icon={route.icon}
        title={adminRouteTitle(route)}
        description={t("header.description")}
        divider
      />
      <SettingsLayouts.Body>
        <Text font="heading-h3" color="text-05">
          {t("knowledge.title")}
        </Text>
        {agents?.map((agent) => (
          <KnowledgeCard
            key={agent.persona_id}
            agent={agent}
            onChanged={() => void refreshKnowledge()}
          />
        ))}
        {agents?.length === 0 && (
          <Text font="main-ui-body" color="text-03">
            {t("knowledge.none")}
          </Text>
        )}

        {prompts && prompts.length > 0 && (
          <>
            <Text font="heading-h3" color="text-05">
              {t("prompts.title")}
            </Text>
            <Text font="secondary-body" color="text-03">
              {t("prompts.intro")}
            </Text>
            {prompts.map((agent) => (
              <PromptCard
                // Remount when the saved text changes, so the box shows it.
                key={`${agent.persona_id}-${agent.is_custom}-${agent.prompt.length}`}
                agent={agent}
                onChanged={() => void refreshPrompts()}
              />
            ))}
          </>
        )}

        <Text font="heading-h3" color="text-05">
          {t("appearance.title")}
        </Text>
        {branding && <AppearanceCard branding={branding} />}

        <Text font="secondary-body" color="text-03">
          {t("footer.advanced")}
        </Text>
      </SettingsLayouts.Body>
    </SettingsLayouts.Root>
  );
}
