"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, Palette, Keyboard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const themeOptions = [
    { id: "light",  label: "Light",  Icon: Sun },
    { id: "dark",   label: "Dark",   Icon: Moon },
    { id: "system", label: "System", Icon: Monitor },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <p className="text-xs text-muted-foreground">Manage your dashboard preferences</p>

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
            <div className="flex flex-col sm:flex-row gap-2">
              {themeOptions.map(({ id, label, Icon }) => (
                <Button
                  key={id}
                  variant={mounted && theme === id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(id)}
                  className="h-8 px-3 text-xs gap-1.5 flex-1 justify-start sm:justify-center"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />{label}
                </Button>
              ))}
            </div>
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
