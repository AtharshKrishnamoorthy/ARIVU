"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Palette, Globe, Bell, Keyboard, Mail, Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { fetchSMTPSettings, saveSMTPSettings, testSMTPEmail } from "@services/api";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted]             = useState(false);
  const [autoRefresh, setAutoRefresh]     = useState(false);
  const [notifications, setNotifications] = useState(true);

  // SMTP State
  const [smtpConfig, setSmtpConfig] = useState({
    host: "", port: "587", user: "", password: "", from_addr: ""
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, msg: string} | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchSMTPSettings().then(data => {
      if (data && Object.keys(data).length > 0) {
        setSmtpConfig({
          host: data.host || "",
          port: data.port?.toString() || "587",
          user: data.user || "",
          password: data.password || "",
          from_addr: data.from_addr || ""
        });
      }
    });
  }, []);

  const handleSmtpSave = async () => {
    setSmtpLoading(true);
    await saveSMTPSettings(smtpConfig);
    setSmtpLoading(false);
  };

  const handleSmtpTest = async () => {
    if (!testEmail) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await testSMTPEmail(testEmail);
      if (res?.success) {
        setTestResult({ success: true, msg: "Test email sent successfully!" });
      } else {
        setTestResult({ success: false, msg: res?.error || "Failed to send test email" });
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: err.message || "An error occurred" });
    }
    setTestLoading(false);
  };

  const themeOptions = [
    { id: "light",  label: "Light",  Icon: Sun },
    { id: "dark",   label: "Dark",   Icon: Moon },
    { id: "system", label: "System", Icon: Monitor },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your dashboard preferences</p>
      </div>

      {/* SMTP Email Configuration */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Email Integration (SMTP)</CardTitle>
          </div>
          <CardDescription className="text-xs">Configure email settings for automation notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">SMTP Host</Label>
              <Input 
                value={smtpConfig.host} 
                onChange={(e) => setSmtpConfig({...smtpConfig, host: e.target.value})} 
                placeholder="smtp.gmail.com" 
                className="h-8 text-xs" 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SMTP Port</Label>
              <Input 
                value={smtpConfig.port} 
                onChange={(e) => setSmtpConfig({...smtpConfig, port: e.target.value})} 
                placeholder="587" 
                className="h-8 text-xs" 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Username / Email</Label>
              <Input 
                value={smtpConfig.user} 
                onChange={(e) => setSmtpConfig({...smtpConfig, user: e.target.value})} 
                placeholder="user@example.com" 
                className="h-8 text-xs" 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">App Password</Label>
              <Input 
                type="password" 
                value={smtpConfig.password} 
                onChange={(e) => setSmtpConfig({...smtpConfig, password: e.target.value})} 
                placeholder="••••••••••••••••" 
                className="h-8 text-xs" 
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">From Address</Label>
              <Input 
                value={smtpConfig.from_addr} 
                onChange={(e) => setSmtpConfig({...smtpConfig, from_addr: e.target.value})} 
                placeholder="notifications@arivu.local" 
                className="h-8 text-xs" 
              />
            </div>
          </div>
          
          {/* Test Email Section */}
          <div className="pt-4 border-t border-border mt-4">
            <Label className="text-xs mb-1.5 block">Test Email Address</Label>
            <div className="flex gap-2">
              <Input 
                value={testEmail} 
                onChange={(e) => setTestEmail(e.target.value)} 
                placeholder="you@example.com" 
                className="h-8 text-xs flex-1" 
              />
              <Button 
                variant="secondary" 
                size="sm" 
                className="h-8 text-xs" 
                onClick={handleSmtpTest}
                disabled={testLoading || !testEmail}
              >
                {testLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                Send Test
              </Button>
            </div>
            {testResult && (
              <p className={`text-[11px] mt-2 flex items-center gap-1.5 ${testResult.success ? "text-emerald-500" : "text-red-500"}`}>
                {testResult.success ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {testResult.msg}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-0 justify-end">
          <Button size="sm" className="h-8 text-xs" onClick={handleSmtpSave} disabled={smtpLoading}>
            {smtpLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
            Save Settings
          </Button>
        </CardFooter>
      </Card>

      {/* Appearance */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Appearance</CardTitle>
          </div>
          <CardDescription className="text-xs">Customize how the dashboard looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Theme</Label>
            <div className="flex gap-2">
              {themeOptions.map(({ id, label, Icon }) => (
                <Button key={id} variant={mounted && theme === id ? "default" : "outline"} size="sm"
                  onClick={() => setTheme(id)} className="h-8 px-3 text-xs gap-1.5 flex-1">
                  <Icon className="h-3.5 w-3.5" />{label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Data</CardTitle>
          </div>
          <CardDescription className="text-xs">Configure data fetching behaviour</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Auto-refresh</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Refresh data every 30 seconds</p>
            </div>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Notifications</CardTitle>
          </div>
          <CardDescription className="text-xs">Control alert behaviour</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs">Error alerts</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Show badge count for pipeline errors</p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
        </CardContent>
      </Card>

      {/* Keyboard shortcuts */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Keyboard Shortcuts</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { keys: "Ctrl + B", action: "Toggle sidebar" },
            { keys: "Ctrl + R", action: "Refresh page" },
          ].map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">{action}</span>
              <kbd className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">{keys}</kbd>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
