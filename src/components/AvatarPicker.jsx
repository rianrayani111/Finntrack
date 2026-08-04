import React, { useEffect, useState } from "react";
import { db } from "@/api/db";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import AvatarPreview, { SKIN_TONES, HAIR_COLORS, HAIR_STYLES, FACES } from "@/components/AvatarPreview";

function PickerRow({ label, options, value, onChange, swatch }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            title={opt.label}
            className={`rounded-2xl border-2 transition-all ${
              value === opt.id ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-200 hover:border-slate-300"
            } ${swatch ? "w-10 h-10" : "px-3 py-2 text-xs font-bold text-slate-600"}`}
            style={swatch ? { backgroundColor: opt.hex } : undefined}
          >
            {!swatch && opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AvatarPicker({ open, onOpenChange, avatar, onSaved }) {
  const [skin, setSkin] = useState(avatar?.skin || "peach");
  const [hairStyle, setHairStyle] = useState(avatar?.hairStyle || "short");
  const [hairColor, setHairColor] = useState(avatar?.hairColor || "brown");
  const [face, setFace] = useState(avatar?.face || "smile");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSkin(avatar?.skin || "peach");
      setHairStyle(avatar?.hairStyle || "short");
      setHairColor(avatar?.hairColor || "brown");
      setFace(avatar?.face || "smile");
    }
  }, [open, avatar]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.users.updateAvatar({ skin, hairStyle, hairColor, face });
      toast({ title: "Avatar updated!" });
      onSaved?.({ skin, hairStyle, hairColor, face });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Could not save avatar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Customize your avatar</DialogTitle>
          <DialogDescription>Pick a skin tone, hairstyle, hair color, and face.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <div className="bg-sky-50 rounded-full p-3 ring-4 ring-sky-100">
            <AvatarPreview skin={skin} hairStyle={hairStyle} hairColor={hairColor} face={face} size={104} />
          </div>
        </div>

        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          <PickerRow label="Skin tone" options={SKIN_TONES} value={skin} onChange={setSkin} swatch />
          <PickerRow label="Hairstyle" options={HAIR_STYLES} value={hairStyle} onChange={setHairStyle} />
          <PickerRow label="Hair color" options={HAIR_COLORS} value={hairColor} onChange={setHairColor} swatch />
          <PickerRow label="Face" options={FACES} value={face} onChange={setFace} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl font-bold">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-2xl font-bold bg-sky-500 hover:bg-sky-600">
            {saving ? "Saving..." : "Save Avatar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
