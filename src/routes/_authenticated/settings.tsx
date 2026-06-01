import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Settings = {
  business_name: string;
  logo_url: string | null;
  followup_day2_subject: string;
  followup_day2_body: string;
  followup_day5_subject: string;
  followup_day5_body: string;
};

const EMPTY: Settings = {
  business_name: "",
  logo_url: null,
  followup_day2_subject: "Quick follow-up on your quote",
  followup_day2_body:
    "Hi {{client_name}},\n\nJust checking in on the quote I sent over a couple of days ago. Let me know if you have any questions!\n\nYou can review it here: {{quote_link}}\n\nThanks!",
  followup_day5_subject: "Still interested?",
  followup_day5_body:
    "Hi {{client_name}},\n\nWanted to circle back one more time on the quote. Happy to adjust anything if needed.\n\nReview here: {{quote_link}}\n\nThanks!",
};

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (data) {
        setSettings({
          business_name: data.business_name ?? "",
          logo_url: data.logo_url,
          followup_day2_subject: data.followup_day2_subject,
          followup_day2_body: data.followup_day2_body,
          followup_day5_subject: data.followup_day5_subject,
          followup_day5_body: data.followup_day5_body,
        });
      }
      setLoading(false);
    })();
  }, []);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const handleLogoUpload = async (file: File) => {
    if (!userId) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      update("logo_url", data.publicUrl);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...settings }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize your business branding and the automated follow-up emails sent to clients.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Business</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shown on client-facing quote pages and in follow-up emails.
        </p>
        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              value={settings.business_name}
              onChange={(e) => update("business_name", e.target.value)}
              placeholder="Acme Studio"
            />
          </div>
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="gap-1.5"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {settings.logo_url ? "Replace logo" : "Upload logo"}
                </Button>
                {settings.logo_url && (
                  <button
                    type="button"
                    onClick={() => update("logo_url", null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG or SVG, max 2MB.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Follow-up emails</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sent to the client automatically if they haven't responded. Use{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{"{{client_name}}"}</code> and{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{"{{quote_link}}"}</code> as placeholders.
        </p>

        <div className="mt-6 space-y-6">
          <div className="space-y-4 rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                Day 2
              </span>
              <span className="text-sm text-muted-foreground">First reminder</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d2s">Subject</Label>
              <Input
                id="d2s"
                value={settings.followup_day2_subject}
                onChange={(e) => update("followup_day2_subject", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d2b">Message</Label>
              <Textarea
                id="d2b"
                rows={7}
                value={settings.followup_day2_body}
                onChange={(e) => update("followup_day2_body", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                Day 5
              </span>
              <span className="text-sm text-muted-foreground">Final reminder</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d5s">Subject</Label>
              <Input
                id="d5s"
                value={settings.followup_day5_subject}
                onChange={(e) => update("followup_day5_subject", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d5b">Message</Label>
              <Textarea
                id="d5b"
                rows={7}
                value={settings.followup_day5_body}
                onChange={(e) => update("followup_day5_body", e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
