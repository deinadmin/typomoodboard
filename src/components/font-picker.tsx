import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, ShieldCheck } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  queryLocalFonts,
  supportsLocalFonts,
  type LocalFontEntry,
} from "@/lib/fonts";
import type { FontUpload } from "@/lib/types";

interface PickerSelection {
  source: "system" | "upload";
  family: string;
  style: string;
  postscriptName?: string;
  uploadId?: string;
}

interface FontPickerProps {
  value: PickerSelection;
  uploads: FontUpload[];
  onChange: (s: PickerSelection) => void;
}

export function FontPicker({ value, uploads, onChange }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [systemFonts, setSystemFonts] = useState<LocalFontEntry[]>([]);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const supported = supportsLocalFonts();

  useEffect(() => {
    if (!supported) return;
    queryLocalFonts().then((fonts) => {
      if (fonts.length > 0) {
        setSystemFonts(fonts);
        setPermissionAsked(true);
      }
    });
  }, [supported]);

  const systemFamilies = useMemo(() => {
    const map = new Map<string, LocalFontEntry[]>();
    for (const f of systemFonts) {
      const arr = map.get(f.family) ?? [];
      arr.push(f);
      map.set(f.family, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [systemFonts]);

  const uploadFamilies = useMemo(() => {
    const map = new Map<string, FontUpload[]>();
    for (const u of uploads) {
      const arr = map.get(u.family) ?? [];
      arr.push(u);
      map.set(u.family, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [uploads]);

  async function requestPermission() {
    const fonts = await queryLocalFonts();
    setSystemFonts(fonts);
    setPermissionAsked(true);
  }

  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value.family || "Select font..."}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search fonts..." />
          <CommandList>
            <CommandEmpty>
              {supported && !permissionAsked ? (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                  <ShieldCheck className="size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Grant permission to access local fonts.
                  </p>
                  <Button size="sm" onClick={requestPermission}>
                    Allow local fonts
                  </Button>
                </div>
              ) : (
                "No fonts found."
              )}
            </CommandEmpty>

            {uploadFamilies.length > 0 && (
              <CommandGroup heading="Uploaded">
                {uploadFamilies.flatMap(([family, items]) =>
                  items.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={`upload-${family}-${u.style}-${u.id}`}
                      onSelect={() => {
                        onChange({
                          source: "upload",
                          family,
                          style: u.style,
                          uploadId: u.id,
                        });
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          value.source === "upload" && value.uploadId === u.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="truncate">
                        {family}{" "}
                        <span className="text-muted-foreground">{u.style}</span>
                      </span>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            )}

            {systemFamilies.length > 0 && (
              <CommandGroup heading="System">
                {systemFamilies.map(([family, items]) => {
                  const first = items[0];
                  return (
                    <CommandItem
                      key={family}
                      value={`sys-${family}`}
                      onSelect={() => {
                        onChange({
                          source: "system",
                          family,
                          style: first.style,
                          postscriptName: first.postscriptName,
                        });
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          value.source === "system" && value.family === family
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="truncate">{family}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {supported && permissionAsked && systemFamilies.length === 0 && (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No system fonts available.
              </div>
            )}
            {!supported && (
              <div className="p-3 text-center text-xs text-muted-foreground">
                System fonts require Chromium. Upload .otf/.ttf files instead.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function getStylesForFamily(
  systemFonts: LocalFontEntry[],
  uploads: FontUpload[],
  family: string,
  source: "system" | "upload"
): string[] {
  if (source === "system") {
    return Array.from(
      new Set(systemFonts.filter((f) => f.family === family).map((f) => f.style))
    );
  }
  return Array.from(
    new Set(uploads.filter((u) => u.family === family).map((u) => u.style))
  );
}
