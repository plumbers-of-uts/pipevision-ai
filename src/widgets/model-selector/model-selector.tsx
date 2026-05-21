/**
 * model-selector.tsx — Sidebar dropdown for choosing the active inference model.
 *
 * Reads/writes the localStorage-backed active-model-store. Entries that are not
 * yet configured (no ONNX URL) are rendered disabled with a "(coming soon)" hint.
 * Changing the selection triggers a session tear-down + reload in ModelProvider.
 */

import { useActiveModelId } from "@/features/inference/active-model-store";
import { setActiveModelId } from "@/features/inference/active-model-store";
import { MODEL_IDS, MODEL_REGISTRY, type ModelId } from "@/features/inference/model-config";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ModelSelector() {
  const activeId = useActiveModelId();

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="model-selector"
        className="text-[10px] font-semibold uppercase tracking-[0.6px] text-fg-tertiary"
      >
        Model
      </label>
      <Select
        value={activeId}
        onValueChange={(value: string) => {
          setActiveModelId(value as ModelId);
        }}
      >
        <SelectTrigger
          id="model-selector"
          size="sm"
          className="w-full justify-between border-border-default bg-bg-base text-[12px] text-fg-primary"
          aria-label="Select inference model"
        >
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent align="start">
          {MODEL_IDS.map((id) => {
            const cfg = MODEL_REGISTRY[id];
            const disabled = !cfg.isConfigured;
            return (
              <SelectItem
                key={id}
                value={id}
                disabled={disabled}
                className="text-[12px]"
                aria-label={disabled ? `${cfg.displayName} (coming soon)` : cfg.displayName}
              >
                <span className="flex items-center gap-2">
                  <span>{cfg.displayName}</span>
                  {disabled ? (
                    <span className="text-[10px] text-fg-tertiary">(coming soon)</span>
                  ) : null}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
